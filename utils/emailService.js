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

const sendPasswordResetEmail = async (email, nombre, apellido, resetCode) => {
    try {
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Restablecer contraseña - RentUp',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                    <h2 style="color: #4a90e2;">Restablecer contraseña</h2>
                    <p>Hola ${nombre} ${apellido},</p>
                    <p>Recibimos una solicitud para restablecer tu contraseña en RentUp.</p>
                    <p>Tu código de verificación es: <strong style="font-size: 1.2em;">${resetCode}</strong></p>
                    <p>Este código expirará en 10 minutos.</p>
                    <p>Si no solicitaste este cambio, ignora este correo.</p>
                </div>
            `
        });
        console.log('Correo de reseteo enviado:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error enviando correo de reseteo:', error.message);
        return { success: false, error };
    }
};

const sendEmailAccountDelete = async (email, nombre, apellido, reactivationDate) => {
    try {
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Tu cienta fue eliminada - RentUp',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                    <h2 style="color: #e74c3c;">Cuenta eliminada temporalmente</h2>
                    <p>Hola ${nombre} ${apellido},</p>

                    <p>Recibimos la solicitud de eliminación de tu cuenta asociada a Google y tu cuenta fue desactivada temporalmente.</p>

                    <div style="background-color:#fff3f3; padding:16px; border-radius:8px; margin:20px 0; border-left:4px solid #e74c3c;">
                        <p style="margin:0;">
                            <strong>Reactivación:</strong> podrás iniciar sesión nuevamente a partir del
                            <strong>${reactivationDate}</strong> (15 días).
                        </p>
                    </div>

                    <p>Si no reconoces esta acción, por favor contacta al soporte.</p>

                    <hr style="margin-top: 30px;" />
                    <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        });

        console.log("Correo de cuenta eliminada enviado");
        return { success: true, info };
    } catch (error) {
        console.log("Error al enviar el correo de eliminar cuenta");
        return { success: false, error };
    }
};

const sendMaintenanceNotificationEmail = async (email, nombre, apellido, report) => {
    try {
        const priorityLabels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: `🔧 Nuevo reporte de mantenimiento - ${report.title}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                    <h2 style="color: #e67e22;">Nuevo reporte de mantenimiento</h2>
                    <p>Hola ${nombre} ${apellido},</p>
                    <p>Un inquilino ha reportado un problema en una de tus propiedades.</p>
                    <div style="background-color: #fef9e7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e67e22;">
                        <p><strong>Título:</strong> ${report.title}</p>
                        <p><strong>Descripción:</strong> ${report.description || 'Sin descripción'}</p>
                        <p><strong>Prioridad:</strong> ${priorityLabels[report.priority] || report.priority}</p>
                        <p><strong>Fecha:</strong> ${new Date(report.created_at || Date.now()).toLocaleDateString('es-CO')}</p>
                    </div>
                    <p>Ingresa a tu panel para gestionar este reporte.</p>
                    <p><strong>RentUp</strong></p>
                    <hr style="margin-top: 30px;" />
                    <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        });
        console.log('Correo de mantenimiento enviado:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error enviando correo de mantenimiento:', error.message);
        return { success: false, error };
    }
};

