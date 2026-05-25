const db = require('../config/db');

class Visit {
    static async create(data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [existing] = await connection.query(
                `SELECT id FROM visits 
                 WHERE property_id = ? AND visit_date = ? AND status = 'confirmed'
                 LIMIT 1`,
                [data.property_id, data.visit_date]
            );

            if (existing.length > 0) {
                const conflictErr = new Error('Ya existe una visita confirmada en esa fecha y hora para esta propiedad');
                conflictErr.statusCode = 409;
                throw conflictErr;
            }

            const [result] = await connection.query(
                `INSERT INTO visits (property_id, tenant_id, landlord_id, visit_date, status)
                 VALUES (?, ?, ?, ?, 'pending')`,
                [data.property_id, data.tenant_id, data.landlord_id, data.visit_date]
            );

            await connection.commit();

            const [created] = await connection.query(
                `SELECT v.*, a.direccion_apt, b.barrio,
                        tenant.user_name AS tenant_name, tenant.user_lastname AS tenant_lastname,
                        landlord.user_name AS landlord_name, landlord.user_lastname AS landlord_lastname
                 FROM visits v
                 LEFT JOIN apartments a ON v.property_id = a.id_apt
                 LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
                 LEFT JOIN users tenant ON v.tenant_id = tenant.user_id
                 LEFT JOIN users landlord ON v.landlord_id = landlord.user_id
                 WHERE v.id = ?`,
                [result.insertId]
            );

            return created[0];
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getByLandlord(landlord_id) {
        const [results] = await db.query(
            `SELECT v.*, a.direccion_apt, b.barrio,
                    tenant.user_name AS tenant_name, tenant.user_lastname AS tenant_lastname,
                    tenant.user_email AS tenant_email, tenant.user_phonenumber AS tenant_phone
             FROM visits v
             LEFT JOIN apartments a ON v.property_id = a.id_apt
             LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
             LEFT JOIN users tenant ON v.tenant_id = tenant.user_id
             WHERE v.landlord_id = ?
             ORDER BY v.visit_date DESC`,
            [landlord_id]
        );
        return results;
    }

    static async getByTenant(tenant_id) {
        const [results] = await db.query(
            `SELECT v.*, a.direccion_apt, b.barrio,
                    landlord.user_name AS landlord_name, landlord.user_lastname AS landlord_lastname
             FROM visits v
             LEFT JOIN apartments a ON v.property_id = a.id_apt
             LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
             LEFT JOIN users landlord ON v.landlord_id = landlord.user_id
             WHERE v.tenant_id = ?
             ORDER BY v.visit_date DESC`,
            [tenant_id]
        );
        return results;
    }

    static async confirm(id) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [visit] = await connection.query(
                'SELECT * FROM visits WHERE id = ? AND status = ?',
                [id, 'pending']
            );

            if (visit.length === 0) {
                const notFoundErr = new Error('Visita no encontrada o ya fue procesada');
                notFoundErr.statusCode = 404;
                throw notFoundErr;
            }

            const [conflict] = await connection.query(
                `SELECT id FROM visits 
                 WHERE property_id = ? AND visit_date = ? AND status = 'confirmed' AND id != ?
                 LIMIT 1`,
                [visit[0].property_id, visit[0].visit_date, id]
            );

            if (conflict.length > 0) {
                const conflictErr2 = new Error('Ya existe otra visita confirmada en esa fecha y hora para esta propiedad');
                conflictErr2.statusCode = 409;
                throw conflictErr2;
            }

            await connection.execute(
                'UPDATE visits SET status = ? WHERE id = ?',
                ['confirmed', id]
            );

            await connection.commit();

            const [updated] = await connection.query(
                `SELECT v.*, a.direccion_apt, b.barrio,
                        tenant.user_name AS tenant_name, tenant.user_lastname AS tenant_lastname,
                        landlord.user_name AS landlord_name, landlord.user_lastname AS landlord_lastname
                 FROM visits v
                 LEFT JOIN apartments a ON v.property_id = a.id_apt
                 LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
                 LEFT JOIN users tenant ON v.tenant_id = tenant.user_id
                 LEFT JOIN users landlord ON v.landlord_id = landlord.user_id
                 WHERE v.id = ?`,
                [id]
            );

            return updated[0];
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async cancel(id) {
        const [result] = await db.execute(
            'UPDATE visits SET status = ? WHERE id = ? AND status = ?',
            ['cancelled', id, 'pending']
        );
        return result;
    }
}

module.exports = Visit;
