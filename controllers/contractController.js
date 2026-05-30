const Contract = require('../models/ContractModel');
const db = require('../config/db');
const { sendContractAgreementEmail, sendContractRenewalEmail, sendContractSignedEmail } = require('../utils/emailService');
const { CreateContractDTO, UpdateContractDTO, ContractDTO } = require('../dtos');
const { generateContractBuffer } = require('../utils/pdfContract');
const { uploadSignedPdf } = require('../utils/idriveService');

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
        if (contract.status !== 'active' && contract.status !== 'expired') {
            return res.status(400).json({ error: 'Solo se pueden renovar contratos activos o recién vencidos' });
        }
        if (contract.status === 'expired') {
            const endDate = new Date(contract.end_date);
            const now = new Date();
            const diffDays = Math.floor((now - endDate) / (1000 * 60 * 60 * 24));
            if (diffDays > 7) {
                return res.status(400).json({ error: 'El período de gracia de 7 días para renovar ha expirado' });
            }
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

        const result = await Contract.manualTerminateContract(parseInt(agreement_id));
        if (!result) {
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

exports.signContract = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const userRole = req.user?.rol;
        const { agreement_id } = req.params;
        const { signature } = req.body;

        console.log('signContract - userId:', userId, 'role:', userRole, 'agreement_id:', agreement_id);
        console.log('signContract - signature length:', signature?.length);

        if (!signature) {
            return res.status(400).json({ error: 'La firma es requerida' });
        }

        const contract = await Contract.getById(agreement_id);
        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        console.log('signContract - contract found:', contract.agreement_id, 'tenant:', contract.tenant_id, 'landlord:', contract.landlord_id);

        const updated = await Contract.sign(agreement_id, userId, userRole, signature);
        console.log('signContract - updated, signature keys:', updated.tenant_signature_key, updated.landlord_signature_key);

        const tenantSigned = !!updated.tenant_signature_key;
        const landlordSigned = !!updated.landlord_signature_key;

        if (tenantSigned && landlordSigned) {
            const { getSignatureBase64 } = require('../utils/idriveService');
            const [tenantSigBase64, landlordSigBase64] = await Promise.all([
                getSignatureBase64(updated.tenant_signature_key),
                getSignatureBase64(updated.landlord_signature_key)
            ]);

            const contractData = {
                ...contract,
                tenant_signature: tenantSigBase64,
                landlord_signature: landlordSigBase64,
                tenant_signed_at: updated.tenant_signed_at,
                landlord_signed_at: updated.landlord_signed_at
            };

            const pdfBuffer = await generateContractBuffer(contractData);

            const pdfKey = `contracts/${contract.agreement_id}/signed_${Date.now()}.pdf`;
            await uploadSignedPdf(pdfBuffer, pdfKey);

            await Contract.saveSignedPdfKey(contract.agreement_id, pdfKey);

            const { getSignedPdfUrl } = require('../utils/idriveService');
            const pdfUrlResult = await getSignedPdfUrl(pdfKey);
            if (pdfUrlResult) {
                await Contract.saveSignedPdfSignedUrl(contract.agreement_id, pdfUrlResult.signedUrl, pdfUrlResult.expiresAt);
            }

            try {
                const [tenant] = await db.query(
                    'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                    [contract.tenant_id]
                );
                const [landlord] = await db.query(
                    'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                    [contract.landlord_id]
                );

                if (tenant.length > 0) {
                    sendContractSignedEmail(
                        tenant[0].user_email,
                        tenant[0].user_name,
                        tenant[0].user_lastname,
                        contract.direccion_apt,
                        contract.agreement_id,
                        false
                    ).catch(e => console.error('Error email firma tenant:', e.message));
                }
                if (landlord.length > 0) {
                    sendContractSignedEmail(
                        landlord[0].user_email,
                        landlord[0].user_name,
                        landlord[0].user_lastname,
                        contract.direccion_apt,
                        contract.agreement_id,
                        true
                    ).catch(e => console.error('Error email firma landlord:', e.message));
                }
            } catch (emailErr) {
                console.error('Error sending signed emails:', emailErr.message);
            }
        }

        res.json({
            message: 'Contrato firmado exitosamente',
            signature_status: tenantSigned && landlordSigned ? 'fully_signed' : (tenantSigned ? 'signed_by_tenant' : 'signed_by_landlord'),
            contract: ContractDTO.fromDatabase(updated)
        });
    } catch (error) {
        console.error('Error firmando contrato:', error);
        res.status(500).json({ error: 'Error al firmar el contrato', message: error.message });
    }
};

exports.getContractPdf = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const { agreement_id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const contract = await Contract.getById(agreement_id);
        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        if (contract.tenant_id !== parseInt(userId) && contract.landlord_id !== parseInt(userId)) {
            return res.status(403).json({ error: 'No eres parte de este contrato' });
        }

        if (contract.tenant_signature_key && contract.landlord_signature_key && contract.signed_pdf_key) {
            await Contract.refreshSignedPdfUrl(agreement_id);
        }

        const { getSignatureBase64 } = require('../utils/idriveService');
        if (contract.tenant_signature_key) {
            contract.tenant_signature = await getSignatureBase64(contract.tenant_signature_key);
        } else if (!contract.tenant_signature) {
            contract.tenant_signature = null;
        }
        if (contract.landlord_signature_key) {
            contract.landlord_signature = await getSignatureBase64(contract.landlord_signature_key);
        } else if (!contract.landlord_signature) {
            contract.landlord_signature = null;
        }

        const pdfBuffer = await generateContractBuffer(contract);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contrato_${agreement_id}.pdf"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generando PDF:', error);
        res.status(500).json({ error: 'Error al generar el PDF', message: error.message });
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
