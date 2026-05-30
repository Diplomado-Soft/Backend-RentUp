const db = require('../config/db');

const ENTITY_MAP = {
    contract: { table: 'rental_agreements', idColumn: 'agreement_id', tenantColumn: 'tenant_id', landlordColumn: 'landlord_id' },
    payment: { table: 'payments', idColumn: 'payment_id', tenantColumn: 'tenant_id', landlordColumn: 'landlord_id' },
    visit: { table: 'visits', idColumn: 'id', tenantColumn: 'tenant_id', landlordColumn: 'landlord_id' },
    maintenance: { table: 'maintenance_reports', idColumn: 'id', tenantColumn: 'tenant_id', landlordColumn: null, landlordJoin: 'INNER JOIN apartments a ON m.property_id = a.id_apt', landlordSelect: 'a.user_id as landlord_id' },
    review: { table: 'reviews', idColumn: 'review_id', tenantColumn: 'reviewer_id', landlordColumn: null, landlordJoin: 'INNER JOIN apartments a ON m.property_id = a.id_apt', landlordSelect: 'a.user_id as landlord_id' },
};

exports.hide = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.rol;
        const { type } = req.params;
        const { id } = req.params;

        const entity = ENTITY_MAP[type];
        if (!entity) {
            return res.status(400).json({ success: false, error: 'Tipo de entidad no válido' });
        }

        const column = userRole === 1 ? 'vistainquilino' : 'vistaarrendador';

        const fromClause = entity.landlordJoin
            ? `${entity.table} m ${entity.landlordJoin}`
            : entity.table;
        const selectFields = entity.landlordJoin
            ? `m.${entity.tenantColumn} as tenant_id, ${entity.landlordSelect}`
            : `${entity.tenantColumn} as tenant_id${entity.landlordColumn ? `, ${entity.landlordColumn} as landlord_id` : ''}`;
        const whereClause = entity.landlordJoin
            ? `m.${entity.idColumn} = ?`
            : `${entity.idColumn} = ?`;

        const [rows] = await db.query(
            `SELECT ${selectFields} FROM ${fromClause} WHERE ${whereClause}`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Registro no encontrado' });
        }

        const row = rows[0];
        const tenantId = row.tenant_id;
        const landlordId = row.landlord_id || null;

        const isTenant = tenantId === parseInt(userId);
        const isLandlord = landlordId ? landlordId === parseInt(userId) : false;

        if (!isTenant && !isLandlord) {
            return res.status(403).json({ success: false, error: 'No autorizado para ocultar este registro' });
        }

        const allowedColumn = isTenant ? 'vistainquilino' : 'vistaarrendador';

        await db.execute(
            `UPDATE ${entity.table} SET ${allowedColumn} = 'inactivo' WHERE ${entity.idColumn} = ?`,
            [id]
        );

        res.json({ success: true, message: 'Registro ocultado correctamente' });
    } catch (error) {
        console.error('Error en visibility.hide:', error);
        res.status(500).json({ success: false, error: 'Error al ocultar el registro' });
    }
};
