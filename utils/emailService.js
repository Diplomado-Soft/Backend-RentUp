const nodemailer = require('nodemailer');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

console.log('GMAIL_USER:', process.env.GMAIL_USER);
console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '***' : 'NO DEFINIDO');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

const sendWelcomeEmail = async (email, nombre, apellido) => {
    try {
        console.log('Intentando enviar correo vía Gmail a:', email);
        
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: '¡Bienvenido a RentUp!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                    <h2 style="color: #4a90e2;">¡Bienvenido a RentUp, ${nombre} ${apellido}!</h2>
                    <p>Tu cuenta ha sido creada exitosamente.</p>
                    <p>Con RentUp puedes:</p>
                    <ul>
                        <li>Encontrar viviendas cerca de la Institución Universitaria del Putumayo</li>
                        <li>Conectar directamente con arrendadores</li>
                        <li>Gestionar contratos y pagos de manera segura</li>
                    </ul>
                    <p>Si tienes preguntas, no dudes en contactarnos.</p>
                    <p>¡Buena suerte en tu búsqueda!</p>
                    <hr style="margin-top: 30px;" />
                    <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        });

        console.log('Correo enviado exitosamente:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error en servicio de correo Gmail:', error.message);
        return { success: false, error };
    }
};

const sendContractAgreementEmail = async (email, nombre, apellido, aptName, startDate, endDate, rent, isLandlord = false) => {
    try {
        console.log('Enviando correo de contrato a:', email);
        
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: '¡Contrato de arrendamiento concretado!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                    <h2 style="color: #28a745;">¡Felicidades ${nombre} ${apellido}!</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Detalles del contrato</h3>
                        <p><strong>Vivienda:</strong> ${aptName}</p>
                        <p><strong>Fecha de inicio:</strong> ${startDate}</p>
                        <p><strong>Fecha de fin:</strong> ${endDate}</p>
                        <p><strong>Renta mensual:</strong> $${rent}</p>
                    </div>
                    <p>Has llegado a un acuerdo exitoso. Por favor, asegúrate de cumplir con todas las condiciones acordadas.</p>
                    <p>Si tienes preguntas sobre tu contrato, puedes contactarnos en cualquier momento.</p>
                    <p><strong>RentUp</strong> - Tu plataforma de confianza para arrendar cerca de la Uniputumayo.</p>
                    <hr style="margin-top: 30px;" />
                    <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        });

        console.log('Correo de contrato enviado:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error enviando correo de contrato:', error.message);
        return { success: false, error };
    }
};

module.exports = { sendWelcomeEmail, sendContractAgreementEmail };
