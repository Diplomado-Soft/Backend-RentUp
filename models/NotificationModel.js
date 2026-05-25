const db = require('../config/db');

class NotificationModel {
    /**
     * Crear tabla de notificaciones de usuario si no existe
     */
    static async ensureTable() {
        try {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS user_notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT,
                    reference_id INT,
                    reference_type VARCHAR(50),
                    read_at DATETIME,
                    created_at DATETIME NOT NULL,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at)
                )
            `);
            await db.execute(`
                CREATE TABLE IF NOT EXISTS admin_notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT,
                    reference_id INT,
                    reference_type VARCHAR(50),
                    read_at DATETIME,
                    created_at DATETIME NOT NULL,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at)
                )
            `);
        } catch (error) {
            console.error('Error creando tablas de notificaciones:', error);
        }
    }

    /**
     * Inicializar - llamar al inicio de la app
     */
    static async init() {
        await this.ensureTable();
    }

    /**
     * Crear una notificación para todos los admins
     */
    static async createForAdmins({ type, title, message, reference_id = null, reference_type = null }) {
        try {
            const [admins] = await db.execute(
                `SELECT u.user_id FROM users u
                 INNER JOIN user_rol ur ON u.user_id = ur.user_id
                 WHERE ur.rol_id = 3`
            );
            if (!admins.length) return [];

            const results = [];
            for (const admin of admins) {
                const [result] = await db.execute(
                    `INSERT INTO admin_notifications (user_id, type, title, message, reference_id, reference_type, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                    [admin.user_id, type, title, message, reference_id, reference_type]
                );
                results.push(result.insertId);
            }

            // Emitir en tiempo real a admins conectados
            try {
                const { emitAdminNotification } = require('../index');
                if (typeof emitAdminNotification === 'function') {
                    emitAdminNotification({ type, title, message, reference_id, reference_type });
                }
            } catch (e) {
                // Silencioso - socket puede no estar disponible
            }

            return results;
        } catch (error) {
            console.error('Error creando notificación:', error);
            throw error;
        }
    }

    static async createForUser(user_id, { type, title, message, reference_id = null, reference_type = null }) {
        try {
            const [result] = await db.execute(
                `INSERT INTO user_notifications (user_id, type, title, message, reference_id, reference_type, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [user_id, type, title, message, reference_id, reference_type]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creando notificación de usuario:', error);
            throw error;
        }
    }

    /**
     * Obtener notificaciones de un usuario
     */
    static async getForUser(user_id, limit = 50) {
        const [rows] = await db.execute(
            `SELECT * FROM user_notifications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [user_id, limit]
        );
        return rows;
    }

    /**
     * Obtener notificaciones de un admin
     */
    static async getForAdmin(user_id, limit = 50) {
        const safeLimit = parseInt(limit) || 50;
        const [rows] = await db.query(
            `SELECT * FROM admin_notifications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ${safeLimit}`,
            [user_id]
        );
        return rows;
    }

    /**
     * Marcar una notificación como leída
     */
    static async markRead(id, user_id) {
        const [result] = await db.execute(
            `UPDATE admin_notifications SET read_at = NOW()
             WHERE id = ? AND user_id = ? AND read_at IS NULL`,
            [id, user_id]
        );
        return result.affectedRows > 0;
    }

    /**
     * Marcar todas como leídas para un admin
     */
    static async markAllRead(user_id) {
        const [result] = await db.execute(
            `UPDATE admin_notifications SET read_at = NOW()
             WHERE user_id = ? AND read_at IS NULL`,
            [user_id]
        );
        return result.affectedRows;
    }

    static async delete(id, user_id) {
        const [result] = await db.execute(
            `DELETE FROM admin_notifications WHERE id = ? AND user_id = ?`,
            [id, user_id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = NotificationModel;
