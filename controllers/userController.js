const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/auth');
const db = require('../config/db'); // Mover el import aquí arriba es mejor práctica
require('dotenv').config();

exports.getUserData = async (req, res) => {
    // CORRECCIÓN 1: Asegurar que capturamos el ID correctamente según tu middleware
    const userId = req.user.id || req.user.user_id; 

    try {
        const user = await User.getUserData(userId);

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const { user_password, ...userData } = user;
        res.json(userData);
    } catch (error) {
        console.error("Error obteniendo datos del usuario:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
}

exports.updateUserData = async (req, res) => {
    const { nombre, apellido, email, telefono, password, rol } = req.body;
    const userId = req.user.id || req.user.user_id;

    try {
        // CORRECCIÓN 2: Si viene password, hay que hashearla antes de enviarla al modelo
        let hashedEmojiPassword = password;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashedEmojiPassword = await bcrypt.hash(password, salt);
        }

        const updatedUser = await User.updateUserData(userId, {
            nombre,
            apellido,
            email,
            telefono,
            password: hashedEmojiPassword !== undefined ? hashedEmojiPassword : null,
            rol
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
        res.status(500).json({ error: "Error en el servidor" });
    }
};

exports.signup = async (req, res) => {
    try {
        const { nombre, apellido, email, telefono, password, rolId } = req.body;
        
        const requiredFields = ['nombre', 'apellido', 'email', 'telefono', 'password', 'rolId'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Campos requeridos faltantes',
                missing: missingFields
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Formato de email inválido' });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'El usuario ya está registrado' });
        }
        
        const newUser = await User.signup({
            nombre,
            apellido,
            email,
            telefono,
            password,
            rolId
        });

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

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña requeridos' });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        if (!user.user_password) {
            return res.status(400).json({ error: 'Este usuario usa Google OAuth, inicie sesión con Google' });
        }

        const validPassword = await bcrypt.compare(password, user.user_password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = generateToken({
            id: user.user_id,
            rol: user.rol_id
        });

        res.json({
            message: 'Autenticación exitosa',
            user: {
                id: user.user_id,
                nombre: user.user_name,
                apellido: user.user_lastname,
                email: user.user_email,
                telefono: user.user_phonenumber,
                rol: user.rol_id
            },
            token
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

exports.updateWhatsApp = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.user_id;
        const { telefono, whatsapp } = req.body;

        let query = 'UPDATE users SET ';
        const params = [];
        const updates = [];

        if (telefono !== undefined && telefono !== null) {
            const cleanPhone = telefono.replace(/\D/g, '');
            let formattedPhone = cleanPhone;
            if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
                formattedPhone = '57' + cleanPhone;
            }
            updates.push('user_phonenumber = ?');
            params.push(formattedPhone);
            
            if (!whatsapp) {
                updates.push('whatsapp = ?');
                params.push(formattedPhone);
            }
        }

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
            return res.status(400).json({ error: 'Debe proporcionar al menos un número' });
        }

        query += updates.join(', ') + ' WHERE user_id = ?';
        params.push(userId);

        // CORRECCIÓN 3: Usar la conexión global de db importada arriba
        const [result] = await db.query(query, params); 

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({
            success: true,
            message: 'Datos de contacto actualizados exitosamente',
            telefono: telefono || null,
            whatsapp: whatsapp || telefono || null
        });
    } catch (error) {
        console.error('Error actualizando WhatsApp:', error);
        res.status(500).json({ error: 'Error al actualizar datos de contacto' });
    }
};

exports.deleteAccount = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const userId = req.user?.id || req.user?.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        await connection.beginTransaction();
        await connection.query('DELETE FROM user_rol WHERE user_id = ?', [userId]);
        await connection.query('DELETE FROM users WHERE user_id = ?', [userId]);
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