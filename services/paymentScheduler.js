const cron = require('node-cron');
const Payment = require('../models/PaymentModel');
const db = require('../config/db');
const { sendPaymentReminderEmail } = require('../utils/emailService');

function startPaymentReminderScheduler() {
    console.log('[CRON] Iniciando recordatorio automático de pagos');

    cron.schedule('0 8 * * *', async () => {
        console.log('[CRON] Ejecutando recordatorio de pagos próximos a vencer...');
        try {
            const upcoming = await Payment.getUpcomingPayments(5);

            for (const contract of upcoming) {
                try {
                    await sendPaymentReminderEmail(
                        contract.tenant_email,
                        contract.tenant_name,
                        contract.tenant_lastname,
                        contract.monthly_rent,
                        contract.direccion_apt,
                        contract.barrio,
                        contract.end_date
                    );
                    console.log(`[CRON] Recordatorio enviado a ${contract.tenant_email}`);
                } catch (emailErr) {
                    console.error(`[CRON] Error enviando recordatorio a ${contract.tenant_email}:`, emailErr.message);
                }
            }

            console.log(`[CRON] Recordatorios enviados: ${upcoming.length}`);
        } catch (error) {
            console.error('[CRON] Error en recordatorio de pagos:', error);
        }
    });

    console.log('[CRON] Recordatorio programado: 8:00 AM todos los días');
}

module.exports = { startPaymentReminderScheduler };
