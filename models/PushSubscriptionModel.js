const db = require('../config/db');

class PushSubscriptionModel {
    static async ensureTable() {
        try {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    endpoint TEXT NOT NULL,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    UNIQUE KEY unique_endpoint (endpoint(500))
                )
            `);
        } catch (error) {
            console.error('Error creando tabla push_subscriptions:', error);
        }
    }

    static async init() {
        await this.ensureTable();
    }

    static async subscribe(userId, subscription) {
        try {
            const { endpoint, keys } = subscription;
            // Primero eliminar suscripción antigua si existe (para evitar duplicados)
            await db.execute(
                'DELETE FROM push_subscriptions WHERE endpoint = ?',
                [endpoint]
            );
            // Insertar nueva suscripción
            await db.execute(
                `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [userId, endpoint, keys.p256dh, keys.auth]
            );
            return true;
        } catch (error) {
            console.error('Error guardando suscripción push:', error);
            throw error;
        }
    }

    static async unsubscribe(userId, endpoint) {
        try {
            await db.execute(
                'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
                [userId, endpoint]
            );
            return true;
        } catch (error) {
            console.error('Error eliminando suscripción push:', error);
            throw error;
        }
    }

    static async getByUserId(userId) {
        try {
            const [rows] = await db.execute(
                'SELECT * FROM push_subscriptions WHERE user_id = ?',
                [userId]
            );
            return rows;
        } catch (error) {
            console.error('Error obteniendo suscripciones push:', error);
            return [];
        }
    }

    static async getAll() {
        try {
            const [rows] = await db.execute('SELECT * FROM push_subscriptions');
            return rows;
        } catch (error) {
            console.error('Error obteniendo todas las suscripciones push:', error);
            return [];
        }
    }

    static async removeByEndpoint(endpoint) {
        try {
            await db.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
        } catch (error) {
            console.error('Error eliminando suscripción por endpoint:', error);
        }
    }
}

module.exports = PushSubscriptionModel;
