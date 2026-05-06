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

const sendApartmentRejectionEmail = async (email, nombre, apellido, direccionApt, motivo) => {
    try {
        console.log('Enviando correo de rechazo a:', email);
        
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Apartamento rechazado - RentUp',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc3545;">Lo sentimos ${nombre} ${apellido}</h2>
                    <p>Tu apartamento ubicado en <strong>${direccionApt}</strong> ha sido rechazado por nuestro equipo de administración.</p>
                    
                    <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                        <h3 style="color: #721c24; margin-top: 0;">Motivo del rechazo</h3>
                        <p style="margin-bottom: 0; color: #721c24;">${motivo}</p>
                    </div>
                    
                    <p>Por favor, revisa los requisitos y considera hacer las correcciones necesarias antes de volver a publicar tu apartamento.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="color: #333; margin-top: 0;">¿Qué puedes hacer?</h4>
                        <ul style="color: #555;">
                            <li>Verifica que la dirección sea correcta y exacta</li>
                            <li>Asegúrate de que las imágenes sean claras y muestren el inmueble</li>
                            <li>Proporciona una descripción detallada del apartamento</li>
                            <li>Confirma que el precio sea razonable para la zona</li>
                        </ul>
                    </div>
                    
                    <p>Si tienes preguntas sobre el rechazo o necesitas ayuda, no dudes en contactarnos.</p>
                    <p><strong>RentUp</strong> - Tu plataforma de confianza para arrendar cerca de la Uniputumayo.</p>
                    
                    <hr style="margin-top: 30px;" />
                    <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        });
        
        console.log('Correo de rechazo enviado:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error enviando correo de rechazo:', error.message);
        return { success: false, error };
    }
};

const sendApartmentApprovalEmail = async (email, nombre, apellido, direccionApt) => {
    try {
        console.log('Enviando correo de aprobación a:', email);
        
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: '¡Apartamento aprobado! - RentUp',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #28a745;">¡Felicidades ${nombre} ${apellido}!</h2>
                    <p>Tu apartamento ubicado en <strong>${direccionApt}</strong> ha sido <strong style="color: #28a745;">aprobado</strong> por nuestro equipo de administración.</p>
                    
                    <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                        <h3 style="color: #155724; margin-top: 0;">¡Tu apartamento ya está publicado!</h3>
                        <p style="margin-bottom: 0; color: #155724;">Ahora será visible para todos los estudiantes y usuarios interesados en arrendar cerca de la Uniputumayo.</p>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="color: #333; margin-top: 0;">¿Qué sigue ahora?</h4>
                        <ul style="color: #555;">
                            <li>Tu apartamento aparecerá en los resultados de búsqueda</li>
                            <li>Los inquilinos podrán ver tus fotos y descripción</li>
                            <li>Recibirás notificaciones cuando alguien esté interesado</li>
                            <li>Podrás gestionar contratos desde tu panel</li>
                        </ul>
                    </div>
                    
                    <p>Te recomendamos mantener tu información actualizada y responder pronto a las consultas de los interesados.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
                           style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Ir a mi panel
                        </a>
                    </div>
                    
                    <p><strong>RentUp</strong> - Tu plataforma de confianza para arrendar cerca de la Uniputumayo.</p>
                    
                    <hr style="margin-top: 30px;" />
                    <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        });
        
        console.log('Correo de aprobación enviado:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error enviando correo de aprobación:', error.message);
        return { success: false, error };
    }
};

const sendUserBlockEmail = async (email, nombre, apellido, motivo) => {
    try {
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Tu cuenta ha sido bloqueada - RentUp',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                    <h2 style="color: #e74c3c;">Cuenta bloqueada</h2>
                    <p>Hola ${nombre} ${apellido},</p>
                    <p>Tu cuenta en RentUp ha sido bloqueada por un administrador.</p>
                    <p><strong>Motivo:</strong> ${motivo}</p>
                    <p>Si tienes dudas, contacta al soporte.</p>
                </div>
            `
        });
        console.log('Correo de bloqueo enviado:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error enviando correo de bloqueo:', error.message);
        return { success: false, error };
    }
};

module.exports = { sendWelcomeEmail, sendContractAgreementEmail, sendApartmentRejectionEmail, sendApartmentApprovalEmail, sendUserBlockEmail };
