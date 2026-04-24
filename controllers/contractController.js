const Contract = require('../models/ContractModel');

exports.createContract = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        console.log('User ID:', userId);
        console.log('Request body:', req.body);
        
        const {
            id_apt,
            tenant_id,
            start_date,
            end_date,
            monthly_rent,
            deposit_amount,
            terms,
            activate_immediately
        } = req.body;

        if (!id_apt || !tenant_id || !start_date || !end_date || !monthly_rent) {
            return res.status(400).json({
                error: 'Todos los campos requeridos deben ser proporcionados',
                details: { id_apt, tenant_id, start_date, end_date, monthly_rent }
            });
        }

        const contract = await Contract.create({
            id_apt: parseInt(id_apt),
            tenant_id: parseInt(tenant_id),
            landlord_id: userId,
            start_date,
            end_date,
            monthly_rent: parseFloat(monthly_rent),
            deposit_amount: deposit_amount ? parseFloat(deposit_amount) : null,
            status: 'active',
            terms
        });

        res.status(201).json({
            message: 'Arriendo creado exitosamente',
            contract
        });
    } catch (error) {
        console.error('Error creando contrato:', error);
        res.status(500).json({ 
            error: 'Error al crear el arriendo',
            message: error.message 
        });
    }
};

exports.getLandlordContracts = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const contracts = await Contract.getApartmentContracts(userId);
        res.json(contracts);
    } catch (error) {
        console.error('Error obteniendo contratos:', error);
        res.status(500).json({ error: 'Error al obtener los contratos' });
    }
};

exports.getAvailableApartments = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const apartments = await Contract.getAvailableApartments(userId);
        res.json(apartments);
    } catch (error) {
        console.error('Error obteniendo apartamentos disponibles:', error);
        res.status(500).json({ error: 'Error al obtener apartamentos' });
    }
};

exports.searchTenants = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }
        const tenants = await Contract.searchTenants(q);
        res.json(tenants);
    } catch (error) {
        console.error('Error buscando inquilinos:', error);
        res.status(500).json({ error: 'Error al buscar inquilinos' });
    }
};

exports.getMyContracts = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const userRole = req.user?.rol;

        console.log('getMyContracts - userId:', userId, 'userRole:', userRole);

        let contracts;
        if (userRole === 2) {
            contracts = await Contract.getByLandlord(userId);
        } else {
            contracts = await Contract.getByTenant(userId);
        }

        res.json(contracts);
    } catch (error) {
        console.error('Error obteniendo contratos:', error);
        res.status(500).json({ error: 'Error al obtener los contratos' });
    }
};

exports.getContractById = async (req, res) => {
    try {
        const { id_contract } = req.params;
        const contract = await Contract.getById(id_contract);

        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        res.json(contract);
    } catch (error) {
        console.error('Error obteniendo contrato:', error);
        res.status(500).json({ error: 'Error al obtener el contrato' });
    }
};

exports.updateContractStatus = async (req, res) => {
    try {
        const { agreement_id } = req.params;
        const { status } = req.body;

        const validStatuses = ['active', 'expired', 'terminated', 'pending'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        const result = await Contract.updateStatus(parseInt(agreement_id), status);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        res.json({ message: 'Estado del contrato actualizado' });
    } catch (error) {
        console.error('Error actualizando contrato:', error);
        res.status(500).json({ error: 'Error al actualizar el contrato' });
    }
};

exports.getMonthlyStats = async (req, res) => {
    try {
        const { year, month } = req.query;
        const stats = await Contract.getMonthlyStats(
            parseInt(year) || new Date().getFullYear(),
            parseInt(month) || new Date().getMonth() + 1
        );
        res.json(stats);
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

exports.expireOldContracts = async (req, res) => {
    try {
        const expiredCount = await Contract.expireOldContracts();
        res.json({ message: `${expiredCount} contratos expirados`, expiredCount });
    } catch (error) {
        console.error('Error expirando contratos:', error);
        res.status(500).json({ error: 'Error al expirar contratos' });
    }
};