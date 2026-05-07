const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyFirebaseToken, revokeFirebaseToken } = require('../utils/firebaseService');
const { sendWelcomeEmail } = require('../utils/emailService');
const { use } = require('react');
const { messaging } = require('firebase-admin');
const { refreshToken } = require('firebase-admin/app');

const FRONT_END_URL = process.env.FRONT_END_URL || 'http://localhost:3000';

/**
 * POST /auth/firebase-login
 * Recibe el Firebase ID Token, lo verifica, y genera un JWT de la app
 */
const firebaseLogin = async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);

    try {
        const { firebaseToken, rolId, email, nombre, apellido, photoURL } = req.body;

        const validRoles = [1, 2]; // 1=usuario, 2=arrendador

        console.log(`\n📝 [${requestId}] Firebase login request:`, {
            hasToken: !!firebaseToken,
            rolId,
            email
        });

        if (!firebaseToken) {
            return res.status(400).json({ error: 'Token requerido' });
        }

        // 🔐 1. Verificar token
        const decodedToken = await verifyFirebaseToken(firebaseToken);
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

            const refreshToken = jwt.sign(
                {id: userId},
                process.env.JWT_REFRESH_SECRET,
                {expiresIn: '7d'}
            )
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
