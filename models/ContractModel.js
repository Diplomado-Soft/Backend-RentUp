const db = require('../config/db');

class Contract {
    static async create(data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            console.log('Creating rental agreement with data:', data);

            const [result] = await connection.query(
                `INSERT INTO rental_agreements 
                    (property_id, tenant_id, landlord_id, start_date, end_date, monthly_rent, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')`,
                [
                    data.id_apt,
                    data.tenant_id,
                    data.landlord_id,
                    data.start_date,
                    data.end_date,
                    data.monthly_rent
                ]
            );

            console.log('Rental agreement created, updating apartment status');

            await connection.query(
                'UPDATE apartments SET status = ? WHERE id_apt = ?',
                ['rented', data.id_apt]
            );

            await connection.commit();
            console.log('Transaction committed successfully');
            return { insertId: result.insertId, ...data };
        } catch (error) {
            await connection.rollback();
            console.error('Error in create:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getApartmentContracts(landlord_id) {
        const [results] = await db.query(
            `SELECT r.*, a.direccion_apt, b.barrio, a.status as apt_status,
                    tenant.user_name as tenant_name, tenant.user_lastname as tenant_lastname, tenant.user_email as tenant_email
            FROM rental_agreements r
            LEFT JOIN apartments a ON r.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users tenant ON r.tenant_id = tenant.user_id
            WHERE r.landlord_id = ?
            ORDER BY r.created_at DESC`,
            [landlord_id]
        );
        return results;
    }

    static async getAvailableApartments(landlord_id) {
        const [results] = await db.query(
            `SELECT a.id_apt, a.direccion_apt, b.barrio, a.price, a.status as apt_status
            FROM apartments a
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            WHERE a.user_id = ? AND a.status = 'available'
            ORDER BY a.direccion_apt`,
            [landlord_id]
        );
        return results;
    }

    static async getById(id_contract) {
        const [results] = await db.query(
            `SELECT r.*, 
                    a.direccion_apt, b.barrio,
                    tenant.user_name as tenant_name, tenant.user_email as tenant_email,
                    landlord.user_name as landlord_name, landlord.user_email as landlord_email
            FROM rental_agreements r
            LEFT JOIN apartments a ON r.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users tenant ON r.tenant_id = tenant.user_id
            LEFT JOIN users landlord ON r.landlord_id = landlord.user_id
            WHERE r.agreement_id = ?`,
            [id_contract]
        );
        return results[0];
    }

    static async getByTenant(tenant_id) {
        const [results] = await db.query(
            `SELECT r.*, 
                    a.direccion_apt, b.barrio as barrio_name,
                    landlord.user_name as landlord_name, landlord.user_lastname as landlord_lastname,
                    landlord.user_email as landlord_email, landlord.user_phonenumber as landlord_phone
            FROM rental_agreements r
            LEFT JOIN apartments a ON r.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users landlord ON r.landlord_id = landlord.user_id
            WHERE r.tenant_id = ?
            ORDER BY r.created_at DESC`,
            [tenant_id]
        );
        return results;
    }

    static async getByLandlord(landlord_id) {
        const [results] = await db.query(
            `SELECT r.*, 
                    a.direccion_apt, b.barrio,
                    tenant.user_name as tenant_name, tenant.user_lastname as tenant_lastname
            FROM rental_agreements r
            LEFT JOIN apartments a ON r.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users tenant ON r.tenant_id = tenant.user_id
            WHERE r.landlord_id = ?
            ORDER BY r.created_at DESC`,
            [landlord_id]
        );
        return results;
    }

    static async getActiveContracts() {
        const [results] = await db.query(
            `SELECT r.*, 
                    a.direccion_apt, b.barrio,
                    tenant.user_name as tenant_name, tenant.user_email as tenant_email,
                    landlord.user_name as landlord_name
            FROM rental_agreements r
            LEFT JOIN apartments a ON r.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users tenant ON r.tenant_id = tenant.user_id
            LEFT JOIN users landlord ON r.landlord_id = landlord.user_id
            WHERE r.status = 'active'
            ORDER BY r.end_date ASC`
        );
        return results;
    }

    static async updateStatus(id_contract, status) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                'UPDATE rental_agreements SET status = ? WHERE agreement_id = ?',
                [status, id_contract]
            );

