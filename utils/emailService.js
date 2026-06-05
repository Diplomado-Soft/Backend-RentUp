const { Resend } = require('resend');
const path = require('path');
const { create } = require('express-handlebars');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'RentUp <info@rentup.fun>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const VIEWS_DIR = path.join(__dirname, '..', 'handlebars');

const hbs = create({
    extname: '.hbs',
    defaultLayout: false,
    partialsDir: path.join(VIEWS_DIR, 'partials'),
    helpers: {
        formatCurrency(value) {
            return Number(value).toLocaleString('es-CO');
        },
        formatDate(dateString) {
            if (!dateString) return '';
            return new Date(dateString).toLocaleDateString('es-CO');
        },
        eq(a, b) {
            return a === b;
        },
        gt(a, b) {
            return a > b;
        },
        priorityLabel(priority) {
            const labels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
            return labels[priority] || priority;
        },
        todayDate() {
            return new Date().toLocaleDateString('es-CO');
        }
    }
});

const renderTemplate = async (templateName, context) => {
    return hbs.render(path.join(VIEWS_DIR, `${templateName}.hbs`), context);
};

const sendWelcomeEmail = async (email, nombre, apellido) => {
    try {
        console.log('Intentando enviar correo vía Resend a:', email);

        const html = await renderTemplate('welcome', { nombre, apellido, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '¡Bienvenido a RentUp!',
            html
        });

        if (error) {
            console.error('Error en servicio de correo Resend:', error.message);
            return { success: false, error };
        }

        console.log('Correo enviado exitosamente:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error en servicio de correo Resend:', error.message);
        return { success: false, error };
    }
};

const sendContractAgreementEmail = async (email, nombre, apellido, aptName, startDate, endDate, rent, isLandlord = false) => {
    try {
        console.log('Enviando correo de contrato a:', email);

        const html = await renderTemplate('contractAgreement', { nombre, apellido, aptName, startDate, endDate, rent, isLandlord, frontendUrl: FRONTEND_URL, contratoUrl: `${FRONTEND_URL}/dashboard?tab=documentos` });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '¡Contrato de arrendamiento concretado!',
            html
        });

        if (error) {
            console.error('Error enviando correo de contrato:', error.message);
            return { success: false, error };
        }

        console.log('Correo de contrato enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de contrato:', error.message);
        return { success: false, error };
    }
};

