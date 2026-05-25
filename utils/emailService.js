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

        const html = await renderTemplate('welcome', { nombre, apellido });

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

        const html = await renderTemplate('contractAgreement', { nombre, apellido, aptName, startDate, endDate, rent, isLandlord });

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

        const html = await renderTemplate('apartmentRejection', { nombre, apellido, direccionApt, motivo });

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

        const html = await renderTemplate('apartmentApproval', { nombre, apellido, direccionApt, frontendUrl: FRONTEND_URL });

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
        const html = await renderTemplate('userBlock', { nombre, apellido, motivo });

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
        const html = await renderTemplate('passwordReset', { nombre, apellido, resetCode });

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
        const html = await renderTemplate('accountDelete', { nombre, apellido, reactivationDate });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Tu cienta fue eliminada - RentUp',
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

const sendMaintenanceNotificationEmail = async (email, nombre, apellido, report) => {
    try {
        const html = await renderTemplate('maintenanceNotification', { nombre, apellido, report });

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
        const html = await renderTemplate('paymentConfirmation', { nombre, apellido, amount, direccion, paymentId, receiptUrl, isLandlord });

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
        const html = await renderTemplate('paymentReminder', { nombre, apellido, amount, direccion, barrio, dueDate, daysLeft });

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
        const html = await renderTemplate('contractExpiration', { nombre, apellido, direccion, barrio, endDate, frontendUrl: FRONTEND_URL });

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

const sendContractRenewalEmail = async (email, nombre, apellido, aptDireccion, newEndDate, monthsToAdd) => {
    try {
        const html = await renderTemplate('contractRenewal', { nombre, apellido, aptDireccion, newEndDate, monthsToAdd });

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

module.exports = {
    sendWelcomeEmail,
    sendContractAgreementEmail,
    sendApartmentRejectionEmail,
    sendApartmentApprovalEmail,
    sendUserBlockEmail,
    sendPasswordResetEmail,
    sendEmailAccountDelete,
    sendMaintenanceNotificationEmail,
    sendPaymentConfirmationEmail,
    sendPaymentReminderEmail,
    sendContractExpirationEmail,
    sendContractRenewalEmail
};
