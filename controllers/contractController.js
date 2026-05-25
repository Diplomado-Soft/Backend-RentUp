const Contract = require('../models/ContractModel');
const db = require('../config/db');
const { sendContractAgreementEmail, sendContractRenewalEmail } = require('../utils/emailService');
const { CreateContractDTO, UpdateContractDTO, ContractDTO } = require('../dtos');

exports.createContract = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        console.log('User ID:', userId);
        console.log('Request body:', req.body);

        // Usar CreateContractDTO para validación
        const contractDTO = new CreateContractDTO({
            ...req.body,
            landlord_id: userId
        });

        const validation = contractDTO.validate();
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Datos de contrato inválidos',
                errors: validation.errors
            });
        }

        if (userId === parseInt(req.body.tenant_id)) {
            return res.status(400).json({
                error: 'No puedes arrendar un apartamento a ti mismo'
            });
        }

        const dtoData = contractDTO.toDatabaseFormat();

        const contract = await Contract.create(dtoData);

        // Obtener datos para el correo
        const tenant_id = dtoData.tenant_id;
        const [tenantData] = await db.query(
            'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
            [tenant_id]
        );
        const [landlordData] = await db.query(
            'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
            [userId]
        );
        const [aptData] = await db.query(
            'SELECT direccion_apt FROM apartments WHERE id_apt = ?',
            [dtoData.id_apt]
        );

        const { start_date, end_date, monthly_rent } = dtoData;

        // Enviar correo al inquilino
        if (tenantData.length > 0) {
            sendContractAgreementEmail(
                tenantData[0].user_email,
                tenantData[0].user_name,
                tenantData[0].user_lastname,
                aptData[0]?.direccion_apt || 'Vivienda',
                new Date(start_date).toLocaleDateString(),
                new Date(end_date).toLocaleDateString(),
                monthly_rent
            ).catch(err => console.error('Error enviando correo a inquilino:', err.message));
        }

        // Enviar correo al arrendador
        if (landlordData.length > 0) {
            sendContractAgreementEmail(
                landlordData[0].user_email,
                landlordData[0].user_name,
                landlordData[0].user_lastname,
                aptData[0]?.direccion_apt || 'Vivienda',
                new Date(start_date).toLocaleDateString(),
                new Date(end_date).toLocaleDateString(),
                monthly_rent
            ).catch(err => console.error('Error enviando correo a arrendador:', err.message));
        }

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
        const aptContracts = await Contract.getApartmentContracts(userId);
        
        // Usar ContractDTO para formatear respuesta
        const formattedContracts = ContractDTO.fromDatabaseList(aptContracts);
        res.json(formattedContracts);
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
        const userId = req.user?.id || req.user?.userId;
        if (!q || q.length < 2) {
            return res.json([]);
        }
        const tenants = await Contract.searchTenants(q, userId);
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

        let myContracts;
        if (userRole === 2) {
            myContracts = await Contract.getByLandlord(userId);
        } else {
            myContracts = await Contract.getByTenant(userId);
        }

        // Usar ContractDTO para formatear respuesta
        const formattedContracts = ContractDTO.fromDatabaseList(myContracts);
        res.json(formattedContracts);
    } catch (error) {
        console.error('Error obteniendo contratos:', error);
        res.status(500).json({ error: 'Error al obtener los contratos' });
    }
};

exports.getContractById = async (req, res) => {
    try {
        const { agreement_id } = req.params;
        const contract = await Contract.getById(agreement_id);

        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        // Usar ContractDTO para formatear respuesta
        const contractDTO = ContractDTO.fromDatabase(contract);
        res.json(contractDTO);
    } catch (error) {
        console.error('Error obteniendo contrato:', error);
        res.status(500).json({ error: 'Error al obtener el contrato' });
    }
};

