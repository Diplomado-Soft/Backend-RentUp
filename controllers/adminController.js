/**
 * PUT /users/set-admin - Asignar rol de admin a un usuario
 * Solo puede ser llamado por un admin existente
 */
exports.setAdmin = async (req, res) => {
    const db = require('../config/db');
    const connection = await db.getConnection();
    
    try {
        const currentUserId = req.user?.id || req.user?.user_id;
        const { targetUserId, makeAdmin } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ error: 'ID de usuario objetivo requerido' });
        }

        const [currentUser] = await connection.query(
            'SELECT rol_id FROM user_rol WHERE user_id = ?',
            [currentUserId]
        );

        if (!currentUser.length || currentUser[0].rol_id !== 3) {
            return res.status(403).json({ error: 'Solo admins pueden asignar roles de admin' });
        }

        if (makeAdmin) {
            await connection.query(
                'UPDATE user_rol SET rol_id = 3, start_date = NOW() WHERE user_id = ?',
                [targetUserId]
            );
            res.json({ success: true, message: 'Usuario asignado como admin' });
        } else {
            await connection.query(
                'UPDATE user_rol SET rol_id = 1, start_date = NOW() WHERE user_id = ?',
                [targetUserId]
            );
            res.json({ success: true, message: 'Rol de admin removido' });
        }
    } catch (error) {
        console.error('Error asignando admin:', error);
        res.status(500).json({ error: 'Error al asignar rol de admin' });
    } finally {
        connection.release();
    }
};

/**
 * POST /admin/bootstrap - Crear primer admin (sin auth, solo si no hay admins)
 */
exports.bootstrapAdmin = async (req, res) => {
    const db = require('../config/db');
    const connection = await db.getConnection();
    
    try {
        const [admins] = await connection.query(
            'SELECT COUNT(*) as count FROM user_rol WHERE rol_id = 3'
        );

        if (admins[0].count > 0) {
            return res.status(403).json({ error: 'Ya existen admins' });
        }

        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'ID de usuario requerido' });
        }

        const [existing] = await connection.query(
            'SELECT * FROM user_rol WHERE user_id = ?',
            [userId]
        );

        if (existing.length > 0) {
            await connection.query(
                'UPDATE user_rol SET rol_id = 3 WHERE user_id = ?',
                [userId]
            );
        } else {
            await connection.query(
                'INSERT INTO user_rol (user_id, rol_id, start_date) VALUES (?, 3, NOW())',
                [userId]
            );
        }

        res.json({ success: true, message: 'Admin creado exitosamente' });
    } catch (error) {
        console.error('Error en bootstrap:', error);
        res.status(500).json({ error: 'Error al crear admin' });
    } finally {
        connection.release();
    }
};