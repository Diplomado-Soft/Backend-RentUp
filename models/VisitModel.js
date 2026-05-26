const db = require('../config/db');

class VisitModel {
    static async ensureTable() {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS visits (
                id INT AUTO_INCREMENT PRIMARY KEY,
                property_id INT NOT NULL,
                tenant_id INT NOT NULL,
                landlord_id INT NOT NULL,
                visit_date DATETIME NOT NULL,
                status ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_property (property_id),
                INDEX idx_tenant (tenant_id),
                INDEX idx_landlord (landlord_id),
                INDEX idx_status (status),
                INDEX idx_date (visit_date)
            )
        `);
    }

    static async init() {
        await this.ensureTable();
    }

    static async schedule({ property_id, tenant_id, landlord_id, visit_date }) {
        const [result] = await db.execute(
            `INSERT INTO visits (property_id, tenant_id, landlord_id, visit_date, status)
             VALUES (?, ?, ?, ?, 'pending')`,
            [property_id, tenant_id, landlord_id, visit_date]
        );
        return result.insertId;
    }

    static async isTimeSlotTaken(property_id, visit_date) {
        const [rows] = await db.execute(
            `SELECT id FROM visits
             WHERE property_id = ?
               AND visit_date = ?
               AND status != 'cancelled'`,
            [property_id, visit_date]
        );
        return rows.length > 0;
    }

    static async getById(id) {
        const [rows] = await db.execute(
            `SELECT v.*,
                    a.direccion_apt, b.barrio,
                    t.user_name as tenant_name, t.user_lastname as tenant_lastname, t.user_phonenumber as tenant_phone,
                    l.user_name as landlord_name, l.user_lastname as landlord_lastname
             FROM visits v
             LEFT JOIN apartments a ON v.property_id = a.id_apt
             LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
             LEFT JOIN users t ON v.tenant_id = t.user_id
             LEFT JOIN users l ON v.landlord_id = l.user_id
             WHERE v.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    static async getByTenant(tenant_id) {
        const [rows] = await db.query(
            `SELECT v.*,
                    a.direccion_apt, b.barrio,
                    l.user_name as landlord_name, l.user_lastname as landlord_lastname
             FROM visits v
             LEFT JOIN apartments a ON v.property_id = a.id_apt
             LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
             LEFT JOIN users l ON v.landlord_id = l.user_id
             WHERE v.tenant_id = ?
             ORDER BY v.visit_date DESC`,
            [tenant_id]
        );
        return rows;
    }

    static async getByLandlord(landlord_id) {
        const [rows] = await db.query(
            `SELECT v.*,
                    a.direccion_apt, b.barrio,
                    t.user_name as tenant_name, t.user_lastname as tenant_lastname, t.user_phonenumber as tenant_phone
             FROM visits v
             LEFT JOIN apartments a ON v.property_id = a.id_apt
             LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
             LEFT JOIN users t ON v.tenant_id = t.user_id
             WHERE v.landlord_id = ?
             ORDER BY v.visit_date DESC`,
            [landlord_id]
        );
        return rows;
    }

    static async confirm(id) {
        const [result] = await db.execute(
            `UPDATE visits SET status = 'confirmed' WHERE id = ? AND status = 'pending'`,
            [id]
        );
        return result.affectedRows > 0;
    }

    static async cancel(id) {
        const [result] = await db.execute(
            `UPDATE visits SET status = 'cancelled' WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }

    static async getOccupiedSlots(property_id, date) {
        const [rows] = await db.execute(
            `SELECT visit_date FROM visits
             WHERE property_id = ?
               AND DATE(visit_date) = ?
               AND status != 'cancelled'`,
            [property_id, date]
        );
        return rows.map(r => r.visit_date);
    }
}

module.exports = VisitModel;
