const Payment = require('../models/PaymentModel');
const Contract = require('../models/ContractModel');
const db = require('../config/db');
const { CreatePaymentDTO, PaymentDTO } = require('../dtos/PaymentDTO');
const { generateReceiptBuffer } = require('../utils/pdfReceipt');
const { sendPaymentConfirmationEmail, sendPaymentReminderEmail } = require('../utils/emailService');
const { createOrder: createPayPalOrder, captureOrder } = require('../utils/paypalClient');

const stripe = process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;

exports.createPaymentIntent = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { agreement_id, amount } = req.body;
        let payment_method = req.body.payment_method || 'card';

        const dto = new CreatePaymentDTO({ agreement_id, amount, payment_method });
        const validation = dto.validate();
        if (!validation.isValid) {
            return res.status(400).json({ error: 'Datos inválidos', errors: validation.errors });
        }

        const contract = await Contract.getById(agreement_id);
        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }
        if (contract.tenant_id !== userId) {
            return res.status(403).json({ error: 'No eres el inquilino de este contrato' });
        }

        const completedPayments = await Payment.getCompletedCountByAgreement(agreement_id);
        const isFirstPayment = completedPayments === 0;
        const depositAmount = Number(contract.deposit_amount || 0);
        let effectiveAmount = Number(contract.monthly_rent);
        if (isFirstPayment && depositAmount > 0) {
            effectiveAmount = Math.max(0, effectiveAmount - depositAmount);
        }

        if (Number(effectiveAmount) < 3500) {
            payment_method = 'other';
        }

        if (payment_method === 'card' && stripe && Number(effectiveAmount) >= 3500) {
            const stripeAmount = Math.round(Number(effectiveAmount) * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: stripeAmount,
                currency: 'cop',
                metadata: { agreement_id: String(agreement_id), tenant_id: String(userId) }
            });

            const payment = await Payment.create({
                agreement_id,
                tenant_id: userId,
                landlord_id: contract.landlord_id,
                amount: effectiveAmount,
                payment_method: 'card',
                status: 'pending',
                stripe_payment_intent_id: paymentIntent.id
            });

            return res.json({
                clientSecret: paymentIntent.client_secret,
                payment_id: payment.payment_id,
                message: 'PaymentIntent creado exitosamente'
            });
        }

        const payment = await Payment.create({
            agreement_id,
            tenant_id: userId,
            landlord_id: contract.landlord_id,
            amount: effectiveAmount,
            payment_method,
            status: 'pending'
        });

        res.json({
            payment_id: payment.payment_id,
            message: 'Pago registrado exitosamente',
            requires_confirmation: payment_method !== 'card'
        });

    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Error al procesar el pago', message: error.message });
    }
};

exports.confirmPayment = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { payment_id, payment_intent_id, paypal_order_id } = req.body;

        const payment = await Payment.getById(payment_id);
        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        if (payment.tenant_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const updates = {};
        if (payment_intent_id) updates.stripe_payment_intent_id = payment_intent_id;
        if (paypal_order_id) updates.paypal_order_id = paypal_order_id;

        await Payment.updateStatus(payment_id, 'completed', updates);

        const updated = await Payment.getById(payment_id);

        try {
            const pdfBuffer = await generateReceiptBuffer(updated);
            const idrive = require('../utils/idriveService');
            const receiptKey = await idrive.uploadReceipt(pdfBuffer, payment_id);
            const signed = await idrive.getSignedPdfUrl(receiptKey);
            const receiptUpdates = { ...updates, receipt_url: receiptKey };
            if (signed) {
                receiptUpdates.receipt_signed_url = signed.signedUrl;
                receiptUpdates.receipt_url_expires_at = signed.expiresAt;
            }
            await Payment.updateStatus(payment_id, 'completed', receiptUpdates);
            updated.receipt_url = receiptKey;
        } catch (pdfErr) {
            console.error('Error generating/uploading receipt PDF:', pdfErr.message);
        }

        try {
            const [tenant] = await db.query('SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?', [userId]);
            const [landlord] = await db.query('SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?', [payment.landlord_id]);
            const contract = await Contract.getById(payment.agreement_id);
            const [apt] = await db.query('SELECT direccion_apt FROM apartments WHERE id_apt = ?', [contract?.property_id]);

            let receiptLink = '';
            if (updated.receipt_signed_url) {
                receiptLink = updated.receipt_signed_url;
            } else if (updated.receipt_url && !updated.receipt_url.startsWith('/payments/')) {
                const idrive = require('../utils/idriveService');
                const signed = await idrive.getSignedPdfUrl(updated.receipt_url);
                receiptLink = signed?.signedUrl || '';
            }

            if (tenant.length > 0) {
                sendPaymentConfirmationEmail(
                    tenant[0].user_email,
                    tenant[0].user_name,
                    tenant[0].user_lastname,
                    updated.amount,
                    apt[0]?.direccion_apt || 'Vivienda',
                    updated.payment_id,
                    receiptLink
                ).catch(e => console.error('Error sending confirmation email:', e.message));
            }
            if (landlord.length > 0) {
                sendPaymentConfirmationEmail(
                    landlord[0].user_email,
                    landlord[0].user_name,
                    landlord[0].user_lastname,
                    updated.amount,
                    apt[0]?.direccion_apt || 'Vivienda',
                    updated.payment_id,
                    receiptLink,
                    true
                ).catch(e => console.error('Error sending confirmation to landlord:', e.message));
            }
        } catch (emailErr) {
            console.error('Error sending payment emails:', emailErr.message);
        }

        res.json({
            message: 'Pago confirmado exitosamente',
            payment: PaymentDTO.fromDatabase(updated)
        });

    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: 'Error al confirmar el pago', message: error.message });
    }
};

