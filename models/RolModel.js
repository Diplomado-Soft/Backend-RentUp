const db = require('../config/db');

class Rol {
    static async getAll() {
        const [rows] = await db.query('SELECT rol_id, rol FROM rol ORDER BY rol_id');
        return rows;
    }

    static async getById(rolId) {
        const [rows] = await db.query('SELECT rol_id, rol FROM rol WHERE rol_id = ?', [rolId]);
        return rows[0] || null;
    }

    static async getByName(name) {
        const [rows] = await db.query('SELECT rol_id, rol FROM rol WHERE rol = ?', [name]);
        return rows[0] || null;
    }

    static async getValidIds() {
        const [rows] = await db.query('SELECT rol_id FROM rol');
        return rows.map(r => r.rol_id);
    }
}

module.exports = Rol;
