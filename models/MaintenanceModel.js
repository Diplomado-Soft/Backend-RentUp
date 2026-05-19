const db = require('../config/db');
const NotificationModel = require('./NotificationModel');
const { sendMaintenanceNotificationEmail } = require('../utils/emailService');

class MaintenanceModel {
    static async ensureTable() {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS maintenance_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                property_id INT NOT NULL,
                tenant_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
                status ENUM('pending','in_progress','resolved','rejected') DEFAULT 'pending',
                image_url VARCHAR(500),
                landlord_notes TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                resolved_at DATETIME,
                INDEX idx_property (property_id),
                INDEX idx_tenant (tenant_id),
                INDEX idx_status (status)
            )
        `);
    }

    static async init() {
        await this.ensureTable();
    }

    static async create({ property_id, tenant_id, title, description, priority, image_url }) {
        const [result] = await db.execute(
            `INSERT INTO maintenance_reports (property_id, tenant_id, title, description, priority, image_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [property_id, tenant_id, title, description || null, priority || 'medium', image_url || null]
        );
        return result.insertId;
    }

    static async getByTenant(tenant_id) {
        const [rows] = await db.query(
            `SELECT mr.*, a.direccion_apt, b.barrio
             FROM maintenance_reports mr
             LEFT JOIN apartments a ON mr.property_id = a.id_apt
             LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
             WHERE mr.tenant_id = ?
             ORDER BY mr.created_at DESC`,
            [tenant_id]
        );
        return rows;
    }

    static async getByProperty(property_id) {
        const [rows] = await db.query(
            `SELECT mr.*, u.user_name, u.user_lastname, u.user_phonenumber
             FROM maintenance_reports mr
             LEFT JOIN users u ON mr.tenant_id = u.user_id
             WHERE mr.property_id = ?
             ORDER BY mr.created_at DESC`,
            [property_id]
        );
        return rows;
    }

    static async getByLandlord(landlord_id) {
        const [rows] = await db.query(
            `SELECT mr.*, a.direccion_apt, b.barrio, u.user_name, u.user_lastname, u.user_phonenumber
             FROM maintenance_reports mr
             LEFT JOIN apartments a ON mr.property_id = a.id_apt
             LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
             LEFT JOIN users u ON mr.tenant_id = u.user_id
             WHERE a.user_id = ?
             ORDER BY mr.created_at DESC`,
            [landlord_id]
        );
        return rows;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM maintenance_reports WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async getById(id) {
        const [rows] = await db.execute(
            `SELECT mr.*, a.direccion_apt, b.barrio, a.user_id as landlord_id,
                    u.user_name, u.user_lastname, u.user_phonenumber
             FROM maintenance_reports mr
             LEFT JOIN apartments a ON mr.property_id = a.id_apt
             LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
             LEFT JOIN users u ON mr.tenant_id = u.user_id
             WHERE mr.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    static async updateStatus(id, status, landlord_notes = null) {
        const resolvedAt = status === 'resolved' ? 'NOW()' : null;
        const [result] = await db.execute(
            `UPDATE maintenance_reports SET status = ?, landlord_notes = ?,
             resolved_at = ${resolvedAt ? 'NOW()' : null}
             WHERE id = ?`,
            [status, landlord_notes || null, id]
        );
        return result.affectedRows > 0;
    }

    static async getTenantActiveProperties(tenant_id) {
        const [rows] = await db.query(
            `SELECT a.id_apt, a.direccion_apt, b.barrio
             FROM rental_agreements r
             LEFT JOIN apartments a ON r.property_id = a.id_apt
             LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
             WHERE r.tenant_id = ? AND r.status = 'active'`,
            [tenant_id]
        );
        return rows;
    }

    static async getReportCountByProperty(property_id) {
        const [rows] = await db.query(
            `SELECT status, COUNT(*) as count
             FROM maintenance_reports
             WHERE property_id = ?
             GROUP BY status`,
            [property_id]
        );
        const result = { pending: 0, in_progress: 0, resolved: 0, rejected: 0 };
        rows.forEach(r => { result[r.status] = r.count; });
        return result;
    }

    static async notifyLandlord(landlord_id, report) {
        try {
            await NotificationModel.createForUser(landlord_id, {
                type: 'maintenance_new',
                title: 'Nuevo reporte de mantenimiento',
                message: `${report.title} - Prioridad: ${report.priority}`,
                reference_id: report.id,
                reference_type: 'maintenance'
            });
        } catch (e) {
            console.error('Error notificando arrendador:', e.message);
        }

        try {
            const [landlord] = await db.execute(
                'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                [landlord_id]
            );
            if (landlord.length > 0) {
                await sendMaintenanceNotificationEmail(
                    landlord[0].user_email,
                    landlord[0].user_name,
                    landlord[0].user_lastname,
                    report
                );
            }
        } catch (e) {
            console.error('Error enviando email al arrendador:', e.message);
        }
    }

    static async notifyTenantStatusChange(tenant_id, report) {
        try {
            await NotificationModel.createForUser(tenant_id, {
                type: 'maintenance_status',
                title: 'Reporte de mantenimiento actualizado',
                message: `"${report.title}" cambió a: ${report.status}`,
                reference_id: report.id,
                reference_type: 'maintenance'
            });
        } catch (e) {
            console.error('Error notificando inquilino:', e.message);
        }
    }
}

module.exports = MaintenanceModel;
