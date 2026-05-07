const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyFirebaseToken, revokeFirebaseToken } = require('../utils/firebaseService');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');
const { sendPasswordResetSMS } = require('../utils/smsService');
const { LoginDTO, LogoutDTO } = require('../dtos');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const FRONT_END_URL = process.env.FRONT_END_URL || 'http://localhost:3000';

/**
 * POST /auth/firebase-login
 * Recibe el Firebase ID Token, lo verifica, y genera un JWT de la app
 */
const firebaseLogin = async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);

    try {
        // Usar LoginDTO para validación
        const loginDTO = new LoginDTO(req.body);
        const validation = loginDTO.validate();
        
        if (!validation.isValid) {
            console.log(`❌ [${requestId}] Invalid login data:`, validation.errors);
            return res.status(400).json({ 
                error: 'Datos de login inválidos', 
                errors: validation.errors 
            });
        }

        const { firebaseToken, rolId, email, nombre, apellido, photoURL } = loginDTO.toFirebaseFormat();

        const validRoles = [1, 2]; // 1=usuario, 2=arrendador

        console.log(`\n📝 [${requestId}] Firebase login request:`, {
            hasToken: !!firebaseToken,
            rolId,
            email
        });

        // 1. Verificar Firebase token
        console.log(`🔐 [${requestId}] Verifying Firebase token...`);
        let decodedToken;
        try {
            decodedToken = await verifyFirebaseToken(firebaseToken);
            console.log(`✅ [${requestId}] Token verified for:`, decodedToken.email);
        } catch (tokenError) {
            console.error(`❌ [${requestId}] Token verification failed:`, {
                message: tokenError.message,
                errorInfo: tokenError.errorInfo,
                code: tokenError.code
            });
            
            // Return detailed error for debugging in development
            return res.status(401).json({ 
                error: 'Invalid Firebase token',
                message: tokenError.message,
                details: process.env.NODE_ENV === 'development' ? tokenError.message : 'Authentication failed',
                requestId
            });
        }

        const firebaseUid = decodedToken.uid;
        const firebaseEmail = decodedToken.email || email;

        if (!firebaseEmail) {
            return res.status(400).json({ error: 'Email requerido' });
        }

        // 🔍 2. Buscar usuario
        let [users] = await db.query(
            `SELECT U.*, UR.rol_id
             FROM users U
             LEFT JOIN user_rol UR ON U.user_id = UR.user_id
             WHERE U.user_email = ? OR U.user_google_id = ?
             LIMIT 1`,
            [firebaseEmail, firebaseUid]
        );

        let userId;
        let userData;
        let hasRol = false;
        let requiresRoleSelection;
        let appToken;
        let refreshToken;


        // ==============================
        // 👤 USUARIO EXISTENTE
        // ==============================
        if (users.length > 0) {
            userData = users[0];
            userId = userData.user_id;

            console.log(`👤 Usuario existente: ${userId}`);

            // 🔄 Reactivar si estaba eliminado
            if (!userData.is_active) {
                console.log(`🔄 Reactivando usuario...`);

                await db.query(
                    'UPDATE users SET is_active = TRUE WHERE user_id = ?',
                    [userId]
                );

                hasRol = false;
                userData.rol_id = null;
            }
            // Verificar si la cuenta está bloqueada
             if (users[0].is_active === false || users[0].is_active === 0) {
                 console.log(`[${requestId}] Cuenta bloqueada:`, userId);
                 return res.status(403).json({ 
                     success: false, 
                     error: 'Esta cuenta ha sido bloqueada. Contacta al administrador.' 
                 });
             }

            // 🔄 Actualizar datos Google
            if (!userData.user_google_id || !userData.profile_image) {
                await db.query(
                    'UPDATE users SET user_google_id = ?, profile_image = ? WHERE user_id = ?',
                    [firebaseUid, photoURL || decodedToken.picture || null, userId]
                );
            }

            // 🔍 Verificar rol actual
            const [roles] = await db.query(
                'SELECT rol_id FROM user_rol WHERE user_id = ?',
                [userId]
            );

            hasRol = roles.length > 0;

            // 👉 Si NO tiene rol y VIENE rolId → INSERTAR
            if (!hasRol && rolId && validRoles.includes(rolId)) {
                console.log(`🎭 Asignando rol: ${rolId}`);

                await db.query(
                    `INSERT INTO user_rol (user_id, rol_id, start_date)
                     VALUES (?, ?, NOW())`,
                    [userId, rolId]
                );

                hasRol = true;
                userData.rol_id = rolId;
            }
        }

        // ==============================
        // 🆕 USUARIO NUEVO
        // ==============================
        else {
            console.log(`✨ Creando usuario nuevo...`);

            const [result] = await db.query(
                `INSERT INTO users (user_name, user_lastname, user_email, user_google_id, profile_image, is_active)
                 VALUES (?, ?, ?, ?, ?, TRUE)`,
                [
                    nombre || firebaseEmail.split('@')[0],
                    apellido || '',
                    firebaseEmail,
                    firebaseUid,
                    photoURL || decodedToken.picture || null
                ]
            );

            userId = result.insertId;

            // 🔐 Insertar rol si viene
            if (rolId && validRoles.includes(rolId)) {
                await db.query(
                    `INSERT INTO user_rol (user_id, rol_id, start_date)
                     VALUES (?, ?, NOW())`,
                    [userId, rolId]
                );

                hasRol = true;
            }

            // Obtener usuario
            const [newUser] = await db.query(
                `SELECT U.*, UR.rol_id
                 FROM users U
                 LEFT JOIN user_rol UR ON U.user_id = UR.user_id
                 WHERE U.user_id = ?`,
                [userId]
            );

            userData = newUser[0];

            // 📧 Email bienvenida
            sendWelcomeEmail(
                firebaseEmail,
                nombre || firebaseEmail.split('@')[0],
                apellido || ''
            ).catch(() => {});
        }

        // ==============================
        // 🔑 TOKEN
        // ==============================

        if (hasRol) {
            appToken = jwt.sign(
                { id: userId, rol: userData.rol_id },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            refreshToken = jwt.sign(
                { id: userId },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );

        } else {
            requiresRoleSelection = true;
        }

        // ==============================
        // 📦 RESPONSE
        // ==============================
        const userPayload = {
            id: userId,
            nombre: userData.user_name,
            apellido: userData.user_lastname,
            email: userData.user_email,
            photoURL: userData.profile_image,
            rol: userData.rol_id || null
        };

        console.log(`✅ Login OK`, { hasRol, requiresRoleSelection });

        return res.json({
            success: true,
            user: userPayload,
            token: appToken,
            refreshToken,
            requiresRoleSelection
        });

    } catch (error) {
        console.error('❌ ERROR:', error);
        return res.status(500).json({ error: error.message });
    }
};
/**
 * POST /auth/github (Deprecated - kept for backwards compatibility)
 * Ahora redirige a Firebase Login
 */
