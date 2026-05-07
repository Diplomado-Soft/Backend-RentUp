const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Enviar código de reseteo por SMS
 */
const sendPasswordResetSMS = async (phoneNumber, code) => {
    try {
        // Asegurar formato E.164 (+código de país)
        let formattedPhone = phoneNumber.trim();
        if (!formattedPhone.startsWith('+')) {
            // Si no tiene +, asumimos Colombia (+57)
            if (formattedPhone.length === 10 && /^[13-7]\d{9}$/.test(formattedPhone)) {
                formattedPhone = '+57' + formattedPhone;
            } else {
                formattedPhone = '+' + formattedPhone;
            }
        }
        
        const message = await client.messages.create({
            body: `RentUp: Tu código para restablecer tu contraseña es: ${code}. Expira en 10 minutos.`,
            from: twilioPhoneNumber,
            to: formattedPhone
        });
        console.log('SMS enviado:', message.sid);
        return { success: true, messageSid: message.sid };
    } catch (error) {
        console.error('Error enviando SMS:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendPasswordResetSMS };
