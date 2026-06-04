const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/auth');
const { sendWelcomeEmail, sendUserBlockEmail, sendEmailAccountDelete } = require('../utils/emailService');
const { CreateUserDTO, UpdateUserDTO, UserDTO } = require('../dtos');
const db = require('../config/db');
const idriveService = require('../utils/idriveService');
const NotificationModel = require('./../models/NotificationModel');
require('dotenv').config();

exports.getUserData = async (req, res) => {
    const userId = req.user.id; // Usuario autenticado desde el token

    try {
        // Llamar al modelo para obtener datos del usuario
        const user = await User.getUserData(userId);

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Usar UserDTO para formatear respuesta
        const userDTO = UserDTO.fromDatabase(user);
        res.json(userDTO);
    } catch (error) {
        console.error("Error obteniendo datos del usuario:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
}
const validateContactNumber = (value, fieldName) => {
    if (value === undefined || value === null || value === '') return null;

    const normalized = value.toString().trim();
    const cleaned = normalized.replace(/[^+\d]/g, '');

    if (!/^\+?\d+$/.test(cleaned)) {
        throw new Error(`Formato de ${fieldName} inválido. Solo se permiten dígitos y un + opcional al inicio.`);
    }

    let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

    if (digits.length < 7 || digits.length > 15) {
        throw new Error(`El ${fieldName} debe tener entre 7 y 15 dígitos.`);
    }

    if (digits.length === 10 && digits.startsWith('3')) {
        digits = '57' + digits;
    }

    if (digits.length > 15) {
        throw new Error(`El ${fieldName} no puede superar los 15 caracteres.`);
    }

    return digits;
};

exports.updateUserData = async (req, res) => {
    console.log(req.body);
    const userId = req.user.id; // Usuario autenticado desde el token

    try {
        // Usar UpdateUserDTO para validación
        const userDTO = new UpdateUserDTO(req.body);
        const validation = userDTO.validate();
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Datos de actualización inválidos',
                errors: validation.errors
            });
        }

        const dtoData = userDTO.toDatabaseFormat();

        // Llamar al modelo para actualizar datos
        const updatedUser = await User.updateUserData(userId, dtoData);

        if (!updatedUser) {
            return res.status(404).json({ error: "Usuario no encontrado o no se pudo actualizar" });
        }

        res.json({
            message: "Datos actualizados exitosamente",
            user: updatedUser
        });
    } catch (error) {
        console.error("Error actualizando usuario:", error);
        res.status(400).json({ error: error.message || "Error en el servidor" });
    }
};

