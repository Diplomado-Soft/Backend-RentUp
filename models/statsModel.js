const db = require('../config/db');

class Stats {
    // Método para obtener estadísticas de los apartamentos
    static async getStats(userId) {
        try {
            const [results] = await db.query(
                `SELECT 
                    u.user_name AS arrendador_nombre,
                    u.user_lastname AS arrendador_apellido,
                    a.id_apt,
                    a.direccion_apt,
                    b.barrio,
                    TIMESTAMPDIFF(MONTH, ra.start_date, IFNULL(ra.end_date, CURDATE())) + 1 AS meses_arrendado,
                    DATE_FORMAT(ra.start_date, '%Y-%m') AS inicio_arrendamiento,
                    DATE_FORMAT(IFNULL(ra.end_date, CURDATE()), '%Y-%m') AS fin_arrendamiento,
                    u2.user_name AS inquilino_nombre,
                    u2.user_lastname AS inquilino_apellido,
                    u2.user_email AS inquilino_email
                FROM apartments a
                JOIN rental_agreements ra ON a.id_apt = ra.property_id
                JOIN users u ON a.user_id = u.user_id
                JOIN users u2 ON ra.tenant_id = u2.user_id
                JOIN barrio b ON a.id_barrio = b.id_barrio
                WHERE a.user_id = ?
                ORDER BY TIMESTAMPDIFF(MONTH, ra.start_date, IFNULL(ra.end_date, CURDATE())) DESC, ra.start_date DESC
                LIMIT 1;`,
                [userId]
            );
            return results;
        } catch (error) {
            console.error("Error en Stats.getStats:", error);
            throw error;
        }
    }
    // Método para obtener el arrendador con más apartamentos publicados
    static async getTopLandlord() {
        try {
            const [results] = await db.query(
                `SELECT 
                    detalles_usuario.id_arrendador,
                    detalles_usuario.nombre_completo,
                    detalles_usuario.correo,
                    publicaciones.total_apartamentos_publicados
                FROM 
                (
                    SELECT 
                        u.user_id AS id_arrendador,
                        CONCAT(u.user_name, ' ', IFNULL(u.user_lastname, '')) AS nombre_completo,
                        u.user_email AS correo
                    FROM 
                        users u
                    WHERE 
                        EXISTS (
                            SELECT 1 
                            FROM apartments a 
                            WHERE a.user_id = u.user_id
                        )
                ) AS detalles_usuario
                JOIN 
                (
                    SELECT 
                        a.user_id AS id_arrendador,
                        COUNT(a.id_apt) AS total_apartamentos_publicados
                    FROM 
                        apartments a
                    GROUP BY 
                        a.user_id
                ) AS publicaciones
                ON 
                    detalles_usuario.id_arrendador = publicaciones.id_arrendador
                WHERE 
                    publicaciones.total_apartamentos_publicados = (
                        SELECT 
                            MAX(apartamentos_contados.total_apartamentos)
                        FROM 
                        (
                            SELECT 
                                user_id, COUNT(id_apt) AS total_apartamentos
                            FROM 
                                apartments
                            GROUP BY 
                                user_id
                        ) AS apartamentos_contados
                    );`
            );
            console.log("Arrendador/es con más apartamentos publicados:", results); // Para depuración
            return results; // Devuelve el resultado
        } catch (error) {
            console.error("Error en Stats.getTopLandlord:", error); // Manejo de errores
            throw error;
        }
    }

