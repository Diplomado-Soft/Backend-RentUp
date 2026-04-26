const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyFirebaseToken } = require('../utils/firebaseService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * POST /auth/firebase-login
 * Recibe el Firebase ID Token, lo verifica, y genera un JWT de la app
 */
const firebaseLogin = async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    try {
        const { firebaseToken, rolId = 1, email, nombre, apellido, photoURL } = req.body;

        console.log(`\n📝 [${requestId}] Firebase login request:`, {
            hasToken: !!firebaseToken,
            tokenLength: firebaseToken ? firebaseToken.length : 0,
            email,
            rolId
        });

        if (!firebaseToken) {
            console.log(`❌ [${requestId}] Missing Firebase token`);
            return res.status(400).json({ error: 'Firebase token is required' });
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

        if (users.length > 0) {
            // Usuario existente
            userId = users[0].user_id;
            userData = users[0];
            console.log(`👤 [${requestId}] Existing user found: ID=${userId}`);

            // Actualizar Firebase UID si no lo tiene
if (!userData.user_google_id || !userData.profile_image) {
                console.log(`🔄 [${requestId}] Updating Firebase UID & profile...`);
                await db.query(
                    'UPDATE users SET user_google_id = ?, profile_image = ? WHERE user_id = ?',
                    [firebaseUid, photoURL || decodedToken.picture || null, userId]
                );
            }
        } else {
            // Usuario nuevo: crear
            console.log(`✨ [${requestId}] Creating new user:`, firebaseEmail);
const [result] = await db.query(
                `INSERT INTO users (user_name, user_lastname, user_email, user_google_id, profile_image)
                 VALUES (?, ?, ?, ?, ?)`,
                [nombre || firebaseEmail.split('@')[0], apellido || '', firebaseEmail, firebaseUid, photoURL || decodedToken.picture || null]
            );
            
            userId = result.insertId;
            console.log(`✅ [${requestId}] New user created: ID=${userId}`);

            // Asignar rol
            await db.query(
                `INSERT INTO user_rol (user_id, rol_id, start_date) VALUES (?, ?, NOW())`,
                [userId, rolId]
            );

            // Obtener datos del usuario creado
            [users] = await db.query(
                `SELECT U.user_id, U.user_name, U.user_lastname, U.user_email,
                        U.user_phonenumber, U.whatsapp, UR.rol_id
                 FROM users AS U
                 LEFT JOIN user_rol AS UR ON U.user_id = UR.user_id
                 WHERE U.user_id = ?
                 LIMIT 1`,
                [userId]
            );
            userData = users[0];
        }

        // 3. Generar JWT de la app (no el de Firebase)
        console.log(`🔑 [${requestId}] Generating app JWT...`);
        const appToken = jwt.sign(
            { id: userId, rol: userData.rol_id || rolId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '24h' }
        );

        // 4. Devolver datos del usuario y token
let userPayload = {
            id: userId,
            nombre: userData.user_name,
            apellido: userData.user_lastname,
            email: userData.user_email,
            profile_image: userData.profile_image,
            telefono: userData.user_phonenumber || null,
            whatsapp: userData.whatsapp || null,
            rol: userData.rol_id || rolId,
            token: appToken,
        };

        console.log(`✅ [${requestId}] Firebase login successful:`, { userId, email: userData.user_email });

        res.json({
            success: true,
            user: userPayload,
            token: appToken,
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

module.exports = { firebaseLogin, githubRedirect, githubCallback };