const sendApartmentRejectionEmail = async (email, nombre, apellido, direccionApt, motivo) => {
    try {
        console.log('Enviando correo de rechazo a:', email);

        const html = await renderTemplate('apartmentRejection', { nombre, apellido, direccion: direccionApt, motivo, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Apartamento rechazado - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando correo de rechazo:', error.message);
            return { success: false, error };
        }

        console.log('Correo de rechazo enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de rechazo:', error.message);
        return { success: false, error };
    }
};

const sendApartmentApprovalEmail = async (email, nombre, apellido, direccionApt) => {
    try {
        console.log('Enviando correo de aprobación a:', email);

        const html = await renderTemplate('apartmentApproval', { nombre, apellido, direccion: direccionApt, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '¡Apartamento aprobado! - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando correo de aprobación:', error.message);
            return { success: false, error };
        }

        console.log('Correo de aprobación enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de aprobación:', error.message);
        return { success: false, error };
    }
};

const sendUserBlockEmail = async (email, nombre, apellido, motivo) => {
    try {
        const html = await renderTemplate('userBlock', { nombre, apellido, motivo, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Tu cuenta ha sido bloqueada - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando correo de bloqueo:', error.message);
            return { success: false, error };
        }

        console.log('Correo de bloqueo enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de bloqueo:', error.message);
        return { success: false, error };
    }
};

const sendPasswordResetEmail = async (email, nombre, apellido, resetCode) => {
    try {
        const html = await renderTemplate('passwordReset', { nombre, apellido, resetCode, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Restablecer contraseña - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando correo de reseteo:', error.message);
            return { success: false, error };
        }

        console.log('Correo de reseteo enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de reseteo:', error.message);
        return { success: false, error };
    }
};

const sendEmailAccountDelete = async (email, nombre, apellido, reactivationDate) => {
    try {
        const html = await renderTemplate('accountDelete', { nombre, apellido, reactivationDate, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Tu cuenta fue eliminada - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando correo de eliminar cuenta:', error.message);
            return { success: false, error };
        }

        console.log("Correo de cuenta eliminada enviado");
        return { success: true, info: data };
    } catch (error) {
        console.log("Error al enviar el correo de eliminar cuenta");
        return { success: false, error };
    }
};

const sendReviewRejectionEmail = async (email, nombre, apellido, direccion, motivo) => {
    try {
        const html = await renderTemplate('reviewRejected', { nombre, apellido, direccion, motivo, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Tu reseña fue eliminada por contenido inapropiado - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando correo de reseña rechazada:', error.message);
            return { success: false, error };
        }

        console.log('Correo de reseña rechazada enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de reseña rechazada:', error.message);
        return { success: false, error };
    }
};

const sendMaintenanceNotificationEmail = async (email, nombre, apellido, report) => {
    try {
        const html = await renderTemplate('maintenanceNotification', { nombre, apellido, report, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: `Nuevo reporte de mantenimiento - ${report.title}`,
            html
        });

        if (error) {
            console.error('Error enviando correo de mantenimiento:', error.message);
            return { success: false, error };
        }

        console.log('Correo de mantenimiento enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de mantenimiento:', error.message);
        return { success: false, error };
    }
};

const sendPaymentConfirmationEmail = async (email, nombre, apellido, amount, direccion, paymentId, receiptUrl, isLandlord = false) => {
    try {
        const html = await renderTemplate('paymentConfirmation', { nombre, apellido, amount, direccion, paymentId, receiptUrl, isLandlord, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: `${isLandlord ? 'Pago recibido' : 'Pago confirmado'} - RentUp`,
            html
        });

        if (error) {
            console.error('Error enviando correo de pago:', error.message);
            return { success: false, error };
        }

        console.log('Correo de pago enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de pago:', error.message);
        return { success: false, error };
    }
};

const sendPaymentReminderEmail = async (email, nombre, apellido, amount, direccion, barrio, dueDate) => {
    try {
        const daysLeft = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        const html = await renderTemplate('paymentReminder', { nombre, apellido, amount, direccion, barrio, dueDate, daysLeft, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Recordatorio de pago prximo - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando recordatorio de pago:', error.message);
            return { success: false, error };
        }

        console.log('Recordatorio de pago enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando recordatorio de pago:', error.message);
        return { success: false, error };
    }
};

const sendContractExpirationEmail = async (email, nombre, apellido, direccion, barrio, endDate) => {
    try {
        const html = await renderTemplate('contractExpiration', { nombre, apellido, direccion, barrio, endDate, frontendUrl: FRONTEND_URL, contratoUrl: `${FRONTEND_URL}/dashboard?tab=documentos` });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Tu contrato de arriendo ha vencido - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando correo de vencimiento:', error.message);
            return { success: false, error };
        }

        console.log('Correo de vencimiento enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de vencimiento:', error.message);
        return { success: false, error };
    }
};

const sendContractSignedEmail = async (email, nombre, apellido, aptDireccion, agreementId, isLandlord = false) => {
    try {
        const role = isLandlord ? 'arrendador' : 'inquilino';
        const subject = isLandlord
            ? 'Tu inquilino ha firmado el contrato - RentUp'
            : 'Tu arrendador ha firmado el contrato - RentUp';

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Contrato Firmado - RentUp</title>
                <style>
                    body { margin: 0; padding: 0; background-color: #e5e7eb; font-family: Inter, Arial, sans-serif; }
                    table { border-spacing: 0; }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #e5e7eb;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e5e7eb">
                    <tr>
                        <td align="center" style="padding: 40px 16px;">
                            <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #faf8f3; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(14,26,43,0.04), 0 8px 24px -12px rgba(14,26,43,0.12);">

                                <!-- HEADER -->
                                <tr>
                                    <td bgcolor="#2E5A88" style="padding: 20px 32px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="font-family: Manrope, Arial, sans-serif; font-size: 20px; font-weight: 700; color: #ffffff;"><img src="data:image/png;base64,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" alt="RentUp" style="display: inline-block; vertical-align: middle;"></td>
                                                <td align="right" style="font-family: Manrope, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #B3C8E0; text-transform: uppercase; letter-spacing: 0.05em;">Contrato Firmado</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- HERO -->
                                <tr>
                                    <td bgcolor="#ffffff" style="padding: 48px 32px 32px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td align="center" style="padding-bottom: 24px;">
                                                    <table cellpadding="0" cellspacing="0" border="0" style="width: 80px; height: 80px; border-radius: 50%; background-color: rgba(46,90,136,0.1);">
                                                        <tr>
                                                            <td align="center" style="font-size: 40px; line-height: 80px; color: #2E5A88;">&#x270D;&#xFE0F;</td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="font-family: Manrope, Arial, sans-serif; font-size: 28px; font-weight: 800; color: #2E5A88; padding-bottom: 12px;">
                                                    \u00A1Contrato firmado exitosamente!
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="font-family: Inter, Arial, sans-serif; font-size: 17px; color: rgba(14,26,43,0.7); line-height: 1.6;">
                                                    Tu ${role} ha firmado el contrato digitalmente.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- MAIN CONTENT -->
                                <tr>
                                    <td bgcolor="#ffffff" style="padding: 0 32px 48px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #faf8f3; border-radius: 12px; border: 1px solid #e5e7eb;">
                                            <tr>
                                                <td style="padding: 32px;">

                                                    <!-- Property address -->
                                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td width="32" valign="top" style="font-size: 20px; color: #2E5A88;">&#x1F4CD;</td>
                                                            <td>
                                                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                                    <tr>
                                                                        <td style="font-family: Manrope, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #2E5A88; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Propiedad</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td style="font-family: Inter, Arial, sans-serif; font-size: 16px; font-weight: 500; color: #0e1a2b;">${aptDireccion}</td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>

                                                    <!-- Divider -->
                                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td style="padding-top: 24px; padding-bottom: 24px; border-top: 1px solid #e5dfd2; line-height: 1px; height: 1px;">&nbsp;</td>
                                                        </tr>
                                                    </table>

                                                    <!-- Description -->
                                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; color: rgba(14,26,43,0.7); line-height: 1.7; padding-bottom: 12px;">
                                                                La propiedad <strong style="color: #0e1a2b;">${aptDireccion}</strong> ya tiene una firma registrada en nuestro sistema de arrendamiento estudiantil.
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; color: rgba(14,26,43,0.7); line-height: 1.7; padding-bottom: 24px;">
                                                                Este es un paso crucial para asegurar tu alquiler. <strong style="color: #2E5A88;">Cuando ambas partes hayan firmado</strong> el documento electr\u00F3nico, recibir\u00E1s autom\u00E1ticamente una copia certificada del contrato final en formato PDF en tu correo electr\u00F3nico.
                                                            </td>
                                                        </tr>
                                                    </table>

                                                    <!-- CTA -->
                                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                        <tr>
                                                            <td align="center">
                                                                <table cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #3f2acc, #5849e4); border-radius: 999px;">
                                                                    <tr>
                                                                        <td align="center" style="padding: 16px 40px;">
                                                                            <a href="${FRONTEND_URL}/dashboard?tab=documentos" style="color: #ffffff; text-decoration: none; font-family: Manrope, Arial, sans-serif; font-size: 15px; font-weight: 700; display: inline-block; line-height: 1.4;">Ver contrato</a>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>

                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Info Grid -->
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                                            <tr>
                                                <td width="50%" valign="top" style="padding-right: 8px;">
                                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.1); border-radius: 8px;">
                                                        <tr>
                                                            <td style="padding: 16px;">
                                                                <table cellpadding="0" cellspacing="0" border="0">
                                                                    <tr>
                                                                        <td style="font-size: 20px; color: #10B981; padding-bottom: 8px;">&#x2714;&#xFE0F;</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td style="font-family: Manrope, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #10B981; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Estatus Legal</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; color: #0e1a2b;">Firma v\u00E1lida y vinculante</td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td width="50%" valign="top" style="padding-left: 8px;">
                                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: rgba(46,90,136,0.05); border: 1px solid rgba(46,90,136,0.1); border-radius: 8px;">
                                                        <tr>
                                                            <td style="padding: 16px;">
                                                                <table cellpadding="0" cellspacing="0" border="0">
                                                                    <tr>
                                                                        <td style="font-size: 20px; color: #2E5A88; padding-bottom: 8px;">&#x23F3;</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td style="font-family: Manrope, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #2E5A88; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px;">Siguiente Paso</td>
                                                                    </tr>
                                                                    <tr>
                                                                        <td style="font-family: Inter, Arial, sans-serif; font-size: 14px; color: #0e1a2b;">Pendiente firma del propietario</td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- FOOTER -->
                                <tr>
                                    <td bgcolor="#faf8f3" style="padding: 32px 32px 24px; border-top: 1px solid #e5dfd2;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td align="center" style="font-family: Manrope, Arial, sans-serif; font-size: 18px; font-weight: 700; color: #2E5A88; padding-bottom: 16px;">RentUp</td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="font-family: Inter, Arial, sans-serif; font-size: 12px; padding-bottom: 16px;">
                                                    <table cellpadding="0" cellspacing="0" border="0" align="center">
                                                        <tr>
                                                            <td style="padding: 0 12px;"><a href="#" style="color: rgba(14,26,43,0.6); text-decoration: none; font-family: Inter, Arial, sans-serif;">Soporte</a></td>
                                                            <td style="padding: 0 12px;"><a href="#" style="color: rgba(14,26,43,0.6); text-decoration: none; font-family: Inter, Arial, sans-serif;">T\u00E9rminos</a></td>
                                                            <td style="padding: 0 12px;"><a href="#" style="color: rgba(14,26,43,0.6); text-decoration: none; font-family: Inter, Arial, sans-serif;">Privacidad</a></td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="font-family: Inter, Arial, sans-serif; font-size: 11px; color: rgba(14,26,43,0.4); line-height: 1.6; font-style: italic; padding-bottom: 12px;">
                                                    Est\u00E1s recibiendo este correo porque formas parte de la plataforma de arrendamiento RentUp. Por favor, no respondas a este mensaje generado autom\u00E1ticamente.
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="font-family: Inter, Arial, sans-serif; font-size: 12px; color: #0e1a2b;">
                                                    &copy; 2024 RentUp - Arrendamiento Estudiantil
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;


        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject,
            html
        });

        if (error) {
            console.error('Error enviando correo de firma:', error.message);
            return { success: false, error };
        }

        console.log('Correo de firma enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de firma:', error.message);
        return { success: false, error };
    }
};

const sendContractRenewalEmail = async (email, nombre, apellido, aptDireccion, newEndDate, monthsToAdd) => {
    try {
        const html = await renderTemplate('contractRenewal', { nombre, apellido, aptDireccion, newEndDate, monthsToAdd, contratoUrl: `${FRONTEND_URL}/dashboard?tab=documentos`, frontendUrl: FRONTEND_URL });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Contrato renovado exitosamente - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando correo de renovación:', error.message);
            return { success: false, error };
        }

        console.log('Correo de renovación enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de renovación:', error.message);
        return { success: false, error };
    }
};

const sendContractCancelledEmail = async (email, nombre, apellido, direccion, barrio) => {
    try {
        const html = await renderTemplate('contractCancellation', { nombre, apellido, direccion, barrio, frontendUrl: FRONTEND_URL, contratoUrl: `${FRONTEND_URL}/dashboard?tab=documentos` });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Contrato cancelado por falta de firmas - RentUp',
            html
        });

        if (error) {
            console.error('Error enviando correo de cancelacion:', error.message);
            return { success: false, error };
        }

        console.log('Correo de cancelacion enviado:', data?.id);
        return { success: true, info: data };
    } catch (error) {
        console.error('Error enviando correo de cancelacion:', error.message);
        return { success: false, error };
    }
};

module.exports = {
    sendWelcomeEmail,
    sendContractAgreementEmail,
    sendApartmentRejectionEmail,
    sendApartmentApprovalEmail,
    sendUserBlockEmail,
    sendPasswordResetEmail,
    sendEmailAccountDelete,
    sendReviewRejectionEmail,
    sendMaintenanceNotificationEmail,
    sendPaymentConfirmationEmail,
    sendPaymentReminderEmail,
    sendContractExpirationEmail,
    sendContractRenewalEmail,
    sendContractSignedEmail,
    sendContractCancelledEmail
};