// Controlador para registrar un nuevo usuario
exports.signup = async (req, res) => {
    try {
        // Usar CreateUserDTO para validación
        const userDTO = new CreateUserDTO(req.body);
        const validation = userDTO.validate();
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Datos de registro inválidos',
                errors: validation.errors
            });
        }

        const dtoData = userDTO.toDatabaseFormat();

        // Si es arrendador, la cédula es obligatoria
        if (dtoData.rolId === 2 && !req.file) {
            return res.status(400).json({
                error: 'Para registrarse como arrendador debe subir una foto de su cédula de identidad'
            });
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findByEmail(dtoData.email);
        if (existingUser) {
            return res.status(409).json({ error: 'El usuario ya está registrado' });
        }
        
        // Crear usuario en la db
        let newUser;
        try {
            newUser = await User.signup(dtoData);
        } catch (signupErr) {
            if (signupErr.code === 'ER_DUP_ENTRY' || (signupErr.message && signupErr.message.includes('Duplicate'))) {
                return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
            }
            throw signupErr;
        }

        // Si es arrendador y subió cédula, procesarla
        if (dtoData.rolId === 2 && req.file) {
            try {
                const crypto = require('crypto');
                const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

                const existingDoc = await User.findByDocumentHash(fileHash);
                if (existingDoc) {
                    console.warn(`⚠️ Intento de registro con cédula duplicada. Usuario existente: ${existingDoc.user_id}`);
                    return res.status(409).json({
                        error: 'Esta cédula ya está registrada en el sistema por otro usuario. No se puede usar el mismo documento de identidad para crear múltiples cuentas.'
                    });
                }

                const uploadResult = await idriveService.uploadDocument(
                    req.file.buffer,
                    newUser.user_id,
                    'id_document',
                    req.file.originalname,
                    req.file.mimetype
                );
                await User.updateCedula(newUser.user_id, uploadResult.signedUrl, uploadResult.key, fileHash);
                console.log(`✅ Cédula subida para usuario ${newUser.user_id}`);

                // Llamar al servicio de IA para verificar la cédula
                const aiVerificationService = require('../services/aiVerificationService');
                const aiResult = await aiVerificationService.analyzeIdDocument(uploadResult.signedUrl);
                console.log(`🤖 Resultado de IA para usuario ${newUser.user_id}:`, aiResult);

                if (aiResult.esValido && aiResult.confianza > 0.9) {
                    await db.execute(
                        `UPDATE users SET estadoVerificacion = 'aprobado' WHERE user_id = ?`,
                        [newUser.user_id]
                    );
                    console.log(`✅ Usuario ${newUser.user_id} aprobado automáticamente por IA (confianza: ${aiResult.confianza})`);
                } else {
                    await idriveService.deleteImage(uploadResult.key).catch(e =>
                        console.error('Error limpiando archivo de IDrive:', e.message)
                    );
                    await User.deleteRolUser(newUser.user_id).catch(e =>
                        console.error('Error eliminando rol de usuario:', e.message)
                    );
                    await User.deleteAccount(newUser.user_id).catch(e =>
                        console.error('Error eliminando usuario:', e.message)
                    );
                    return res.status(400).json({
                        error: aiResult.comentario || 'No se pudo validar su documento de identidad. Verifique que la imagen sea legible y vuelva a intentarlo.'
                    });
                }
            } catch (uploadErr) {
                console.error('❌ Error procesando cédula:', uploadErr.message);
                await User.deleteRolUser(newUser.user_id).catch(e => {});
                await User.deleteAccount(newUser.user_id).catch(e => {});
                return res.status(400).json({
                    error: 'Ocurrió un error al validar su documento de identidad. Verifique que la imagen sea legible y vuelva a intentarlo.'
                });
            }
        }

        // Enviar correo de bienvenida (no bloquea el registro si falla)
        sendWelcomeEmail(dtoData.email, dtoData.nombre, dtoData.apellido).catch(err =>
            console.error('Error enviando correo de bienvenida:', err.message || err)
        );

        // Generar token JWT
        const token = generateToken({
            id: newUser.user_id,
            rol: newUser.rol_id
        });

        const refreshToken = jwt.sign(
            {id: newUser.user_id},
            process.env.JWT_REFRESH_SECRET,
            {expiresIn: '7d'}
        )

        const newUserData = {
            id: newUser.user_id,
            email: newUser.user_email,
            rol: newUser.rol_id,
            estadoVerificacion: newUser.estadoVerificacion || 'pendiente'
        };

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: newUserData,
            token,
            refreshToken
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

// Controlador para iniciar sesión
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña requeridos' });
        }

        // Buscar usuario
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        if (user.is_active === false) {
            // return res.status(403).json({ error: 'Usuario no encontrado o cuenta eliminada' });
            const reactivationAt = user.account_reactivation_at ? new Date(user.account_reactivation_at) : null;

            if(reactivationAt && Date.now() < reactivationAt.getTime()) {
                const formatted = reactivationAt.toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });

                return res.status(403).json({
                    error: `Tu cuenta está desactivada temporalmente. Podrás iniciar sesión nuevamente el ${formatted}.`
                });
            }

            return res.status(403).json({
                error: 'Tu cuenta está bloqueada. Contacta al administrador.'
            });
        }

        // Verificar si el usuario usa Google OAuth
        if (!user.user_password) {
            return res.status(400).json({ error: 'Este usuario usa Google OAuth, inicie sesión con Google' });
        }

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.user_password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Generar token JWT
        const token = generateToken({
            id: user.user_id,
            rol: user.rol_id
        });

        const userData = {
            id: user.user_id,
            nombre: user.user_name,
            apellido: user.user_lastname,
            email: user.user_email,
            telefono: user.user_phonenumber,
            rol: user.rol_id,
            estadoVerificacion: user.estadoVerificacion || 'pendiente'
        };

        const refreshToken = jwt.sign(
            { id: user.user_id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Autenticación exitosa',
            user: userData,
            token,
            refreshToken
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

/**
 * PUT /users/update-whatsapp - Actualizar número de WhatsApp y teléfono del usuario
 * Sprint 4 - T-20: Agregar campo WhatsApp a perfil
 */
exports.updateWhatsApp = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { telefono, whatsapp } = req.body;

        const db = require('../config/db');
        
        let query = 'UPDATE users SET ';
        const params = [];
        const updates = [];

        // Si se proporciona teléfono
        if (telefono !== undefined && telefono !== null) {
            const cleanPhone = telefono.replace(/\D/g, '');
            // Formatear a formato colombiano si es necesario
            let formattedPhone = cleanPhone;
            if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
                formattedPhone = '57' + cleanPhone;
            }
            updates.push('user_phonenumber = ?');
            params.push(formattedPhone);
            
            // Si no se proporciona WhatsApp pero sí teléfono, usar el mismo número
            if (!whatsapp) {
                updates.push('whatsapp = ?');
                params.push(formattedPhone);
            }
        }

        // Si se proporciona WhatsApp
        if (whatsapp !== undefined && whatsapp !== null) {
            const cleanWhatsApp = whatsapp.replace(/\D/g, '');
            let formattedWhatsApp = cleanWhatsApp;
            if (cleanWhatsApp.length === 10 && cleanWhatsApp.startsWith('3')) {
                formattedWhatsApp = '57' + cleanWhatsApp;
            }
            updates.push('whatsapp = ?');
            params.push(formattedWhatsApp);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Debe proporcionar al menos un número de teléfono o WhatsApp'
            });
        }

        query += updates.join(', ') + ' WHERE user_id = ?';
        params.push(userId);

        const [result] = await db.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Datos de contacto actualizados exitosamente',
            telefono: telefono || null,
            whatsapp: whatsapp || telefono || null
        });
    } catch (error) {
        console.error('Error actualizando datos de contacto:', error);
        res.status(500).json({
            error: error.message || 'Error al actualizar datos de contacto'
        });
    }
};