const githubRedirect = (req, res) => {
    res.status(410).json({ 
        error: 'GitHub OAuth is deprecated. Use Firebase Google Sign-In instead.' 
    });
};

const githubCallback = (req, res) => {
    res.status(410).json({ 
        error: 'GitHub OAuth is deprecated. Use Firebase Google Sign-In instead.' 
    });
};

/**
 * POST /auth/logout
 * Revoca los tokens de Firebase y limpia la sesión
 */
const logout = async (req, res) => {
    try {
        // Usar LogoutDTO para validación
        const logoutDTO = new LogoutDTO(req.body);
        const validation = logoutDTO.validate();
        
        if (!validation.isValid) {
            return res.status(400).json({ 
                error: 'Datos de logout inválidos', 
                errors: validation.errors 
            });
        }

        const { firebaseToken } = logoutDTO;
        
        const decodedToken = await verifyFirebaseToken(firebaseToken);
        await revokeFirebaseToken(decodedToken.uid);

        res.json({ success: true, message: 'Logout successful. Tokens revoked.' });
    } catch (error) {
        console.error('Error in logout:', error.message);
        res.status(500).json({ error: 'Logout failed', message: error.message });
    }
};

/**
 * POST /auth/forgot-password
 * Paso 1: Verificar email y si tiene teléfono
 * Paso 2: Enviar código (email o SMS)
 */