exports.getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const userRole = req.user?.rol;

        let payments;
        if (userRole === 2) {
            payments = await Payment.getByLandlord(userId);
        } else {
            payments = await Payment.getByTenant(userId);
        }

        res.json(PaymentDTO.fromDatabaseList(payments));

    } catch (error) {
        console.error('Error getting payment history:', error);
        res.status(500).json({ error: 'Error al obtener historial de pagos' });
    }
};

exports.getPaymentStats = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const stats = await Payment.getPaymentStats(userId);
        res.json(stats);
    } catch (error) {
        console.error('Error getting payment stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de pagos' });
    }
};

exports.downloadReceipt = async (req, res) => {
    try {
        const { payment_id } = req.params;
        const userId = req.user?.id || req.user?.userId;

        const payment = await Payment.getById(payment_id);
        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        if (payment.tenant_id !== userId && payment.landlord_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        if (payment.receipt_url && !payment.receipt_url.startsWith('/payments/')) {
            const idrive = require('../utils/idriveService');
            const isExpired = !payment.receipt_url_expires_at || (new Date(payment.receipt_url_expires_at).getTime() - 3600000 < Date.now());
            if (payment.receipt_signed_url && !isExpired) {
                return res.json({ url: payment.receipt_signed_url, expiresAt: payment.receipt_url_expires_at });
            }
            const result = await idrive.getSignedPdfUrl(payment.receipt_url);
            if (result) {
                await Payment.updateStatus(payment_id, payment.status, {
                    receipt_signed_url: result.signedUrl,
                    receipt_url_expires_at: result.expiresAt
                });
                return res.json({ url: result.signedUrl, expiresAt: result.expiresAt });
            }
        }

        const pdfBuffer = await generateReceiptBuffer(payment);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=recibo_pago_${payment_id}.pdf`);
        res.setHeader('Content-Security-Policy', "default-src 'self'");
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error downloading receipt:', error);
        res.status(500).json({ error: 'Error al descargar recibo' });
    }
};

exports.getPaymentsByAgreement = async (req, res) => {
    try {
        const { agreement_id } = req.params;
        const payments = await Payment.getByAgreement(agreement_id);
        res.json(PaymentDTO.fromDatabaseList(payments));
    } catch (error) {
        console.error('Error getting payments by agreement:', error);
        res.status(500).json({ error: 'Error al obtener pagos del contrato' });
    }
};

exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret && stripe) {
            return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET no configurado' });
        }

        if (webhookSecret && stripe) {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
            // Modo simulado: aceptar eventos sin verificar
            event = req.body;
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    console.log(`[Webhook] Evento recibido: ${event.type}`);

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                const paymentIntentId = paymentIntent.id;

                const [payments] = await db.query(
                    'SELECT * FROM payments WHERE stripe_payment_intent_id = ?',
                    [paymentIntentId]
                );

                if (payments.length === 0) {
                    console.log(`[Webhook] No se encontró payment con intent_id: ${paymentIntentId}`);
                    return res.json({ received: true });
                }

                const payment = payments[0];
                if (payment.status === 'completed') {
                    console.log(`[Webhook] Payment ${payment.payment_id} ya estaba completado`);
                    return res.json({ received: true });
                }

                await Payment.updateStatus(payment.payment_id, 'completed', {
                    stripe_payment_intent_id: paymentIntentId
                });

                const updated = await Payment.getById(payment.payment_id);

                try {
                    await generateReceiptBuffer(updated);
                    await Payment.updateStatus(payment.payment_id, 'completed', {
                        receipt_url: '/payments/receipt/' + payment.payment_id,
                        stripe_payment_intent_id: paymentIntentId
                    });
                    updated.receipt_url = '/payments/receipt/' + payment.payment_id;
                } catch (pdfErr) {
                    console.error('[Webhook] Error generando recibo PDF:', pdfErr.message);
                }

                try {
                    const [tenant] = await db.query(
                        'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                        [payment.tenant_id]
                    );
                    const [landlord] = await db.query(
                        'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                        [payment.landlord_id]
                    );
                    const contract = await Contract.getById(payment.agreement_id);
                    const [apt] = await db.query(
                        'SELECT direccion_apt FROM apartments WHERE id_apt = ?',
                        [contract?.property_id]
                    );

                    if (tenant.length > 0) {
                        sendPaymentConfirmationEmail(
                            tenant[0].user_email, tenant[0].user_name, tenant[0].user_lastname,
                            updated.amount, apt[0]?.direccion_apt || 'Vivienda',
                            updated.payment_id, updated.receipt_url
                        ).catch(e => console.error('[Webhook] Error email tenant:', e.message));
                    }
                    if (landlord.length > 0) {
                        sendPaymentConfirmationEmail(
                            landlord[0].user_email, landlord[0].user_name, landlord[0].user_lastname,
                            updated.amount, apt[0]?.direccion_apt || 'Vivienda',
                            updated.payment_id, updated.receipt_url, true
                        ).catch(e => console.error('[Webhook] Error email landlord:', e.message));
                    }
                } catch (emailErr) {
                    console.error('[Webhook] Error enviando correos:', emailErr.message);
                }

                console.log(`[Webhook] Payment ${payment.payment_id} marcado como completado`);
                break;
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object;
                const [payments] = await db.query(
                    'SELECT * FROM payments WHERE stripe_payment_intent_id = ?',
                    [paymentIntent.id]
                );
                if (payments.length > 0) {
                    await Payment.updateStatus(payments[0].payment_id, 'failed');
                    console.log(`[Webhook] Payment ${payments[0].payment_id} marcado como fallido`);
                }
                break;
            }

            default:
                console.log(`[Webhook] Tipo de evento no manejado: ${event.type}`);
        }
    } catch (err) {
        console.error('[Webhook] Error procesando evento:', err.message);
    }

    res.json({ received: true });
};

exports.createPayPalOrder = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { agreement_id } = req.body;

        const contract = await Contract.getById(agreement_id);
        if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });

        const completedPayments = await Payment.getCompletedCountByAgreement(agreement_id);
        const isFirstPayment = completedPayments === 0;
        const depositAmount = Number(contract.deposit_amount || 0);
        let effectiveAmount = Number(contract.monthly_rent);
        if (isFirstPayment && depositAmount > 0) {
            effectiveAmount = Math.max(0, effectiveAmount - depositAmount);
        }

        const order = await createPayPalOrder(effectiveAmount);
        if (!order) {
            return res.status(400).json({ error: 'PayPal no configurado. Usa modo simulado.' });
        }

        const payment = await Payment.create({
            agreement_id,
            tenant_id: userId,
            landlord_id: contract.landlord_id,
            amount: effectiveAmount,
            payment_method: 'paypal',
            status: 'pending',
            paypal_order_id: order.id
        });

        res.json({ orderID: order.id, payment_id: payment.payment_id });
    } catch (error) {
        console.error('Error creating PayPal order:', error);
        res.status(500).json({ error: 'Error al crear orden PayPal' });
    }
};

exports.capturePayPalOrder = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { payment_id, order_id } = req.body;

        const capture = await captureOrder(order_id);
        if (!capture) {
            return res.status(400).json({ error: 'PayPal no configurado' });
        }

        if (capture.status !== 'COMPLETED') {
            return res.status(400).json({ error: 'El pago no fue completado' });
        }

        const payment = await Payment.getById(payment_id);
        if (!payment) return res.status(404).json({ error: 'Pago no encontrado' });
        if (payment.tenant_id !== userId) return res.status(403).json({ error: 'No autorizado' });

        await Payment.updateStatus(payment_id, 'completed', { paypal_order_id: order_id });

        const updated = await Payment.getById(payment_id);
        try {
            await generateReceiptBuffer(updated);
            await Payment.updateStatus(payment_id, 'completed', {
                paypal_order_id: order_id,
                receipt_url: '/payments/receipt/' + payment_id
            });
        } catch (pdfErr) {
            console.error('Error generating receipt PDF:', pdfErr.message);
        }

        try {
            const [tenant] = await db.query('SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?', [userId]);
            const [landlord] = await db.query('SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?', [payment.landlord_id]);
            const contract = await Contract.getById(payment.agreement_id);
            const [apt] = await db.query('SELECT direccion_apt FROM apartments WHERE id_apt = ?', [contract?.property_id]);

            if (tenant.length > 0) {
                sendPaymentConfirmationEmail(tenant[0].user_email, tenant[0].user_name, tenant[0].user_lastname,
                    updated.amount, apt[0]?.direccion_apt || 'Vivienda', updated.payment_id, updated.receipt_url
                ).catch(() => {});
            }
            if (landlord.length > 0) {
                sendPaymentConfirmationEmail(landlord[0].user_email, landlord[0].user_name, landlord[0].user_lastname,
                    updated.amount, apt[0]?.direccion_apt || 'Vivienda', updated.payment_id, updated.receipt_url, true
                ).catch(() => {});
            }
        } catch (emailErr) {
            console.error('Error sending PayPal confirmation emails:', emailErr.message);
        }

        res.json({
            message: 'Pago con PayPal confirmado exitosamente',
            payment: PaymentDTO.fromDatabase(updated)
        });
    } catch (error) {
        console.error('Error capturing PayPal order:', error);
        res.status(500).json({ error: 'Error al capturar orden PayPal' });
    }
};