/**
 * DELETE /users/delete-account - Eliminar cuenta de usuario
 */
exports.deleteAccount = async (req, res) => {
    const db = require('../config/db');

    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        // ❌ NO borrar rol
        // ✅ Solo desactivar usuario

        const [userRows] = await db.query(
            `SELECT user_email, user_name, user_lastname FROM users WHERE user_id = ?`,
            [userId]
        );

        if (!userRows || userRows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const {user_email, user_name, user_lastname} = userRows[0];

        const [result] = await db.query(
            `UPDATE users
             SET is_active = FALSE,
                 account_deactivated_at = NOW(),
                 account_reactivation_at = DATE_ADD(NOW(), INTERVAL 15 DAY)
             WHERE user_id = ?`,
            [userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({error: 'Usuario no encontrado'})
        }

        // Calcular fecha
        const reactivationDate = new Date(Date.now() + 15 * 24 * 60 * 1000);
        const reactivationDateFormated = reactivationDate.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        sendEmailAccountDelete(user_email, user_name, user_lastname, reactivationDateFormated)
        .catch(err=> console.log('Error enviando el correo de eliminacion de cuenta', err.message || err));

        res.json({
            success: true,
            message: 'Cuenta desactivada correctamente'
        });

    } catch (error) {
        console.error('Error eliminando cuenta:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Verificar o rechazar usuario (solo admin)
 * PUT /admin/users/:id/verificar
 */
exports.verifyUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, notas = '' } = req.body;
        const adminId = req.user.id;

        if (!id) {
            return res.status(400).json({ success: false, error: 'ID de usuario requerido' });
        }

        if (!estado || !['aprobado', 'rechazado'].includes(estado)) {
            return res.status(400).json({
                success: false,
                error: 'Estado inválido. Use "aprobado" o "rechazado"'
            });
        }

        if (estado === 'rechazado' && !notas.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Debe proporcionar un motivo para el rechazo'
            });
        }

        // Verificar que el usuario existe
        const [userRows] = await db.query(
            'SELECT user_id, user_name, user_lastname, user_email, user_phonenumber, estadoVerificacion FROM users WHERE user_id = ?',
            [id]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        const user = userRows[0];

        // Actualizar estado de verificación
        await db.execute(
            `UPDATE users SET estadoVerificacion = ?, notasRevision = ? WHERE user_id = ?`,
            [estado, notas || null, id]
        );

        console.log(`🔵 Admin ${adminId} ${estado === 'aprobado' ? 'aprobó' : 'rechazó'} verificación de usuario ${id}`);

        // Notificar al usuario
        try {
            await NotificationModel.createForUser(id, {
                type: estado === 'aprobado' ? 'verification_approved' : 'verification_rejected',
                title: estado === 'aprobado' ? 'Verificación aprobada' : 'Verificación rechazada',
                message: estado === 'aprobado'
                    ? 'Tu cuenta ha sido verificada exitosamente. Ya puedes publicar propiedades.'
                    : `Tu verificación ha sido rechazada. Motivo: ${notas || 'No especificado'}`,
                reference_id: id,
                reference_type: 'user_verification'
            });
        } catch (notifErr) {
            console.error('Error notificando al usuario:', notifErr.message);
        }

        return res.json({
            success: true,
            message: `Usuario ${estado === 'aprobado' ? 'aprobado' : 'rechazado'} correctamente`,
            data: {
                user_id: id,
                estadoVerificacion: estado,
                notasRevision: notas || null
            }
        });
    } catch (error) {
        console.error('Error verificando usuario:', error);
        return res.status(500).json({ success: false, error: 'Error al verificar usuario' });
    }
};