const forgotPassword = async (req, res) => {
    try {
        const { email, phoneNumber, step, method } = req.body;
        
        // PASO 1: Verificar email
        if (step === 1) {
            if (!email) {
                return res.status(400).json({ error: 'El email es requerido' });
            }
            
            const [userRows] = await db.query(
                'SELECT user_id, user_name, user_lastname, user_email, user_phonenumber FROM users WHERE user_email = ?', 
                [email]
            );
            
            if (userRows.length === 0) {
                return res.json({ success: true, hasPhone: false, message: 'Si el email está registrado, recibirás instrucciones' });
            }
            
            const user = userRows[0];
            const hasPhone = !!user.user_phonenumber;
            
            return res.json({
                success: true,
                hasPhone,
                userId: user.user_id,
                maskedPhone: hasPhone ? user.user_phonenumber.replace(/(\d{3})\d{6}(\d{2})/, '$1******$2') : null
            });
        }
        
        // PASO 2: Enviar código
        console.log('PASO 2 - Email:', email, '| Method:', method, '| Phone:', phoneNumber);
        
        if (!email) {
            return res.status(400).json({ error: 'Email es requerido' });
        }
        
        const [userRows] = await db.query(
            'SELECT user_id, user_name, user_lastname, user_email, user_phonenumber FROM users WHERE user_email = ?', 
            [email]
        );
        
        if (userRows.length === 0) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }
        
        const user = userRows[0];
        
        // Generar código de 6 dígitos
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Guardar en BD (expira en 10 minutos)
        await db.query('UPDATE users SET reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE user_id = ?', [resetCode, user.user_id]);
        
        console.log('Código generado para usuario', user.user_id, ':', resetCode);
        
        // Enviar por método elegido
        if (method === 'email') {
            console.log('Enviando correo a:', user.user_email);
            try {
                const emailResult = await sendPasswordResetEmail(user.user_email, user.user_name, user.user_lastname, resetCode);
                console.log('Resultado correo:', emailResult);
                return res.json({ success: true, method: 'email', message: 'Código enviado por correo' });
            } catch (emailError) {
                console.error('Error enviando correo:', emailError);
                return res.status(500).json({ error: 'Error enviando correo: ' + emailError.message });
            }
        }
        
        // Para SMS, verificar que el teléfono coincida
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Teléfono es requerido para SMS' });
        }
        
        // Normalizar números para comparación (solo dígitos)
        const storedPhoneDigits = user.user_phonenumber.replace(/\D/g, '');
        const inputPhoneDigits = phoneNumber.replace(/\D/g, '');
        
        // Verificar si los últimos 10 dígitos coinciden (asumiendo Colombia)
        const storedLast10 = storedPhoneDigits.slice(-10);
        const inputLast10 = inputPhoneDigits.slice(-10);
        
        console.log('Teléfonos - Almacenado:', storedPhoneDigits, '| Ingresado:', inputPhoneDigits);
        console.log('Comparando últimos 10 dígitos - Almacenado:', storedLast10, '| Ingresado:', inputLast10);
        
        if (storedLast10 !== inputLast10) {
            return res.status(400).json({ error: 'El teléfono no coincide con el registrado' });
        }
        
        console.log('Enviando SMS al número almacenado:', user.user_phonenumber);
        const smsResult = await sendPasswordResetSMS(user.user_phonenumber, resetCode);
        
        if (!smsResult.success) {
            // Si falla SMS, enviar por email como respaldo
            if (user.user_email) {
                await sendPasswordResetEmail(user.user_email, user.user_name, user.user_lastname, resetCode);
                return res.json({ success: true, method: 'email', message: 'Código enviado por correo (SMS falló)' });
            }
            return res.status(500).json({ error: 'Error enviando código' });
        }
        
        res.json({ success: true, method: 'sms', message: 'Código enviado por SMS' });
    } catch (error) {
        console.error('Error en forgotPassword:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
};

/**
 * POST /auth/reset-password
 * Restablecer contraseña con código (6 dígitos)
 */
const resetPassword = async (req, res) => {
    try {
        const { code, newPassword } = req.body;
        
        if (!code || !newPassword) {
            return res.status(400).json({ error: 'Código y nueva contraseña son requeridos' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }
        
        // Buscar usuario por código válido
        console.log('Buscando código:', code);
        const [userRows] = await db.query('SELECT user_id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()', [code]);
        console.log('Resultado búsqueda:', userRows.length > 0 ? 'Código válido' : 'Código inválido o expirado');
        
        if (userRows.length === 0) {
            return res.status(400).json({ error: 'Código inválido o expirado' });
        }
        
        const user = userRows[0];
        
        // Encriptar nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Actualizar contraseña y limpiar token
        await db.query('UPDATE users SET user_password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE user_id = ?', [hashedPassword, user.user_id]);
        
        res.json({ success: true, message: 'Contraseña restablecida exitosamente' });
    } catch (error) {
        console.error('Error en resetPassword:', error);
        res.status(500).json({ error: 'Error al restablecer la contraseña' });
    }
};

module.exports = { firebaseLogin, githubRedirect, githubCallback, logout, forgotPassword, resetPassword };