exports.updateContractStatus = async (req, res) => {
    try {
        const { agreement_id } = req.params;

        // Usar UpdateContractDTO para validación
        const updateDTO = new UpdateContractDTO(req.body);
        const validation = updateDTO.validate();
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Datos de actualización inválidos',
                details: validation.errors
            });
        }

        const dtoData = updateDTO.toDatabaseFormat();

        if (!dtoData.status) {
            return res.status(400).json({ error: 'Se requiere un estado válido' });
        }

        const result = await Contract.updateStatus(parseInt(agreement_id), dtoData.status);

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
            parseInt(month) || new Date().getMonth() +1
        );
        
        // Formatear respuesta (si es necesario)
        res.json(stats);
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

exports.renewContract = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const userRole = req.user?.rol;
        const { agreement_id } = req.params;
        const { months } = req.body;

        const monthsToAdd = months || 12;

        const contract = await Contract.getById(agreement_id);
        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        if (userRole !== 1 && userRole !== 2) {
            return res.status(403).json({ error: 'No autorizado para renovar este contrato' });
        }
        if (contract.tenant_id !== userId && contract.landlord_id !== userId) {
            return res.status(403).json({ error: 'No eres parte de este contrato' });
        }
        if (contract.status !== 'active') {
            return res.status(400).json({ error: 'Solo se pueden renovar contratos activos' });
        }

        const currentEnd = new Date(contract.end_date);
        const newEnd = new Date(currentEnd);
        newEnd.setMonth(newEnd.getMonth() + monthsToAdd);

        const renewed = await Contract.renew(parseInt(agreement_id), newEnd.toISOString().split('T')[0]);

        try {
            const [tenant] = await db.query(
                'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                [contract.tenant_id]
            );
            const [landlord] = await db.query(
                'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                [contract.landlord_id]
            );
            const [apt] = await db.query(
                'SELECT direccion_apt FROM apartments WHERE id_apt = ?',
                [contract.property_id]
            );

            if (tenant.length > 0) {
                sendContractRenewalEmail(
                    tenant[0].user_email,
                    tenant[0].user_name,
                    tenant[0].user_lastname,
                    apt[0]?.direccion_apt || 'N/A',
                    newEnd.toLocaleDateString('es-CO'),
                    monthsToAdd
                ).catch(e => console.error('Error email renovación tenant:', e.message));
            }
            if (landlord.length > 0) {
                sendContractRenewalEmail(
                    landlord[0].user_email,
                    landlord[0].user_name,
                    landlord[0].user_lastname,
                    apt[0]?.direccion_apt || 'N/A',
                    newEnd.toLocaleDateString('es-CO'),
                    monthsToAdd
                ).catch(e => console.error('Error email renovación landlord:', e.message));
            }
        } catch (emailErr) {
            console.error('Error enviando correo de renovación:', emailErr.message);
        }

        res.json({
            message: 'Contrato renovado exitosamente',
            contract: ContractDTO.fromDatabase(renewed)
        });

    } catch (error) {
        console.error('Error renovando contrato:', error);
        res.status(500).json({ error: 'Error al renovar el contrato', message: error.message });
    }
};

exports.endAndMakeAvailable = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const userRole = req.user?.rol;
        const { agreement_id } = req.params;

        const contract = await Contract.getById(agreement_id);
        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        if (userRole !== 1 && userRole !== 2) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        if (contract.tenant_id !== userId && contract.landlord_id !== userId) {
            return res.status(403).json({ error: 'No eres parte de este contrato' });
        }
        if (contract.status !== 'active') {
            return res.status(400).json({ error: 'El contrato no está activo' });
        }

        const expired = await Contract.hasAutoExpiredAndMakeAvailable(parseInt(agreement_id));
        if (!expired) {
            return res.status(400).json({ error: 'No se pudo finalizar el contrato' });
        }

        res.json({
            message: 'Contrato finalizado y vivienda marcada como disponible',
            agreement_id
        });

    } catch (error) {
        console.error('Error finalizando contrato:', error);
        res.status(500).json({ error: 'Error al finalizar el contrato', message: error.message });
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