/**
 * Obtener lista de usuarios (solo admin)
 * GET /admin/users?limit=50&offset=0&search=&role=
 */
exports.getUsers = async (req, res) => {
    try {
        const { limit = 50, offset = 0, search = '', role = '', estado = '' } = req.query;
        console.log('getUsers - Params recibidos:', { limit, offset, search, role });
        
        let query = `
            SELECT u.user_id, u.user_name, u.user_lastname, u.user_email, 
                   u.user_phonenumber, u.is_active, u.created_at,
                   u.estadoVerificacion, u.notasRevision,
                   u.id_document_url, u.id_document_key,
                   MAX(r.rol_id) AS rol_id
            FROM users u
        `;
        
        // Si se filtra por rol específico, usar INNER JOIN
        if (role && role !== '0') {
            query += ` INNER JOIN user_rol r ON u.user_id = r.user_id WHERE 1=1`;
        } else {
            query += ` LEFT JOIN user_rol r ON u.user_id = r.user_id WHERE 1=1`;
        }
        const params = [];
        
        if (search) {
            const searchPattern = `%${search}%`;
            query += ` AND (u.user_name LIKE ? OR u.user_lastname LIKE ? OR u.user_email LIKE ?)`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        
        if (role) {
            if (role === '0') {
                query += ` AND r.rol_id IS NULL`;
            } else {
                query += ` AND r.rol_id = ?`;
                params.push(parseInt(role));
            }
        }
        if (estado) {
            const validStates = ['pendiente', 'aprobado', 'rechazado'];
            if (validStates.includes(estado)) {
                query += ` AND u.estadoVerificacion = ?`;
                params.push(estado);
            }
        }

        
        query += ` GROUP BY u.user_id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        console.log('getUsers query:', query);
        console.log('getUsers params:', params);
            
        const [users] = await db.query(query, params);
        
        // Obtener total para paginación
        let countQuery = `SELECT COUNT(DISTINCT u.user_id) as total FROM users u LEFT JOIN user_rol r ON u.user_id = r.user_id WHERE 1=1`;
        const countParams = [];
        
        if (search) {
            const searchPattern = `%${search}%`;
            countQuery += ` AND (u.user_name LIKE ? OR u.user_lastname LIKE ? OR u.user_email LIKE ?)`;
            countParams.push(searchPattern, searchPattern, searchPattern);
        }
        
        if (role) {
            if (role === '0') {
                countQuery += ` AND r.rol_id IS NULL`;
            } else {
                countQuery += ` AND r.rol_id = ?`;
                countParams.push(parseInt(role));
            }
        }
        if (estado) {
            const validStates = ['pendiente', 'aprobado', 'rechazado'];
            if (validStates.includes(estado)) {
                countQuery += ` AND u.estadoVerificacion = ?`;
                countParams.push(estado);
            }
        }
        console.log('getUsers countQuery:', countQuery);
        console.log('getUsers countParams:', countParams);
        const [countResult] = await db.query(countQuery, countParams);
        
        res.json({
            success: true,
            users,
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ success: false, error: error.message || 'Error al obtener usuarios' });
    }
};

/**
 * Bloquear usuario (solo admin)
 * PUT /admin/users/:id/block
 */
exports.blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason = 'No especificado' } = req.body;
        
        const [result] = await db.query(
            'UPDATE users SET is_active = FALSE WHERE user_id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
        
        await db.query(
            'INSERT INTO motivo (descripcion, user_id) VALUES (?, ?)',
            [reason, id]
        );
        
        const [userRows] = await db.query('SELECT user_email, user_name, user_lastname FROM users WHERE user_id = ?', [id]);
        if (userRows.length > 0) {
            const { user_email, user_name, user_lastname } = userRows[0];
            await sendUserBlockEmail(user_email, user_name, user_lastname, reason);
        }
        
        console.log(`Usuario ${id} bloqueado por admin ${req.user.id}. Razón: ${reason}`);
        
        res.json({ success: true, message: 'Usuario bloqueado exitosamente' });
    } catch (error) {
        console.error('Error bloqueando usuario:', error);
        res.status(500).json({ success: false, error: 'Error al bloquear usuario' });
    }
};

/**
 * Desbloquear usuario (solo admin)
 * PUT /admin/users/:id/unblock
 */
exports.unblockUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await db.query(
            'UPDATE users SET is_active = TRUE WHERE user_id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
        
        console.log(`Usuario ${id} desbloqueado por admin ${req.user.id}`);
        
        res.json({ success: true, message: 'Usuario desbloqueado exitosamente' });
    } catch (error) {
        console.error('Error desbloqueando usuario:', error);
        res.status(500).json({ success: false, error: 'Error al desbloquear usuario' });
    }
};