const sendPaymentConfirmationEmail = async (email, nombre, apellido, amount, direccion, paymentId, receiptUrl, isLandlord = false) => {
    try {
        const roleLabel = isLandlord ? 'Tu inquilino ha realizado un pago' : 'Has realizado un pago exitosamente';
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: `${
                isLandlord ? '💰 Pago recibido' : '✅ Pago confirmado'
            } - RentUp`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                    <h2 style="color: #059669;">${
                        isLandlord ? '💰 Pago recibido' : '✅ Pago confirmado'
                    }</h2>
                    <p>Hola ${nombre} ${apellido},</p>
                    <p>${roleLabel}:</p>
                    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
                        <p style="margin:0;"><strong>Monto:</strong> $${Number(amount).toLocaleString('es-CO')}</p>
                        <p style="margin:8px 0 0 0;"><strong>Vivienda:</strong> ${direccion}</p>
                        <p style="margin:8px 0 0 0;"><strong>Recibo N°:</strong> ${paymentId}</p>
                        <p style="margin:8px 0 0 0;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CO')}</p>
                    </div>
                    ${receiptUrl ? `
                    <div style="text-align:center; margin: 20px 0;">
                        <a href="${receiptUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Descargar Recibo PDF</a>
                    </div>` : ''}
                    <p><strong>RentUp</strong> - Tu plataforma de confianza.</p>
                    <hr style="margin-top: 30px;" />
                    <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        });
        console.log('Correo de pago enviado:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error enviando correo de pago:', error.message);
        return { success: false, error };
    }
};

const sendPaymentReminderEmail = async (email, nombre, apellido, amount, direccion, barrio, dueDate) => {
    try {
        const daysLeft = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: '🔔 Recordatorio de pago próximo - RentUp',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                    <h2 style="color: #d97706;">🔔 Recordatorio de pago</h2>
                    <p>Hola ${nombre} ${apellido},</p>
                    <p>Tu pago de arriendo está próximo a vencer:</p>
                    <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706;">
                        <p style="margin:0;"><strong>Vivienda:</strong> ${direccion}${barrio ? ` (${barrio})` : ''}</p>
                        <p style="margin:8px 0 0 0;"><strong>Monto:</strong> $${Number(amount).toLocaleString('es-CO')}</p>
                        <p style="margin:8px 0 0 0;"><strong>Vence en:</strong> ${daysLeft > 0 ? `${daysLeft} días` : 'Hoy'}</p>
                        <p style="margin:8px 0 0 0;"><strong>Fecha límite:</strong> ${new Date(dueDate).toLocaleDateString('es-CO')}</p>
                    </div>
                    <p>Realiza tu pago a tiempo para evitar cargos adicionales.</p>
                    <p>Puedes pagar desde tu panel de RentUp.</p>
                    <p><strong>RentUp</strong> - Tu plataforma de confianza.</p>
                    <hr style="margin-top: 30px;" />
                    <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        });
        console.log('Recordatorio de pago enviado:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error enviando recordatorio de pago:', error.message);
        return { success: false, error };
    }
};

const sendContractExpirationEmail = async (email, nombre, apellido, direccion, barrio, endDate) => {
    try {
        const info = await transporter.sendMail({
            from: `"RentUp" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: '⚠️ Tu contrato de arriendo ha vencido - RentUp',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                    <h2 style="color: #b91c1c;">⚠️ Contrato vencido</h2>
                    <p>Hola ${nombre} ${apellido},</p>
                    <p>Tu contrato de arriendo ha vencido el ${new Date(endDate).toLocaleDateString('es-CO')}.</p>
                    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #b91c1c;">
                        <p style="margin:0;"><strong>Vivienda:</strong> ${direccion}${barrio ? ` (${barrio})` : ''}</p>
                        <p style="margin:8px 0 0 0;"><strong>Fecha de vencimiento:</strong> ${new Date(endDate).toLocaleDateString('es-CO')}</p>
                    </div>
                    <p>Tienes un período de gracia de 7 días para renovar tu contrato desde tu panel de RentUp.</p>
                    <p>Si no renuevas dentro de este período, la vivienda se marcará como disponible para nuevos inquilinos.</p>
                    <div style="margin: 25px 0;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/mis-arriendos"
                           style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Ir a mis contratos
                        </a>
                    </div>
                    <p><strong>RentUp</strong> - Tu plataforma de confianza.</p>
                    <hr style="margin-top: 30px;" />
                    <p style="font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas a este mensaje.</p>
                </div>
            `
        });
        console.log('Correo de vencimiento enviado:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error enviando correo de vencimiento:', error.message);
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
    sendContractExpirationEmail
};