            if (result.affectedRows > 0) {
                const [contractInfo] = await connection.query(
                    'SELECT property_id FROM rental_agreements WHERE agreement_id = ?',
                    [id_contract]
                );

                if (contractInfo.length > 0) {
                    const property_id = contractInfo[0].property_id;
                    let apartmentStatus = 'available';

                    await connection.execute(
                        'UPDATE apartments SET status = ? WHERE id_apt = ?',
                        [apartmentStatus, property_id]
                    );
                }
            }

            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async searchTenants(query) {
        const [results] = await db.query(
            `SELECT u.user_id, u.user_name, u.user_lastname, u.user_email
            FROM users u
            LEFT JOIN user_rol ur ON u.user_id = ur.user_id
            WHERE (ur.rol_id = 1 OR ur.rol_id IS NULL)
            AND (u.user_email LIKE ? OR u.user_name LIKE ? OR u.user_lastname LIKE ?)
            LIMIT 20`,
            [`%${query}%`, `%${query}%`, `%${query}%`]
        );
        return results;
    }

    static async getTenantById(tenant_id) {
        const [results] = await db.query(
            `SELECT u.user_id, u.user_name, u.user_lastname, u.user_email, u.user_phonenumber
            FROM users u
            WHERE u.user_id = ?`,
            [tenant_id]
        );
        return results[0] || null;
    }

    static async getMonthlyStats(year, month) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const [results] = await db.query(
            `SELECT 
                COUNT(*) as total_contracts,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contracts,
                SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_contracts,
                SUM(monthly_rent) as total_revenue,
                AVG(monthly_rent) as average_rent,
                COUNT(DISTINCT landlord_id) as total_landlords,
                COUNT(DISTINCT tenant_id) as total_tenants
            FROM rental_agreements
            WHERE start_date <= ? AND end_date >= ?`,
            [endDate, startDate]
        );
        return results[0];
    }

    static async getContractDetailsForReport(startDate, endDate) {
        const [results] = await db.query(
            `SELECT 
                r.agreement_id,
                r.start_date,
                r.end_date,
                r.monthly_rent,
                r.status,
                a.direccion_apt,
                b.barrio as barrio_name,
                tenant.user_name as tenant_name,
                tenant.user_lastname as tenant_lastname,
                landlord.user_name as landlord_name,
                landlord.user_lastname as landlord_lastname
            FROM rental_agreements r
            LEFT JOIN apartments a ON r.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users tenant ON r.tenant_id = tenant.user_id
            LEFT JOIN users landlord ON r.landlord_id = landlord.user_id
            WHERE r.start_date >= ? AND r.start_date <= ?
            ORDER BY r.start_date DESC`,
            [startDate, endDate]
        );
        return results;
    }

    static async hasUserRentedProperty(userId, propertyId) {
        const [results] = await db.query(
            `SELECT agreement_id, status, start_date, end_date
            FROM rental_agreements 
            WHERE property_id = ? 
            AND tenant_id = ?
            AND status IN ('active', 'expired')`,
            [propertyId, userId]
        );
        return results.length > 0 ? results[0] : null;
    }

    static async expireOldContracts() {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [expiredContracts] = await connection.query(
                `SELECT agreement_id, property_id FROM rental_agreements 
                WHERE status = 'active' AND end_date < CURDATE()`
            );

            if (expiredContracts.length > 0) {
                for (const contract of expiredContracts) {
                    await connection.execute(
                        'UPDATE rental_agreements SET status = ? WHERE agreement_id = ?',
                        ['expired', contract.agreement_id]
                    );
                    await connection.execute(
                        'UPDATE apartments SET status = ? WHERE id_apt = ?',
                        ['available', contract.property_id]
                    );
                }
                console.log(`Expired ${expiredContracts.length} contracts automatically`);
            }

            await connection.commit();
            return expiredContracts.length;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = Contract;