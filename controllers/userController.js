const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/auth');
require('dotenv').config();

exports.getUserData = async (req, res) => {
    const userId = req.user.id; // Usuario autenticado desde el token

    try {
        // Llamar al modelo para obtener datos del usuario
        const user = await User.getUserData(userId);

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Excluir información sensible
        const { user_password, ...userData } = user;

        res.json(userData);
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
    const { nombre, apellido, email, telefono, password, rol, whatsapp } = req.body;
    const userId = req.user.id; // Usuario autenticado desde el token

    try {
        const validWhatsapp = validateContactNumber(whatsapp, 'WhatsApp');
        const validPhone = validateContactNumber(telefono, 'teléfono');

        // Llamar al modelo para actualizar datos
        const updatedUser = await User.updateUserData(userId, {
            nombre,
            apellido,
            email,
            telefono: validPhone,
            password: password !== undefined ? password : null, // Si no se proporciona, no se actualiza
            rol,
            whatsapp: validWhatsapp
        });

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
        const { nombre, apellido, email, telefono, password, rolId } = req.body;
        
        // Validación de campos
        const requiredFields = ['nombre', 'apellido', 'email', 'telefono', 'password', 'rolId'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Campos requeridos faltantes',
                missing: missingFields
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Formato de email inválido' });
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'El usuario ya está registrado' });
        }
        
        // Crear usuario en la db
        const newUser = await User.signup({
            nombre,
            apellido,
            email,
            telefono,
            password,
            rolId
        });

        // Generar token JWT
        const token = generateToken({
            id: newUser.user_id,
            rol: newUser.rol_id
        });

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: {
                id: newUser.user_id,
                email: newUser.user_email,
                rol: newUser.rol_id
            },
            token
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

        // Excluir información sensible
        const userData = {
            id: user.user_id,
            nombre: user.user_name,
            apellido: user.user_lastname,
            email: user.user_email,
            telefono: user.user_phonenumber,
            rol: user.rol_id
        };

        res.json({
            message: 'Autenticación exitosa',
            user: userData,
            token
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
        const userId = req.user?.id || req.user?.user_id;
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
    const connection = await db.getConnection();
    try {
        const userId = req.user?.id || req.user?.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        await connection.beginTransaction();

        await connection.query(
            'DELETE FROM user_rol WHERE user_id = ?',
            [userId]
        );

        await connection.query(
            'DELETE FROM users WHERE user_id = ?',
            [userId]
        );

        await connection.commit();

        res.json({ message: 'Cuenta eliminada exitosamente' });
    } catch (error) {
        await connection.rollback();
        console.error('Error eliminando cuenta:', error);
        res.status(500).json({ error: 'Error al eliminar la cuenta' });
    } finally {
        connection.release();
    }
};