    static async getAdminStats() {
        try {
            const [[userCounts]] = await db.query(`
                SELECT 
                    COUNT(DISTINCT u.user_id) AS total_users,
                    COUNT(DISTINCT CASE WHEN ur.rol_id = 2 THEN u.user_id END) AS total_landlords,
                    COUNT(DISTINCT CASE WHEN ur.rol_id = 1 THEN u.user_id END) AS total_tenants,
                    COUNT(DISTINCT CASE WHEN ur.rol_id = 3 THEN u.user_id END) AS total_admins
                FROM users u
                LEFT JOIN user_rol ur ON u.user_id = ur.user_id
                WHERE u.is_active = TRUE
            `);

            const [[aptCounts]] = await db.query(`
                SELECT
                    COUNT(*) AS total_apartments,
                    SUM(CASE WHEN publication_status = 'approved' THEN 1 ELSE 0 END) AS approved_apartments,
                    SUM(CASE WHEN publication_status = 'pending' THEN 1 ELSE 0 END) AS pending_apartments,
                    SUM(CASE WHEN publication_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_apartments
                FROM apartments
            `);

            const [[contractStats]] = await db.query(`
                SELECT
                    COUNT(*) AS total_contracts,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_contracts,
                    SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired_contracts,
                    COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_rent ELSE 0 END), 0) AS monthly_revenue,
                    COALESCE(AVG(CASE WHEN status = 'active' THEN monthly_rent END), 0) AS average_rent
                FROM rental_agreements
            `);

            const [topLandlords] = await db.query(`
                SELECT 
                    u.user_id, u.user_name, u.user_lastname, u.user_email,
                    COUNT(a.id_apt) AS total_apartments
                FROM users u
                JOIN apartments a ON u.user_id = a.user_id
                GROUP BY u.user_id, u.user_name, u.user_lastname, u.user_email
                ORDER BY total_apartments DESC
                LIMIT 3
            `);

            return {
                users: userCounts,
                apartments: aptCounts,
                contracts: contractStats,
                topLandlords
            };
        } catch (error) {
            console.error("Error en Stats.getAdminStats:", error);
            throw error;
        }
    }

    static async getOccupationTrend(days = 30) {
        try {
            const [rows] = await db.query(`
                SELECT
                    DATE(ra.start_date) AS date,
                    COUNT(*) AS contracts
                FROM rental_agreements ra
                WHERE ra.status = 'active'
                  AND ra.start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY DATE(ra.start_date)
                ORDER BY date ASC
            `, [parseInt(days)]);

            const totalApproved = await db.query(
                `SELECT COUNT(*) AS count FROM apartments WHERE publication_status = 'approved'`
            );
            const approvedCount = totalApproved[0][0]?.count || 1;

            const filled = rows.map(r => ({
                date: r.date,
                contracts: r.contracts,
                occupancy_pct: Math.min(100, Math.round((r.contracts / approvedCount) * 100))
            }));

            return filled;
        } catch (error) {
            console.error("Error en Stats.getOccupationTrend:", error);
            throw error;
        }
    }

    static async getRevenueByZone() {
        try {
            const [rows] = await db.query(`
                SELECT
                    b.barrio AS zone,
                    COALESCE(SUM(ra.monthly_rent), 0) AS total_revenue,
                    COUNT(ra.agreement_id) AS contract_count
                FROM barrio b
                LEFT JOIN apartments a ON b.id_barrio = a.id_barrio
                LEFT JOIN rental_agreements ra ON a.id_apt = ra.property_id AND ra.status = 'active'
                GROUP BY b.id_barrio, b.barrio
                HAVING total_revenue > 0
                ORDER BY total_revenue DESC
            `);

            const maxRevenue = rows.length > 0 ? Math.max(...rows.map(r => r.total_revenue)) : 1;
            return rows.map(r => ({
                zone: r.zone,
                amount: r.total_revenue,
                pct: Math.round((r.total_revenue / maxRevenue) * 100),
                contracts: r.contract_count
            }));
        } catch (error) {
            console.error("Error en Stats.getRevenueByZone:", error);
            throw error;
        }
    }

    static async getVacancyRate() {
        try {
            const [[{ total_approved, vacant, occupied }]] = await db.query(`
                SELECT
                    COUNT(*) AS total_approved,
                    SUM(CASE WHEN a.id_apt NOT IN (
                        SELECT ra.property_id FROM rental_agreements ra WHERE ra.status = 'active'
                    ) THEN 1 ELSE 0 END) AS vacant,
                    SUM(CASE WHEN a.id_apt IN (
                        SELECT ra.property_id FROM rental_agreements ra WHERE ra.status = 'active'
                    ) THEN 1 ELSE 0 END) AS occupied
                FROM apartments a
                WHERE a.publication_status = 'approved'
            `);

            const vacancyRate = total_approved > 0
                ? Math.round((vacant / total_approved) * 1000) / 10
                : 0;
            const occupancyRate = total_approved > 0
                ? Math.round((occupied / total_approved) * 1000) / 10
                : 0;

            return {
                vacancy_rate: vacancyRate,
                occupancy_rate: occupancyRate,
                total_approved,
                vacant,
                occupied
            };
        } catch (error) {
            console.error("Error en Stats.getVacancyRate:", error);
            throw error;
        }
    }
}

module.exports = Stats;
