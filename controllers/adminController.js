const db = require('../config/db');

// Obtener todos los usuarios (Checklist: Componente de Tabla)
exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, username, email, role, status FROM users');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener usuarios", error });
    }
};

// Cambiar estado (Checklist: Acciones de Estado)
exports.toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'activo' o 'inactivo'
    try {
        await db.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: `Usuario actualizado a ${status}` });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar estado", error });
    }
};