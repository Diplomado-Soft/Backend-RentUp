const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyFirebaseToken, revokeFirebaseToken } = require('../utils/firebaseService');
const { sendWelcomeEmail } = require('../utils/emailService');
const { use } = require('react');

const FRONT_END_URL = process.env.FRONT_END_URL || 'http://localhost:3000';

/**
 * POST /auth/firebase-login
 * Recibe el Firebase ID Token, lo verifica, y genera un JWT de la app
 */
const firebaseLogin = async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    try {
        const { firebaseToken, rolId, email, nombre, apellido, photoURL } = req.body;

        console.log(`\n📝 [${requestId}] Firebase login request:`, {
            hasToken: !!firebaseToken,
            hasRolId: !!rolId,
            tokenLength: firebaseToken ? firebaseToken.length : 0,
            email,
        });

        if (!firebaseToken) {
            console.log(`❌ [${requestId}] Missing Firebase token`);
            return res.status(400).json({ error: 'Token requerido' });
        }

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
            console.log(`❌ [${requestId}] No email found in token`);
            return res.status(400).json({ 
                error: 'Email is required. Make sure your Google account has a verified email.' 
            });
        }

        // 2. Buscar usuario en BD por email o Firebase UID
        console.log(`📍 [${requestId}] Searching for user:`, firebaseEmail);
        let [users] = await db.query(
            `SELECT U.*, UR.rol_id
             FROM users AS U
             LEFT JOIN user_rol AS UR ON U.user_id = UR.user_id
             WHERE U.user_email = ? OR U.user_google_id = ?
             LIMIT 1`,
            [firebaseEmail, firebaseUid]
        );

        let userId;
        let userData;
        let hasRol = false;

        if (users.length > 0) {
            // Usuario existente
            userId = users[0].user_id;
            userData = users[0];
            console.log(`👤 [${requestId}] Existing user found: ID=${userId}`);

            // Verificar si la cuenta está desactivada y reactivarla
            if (users[0].is_active === false || users[0].is_active === 0) {
                console.log(`🔄 [${requestId}] Reactivando cuenta...`);
                await db.query('UPDATE users SET is_active = TRUE WHERE user_id = ?', [userId]);
            }

            // Actualizar Firebase UID si no lo tiene
            if (!userData.user_google_id || !userData.profile_image) {
                console.log(`🔄 [${requestId}] Updating Firebase UID & profile...`);
                await db.query(
                    'UPDATE users SET user_google_id = ?, profile_image = ? WHERE user_id = ?',
                    [firebaseUid, photoURL || decodedToken.picture || null, userId]
                );
            }
            
            // Verificar si tiene rol asignado
            const [rolCheck] = await db.query('SELECT rol_id FROM user_rol WHERE user_id = ?', [userId]);
            hasRol = rolCheck.length > 0;
           // if(!hasRol) { console.log(`[${requestId}] Cuenta reactivada sin rol asignado`)}
        } else {
            // Usuario nuevo: crear
            console.log(`✨ [${requestId}] Creating new user:`, firebaseEmail);
    const [result] = await db.query(
                `INSERT INTO users (user_name, user_lastname, user_email, user_google_id, profile_image, is_active)
                 VALUES (?, ?, ?, ?, ?, TRUE)`,
                [nombre || firebaseEmail.split('@')[0], apellido || '', firebaseEmail, firebaseUid, photoURL || decodedToken.picture || null]
            );

                        
            userId = result.insertId;
            console.log(`✅ [${requestId}] New user created: ID=${userId}`);

            if (rolId) {
                await db.query(
                    `INSERT INTO user_rol (user_id, rol_id, start_date) VALUES (?, ?, NOW())`,
                    [userId, rolId]
                );
                hasRol = true;
            }

            if(hasRol) {
                const appToken = jwt.sign({id: userId, rol: userData.rol_id || rolId}, process.env.JWT_SECRET,
                    {expiresIn: '24h'}
                );
                res.json({success: true, user: userPayload, token: appToken, requiresRoleSelection: false});  
            } else {
                res.json({success: true, user: userPayload, token: null, requiresRoleSelection: true })
            }



            // Enviar correo de bienvenida (no bloquea el registro si falla)
            sendWelcomeEmail(
                firebaseEmail,
                nombre || firebaseEmail.split('@')[0],
                apellido || ''
            ).catch(err =>
                console.error(`❌ [${requestId}] Error enviando correo de bienvenida:`, err.message || err)
            );
            
            // Obtener datos del usuario creado
            [users] = await db.query(
                `SELECT U.user_id, U.user_name, U.user_lastname, U.user_email,
                        U.user_phonenumber, U.whatsapp, U.profile_image, UR.rol_id
                 FROM users AS U
                 LEFT JOIN user_rol AS UR ON U.user_id = UR.user_id
                 WHERE U.user_id = ?`,
                [userId]
            );
            userData = users[0];
        }

        // 3. Generar JWT de la app (no el de Firebase)
        if(hasRol) {
            console.log(`🔑 [${requestId}] Generating app JWT...`);
            const appToken = jwt.sign(
                { id: userId, rol: userData.rol_id || rolId },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES || '24h' }
            );
            requiresRoleSelection = false;
        } else {
            console.log(`[${requestId}] First Login - require role selection`);
            appToken = null;
            requiresRoleSelection = true;
        }

        // 4. Devolver datos del usuario y token
    let userPayload = {
            id: userId,
            nombre: userData.user_name,
            apellido: userData.user_lastname,
            email: userData.user_email,
            profile_image: userData.profile_image,
            telefono: userData.user_phonenumber || null,
            whatsapp: userData.whatsapp || null,
            photoURL: userData.profile_image,
            rol: userData.rol_id || null,
            //token: appToken,
        };

        console.log(`✅ [${requestId}] Firebase login successful:`, { userId, requiresRoleSelection, hasRol });

        res.json({
            success: true,
            user: userPayload,
            token: appToken,
            requiresRoleSelection
        });

    } catch (error) {
        console.error(`❌ [${requestId}] Unexpected error in Firebase login:`, {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        
        if (error.message.includes('Firebase')) {
            return res.status(401).json({ 
                error: 'Invalid Firebase token',
                message: error.message 
            });
        }

        res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Unknown error'
        });
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
        const { firebaseToken } = req.body;
        
        if (!firebaseToken) {
            return res.status(400).json({ error: 'Firebase token is required' });
        }

        const decodedToken = await verifyFirebaseToken(firebaseToken);
        await revokeFirebaseToken(decodedToken.uid);

        res.json({ success: true, message: 'Logout successful. Tokens revoked.' });
    } catch (error) {
        console.error('Error in logout:', error.message);
        res.status(500).json({ error: 'Logout failed', message: error.message });
    }
};

module.exports = { firebaseLogin, githubRedirect, githubCallback, logout };
