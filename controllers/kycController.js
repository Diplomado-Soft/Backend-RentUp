const KycModel = require('../models/KycModel');
const { KycDTO } = require('../dtos');
const idriveService = require('../utils/idriveService');

class KycController {

    static async uploadDocuments(req, res) {
        try {
            const userId = req.user.id;
            const { apartment_id } = req.body;

            if (!apartment_id) {
                return res.status(400).json({ success: false, error: 'ID del apartamento es requerido' });
            }

            if (!req.kycDocuments || Object.keys(req.kycDocuments).length === 0) {
                return res.status(400).json({ success: false, error: 'Debe subir al menos un documento' });
            }

            const result = await KycModel.createVerification({
                userId,
                apartmentId: apartment_id,
                idDocumentUrl: req.kycDocuments.id_document?.url || null,
                idDocumentKey: req.kycDocuments.id_document?.key || null
            });

            return res.status(200).json({
                success: true,
                message: result.isUpdate
                    ? 'Documentos de verificación actualizados exitosamente'
                    : 'Documentos de verificación subidos exitosamente',
                data: { verificationId: result.id }
            });
        } catch (error) {
            console.error('Error subiendo documentos KYC:', error);
            return res.status(500).json({
                success: false,
                error: 'Error al subir documentos de verificación',
                details: error.message
            });
        }
    }

    static async getPendingVerifications(req, res) {
        try {
            const { limit = 50, offset = 0 } = req.query;

            const result = await KycModel.getPendingVerifications(
                parseInt(limit),
                parseInt(offset)
            );

            const dtoResult = {
                ...result,
                verifications: KycDTO.fromDatabaseList(result.verifications)
            };

            return res.status(200).json({
                success: true,
                data: dtoResult
            });
        } catch (error) {
            console.error('Error obteniendo verificaciones pendientes:', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener verificaciones pendientes',
                details: error.message
            });
        }
    }

    static async getAllVerifications(req, res) {
        try {
            const { limit = 50, offset = 0, status = '' } = req.query;

            const result = await KycModel.getAllVerifications(
                parseInt(limit),
                parseInt(offset),
                status
            );

            return res.status(200).json({
                success: true,
                data: {
                    ...result,
                    verifications: KycDTO.fromDatabaseList(result.verifications)
                }
            });
        } catch (error) {
            console.error('Error obteniendo verificaciones:', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener verificaciones'
            });
        }
    }

    static async getMyVerificationStatus(req, res) {
        try {
            const userId = req.user.id;

            const verification = await KycModel.getVerificationByUser(userId);

            if (!verification) {
                return res.status(200).json({
                    success: true,
                    data: null,
                    message: 'No has solicitado verificación todavía'
                });
            }

            return res.status(200).json({
                success: true,
                data: KycDTO.fromDatabase(verification)
            });
        } catch (error) {
            console.error('Error obteniendo estado de verificación:', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener estado de verificación'
            });
        }
    }

    static async approveVerification(req, res) {
        try {
            const { id } = req.params;
            const { notes = '' } = req.body;
            const adminId = req.user.id;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de verificación requerido'
                });
            }

            const result = await KycModel.approveVerification(id, adminId, notes);

            console.log(`✅ Verificación ${id} aprobada por admin ${adminId}`);

            return res.status(200).json({
                success: true,
                message: 'Verificación aprobada correctamente',
                data: result
            });
        } catch (error) {
            console.error('Error aprobando verificación:', error);
            return res.status(500).json({
                success: false,
                error: 'Error al aprobar verificación',
                details: error.message
            });
        }
    }

    static async refreshDocumentUrl(req, res) {
        try {
            const { key } = req.body;

            if (!key) {
                return res.status(400).json({
                    success: false,
                    error: 'La clave del documento es requerida'
                });
            }

            const result = await idriveService.getSignedUrl(key);

            if (!result) {
                return res.status(500).json({
                    success: false,
                    error: 'No se pudo refrescar la URL del documento'
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    signedUrl: result.signedUrl,
                    expiresAt: result.expiresAt
                }
            });
        } catch (error) {
            console.error('Error refrescando URL del documento:', error);
            return res.status(500).json({
                success: false,
                error: 'Error al refrescar la URL del documento',
                details: error.message
            });
        }
    }

    static async rejectVerification(req, res) {
        try {
            const { id } = req.params;
            const { notes = '' } = req.body;
            const adminId = req.user.id;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de verificación requerido'
                });
            }

            if (!notes || notes.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Motivo del rechazo requerido'
                });
            }

            const result = await KycModel.rejectVerification(id, adminId, notes);

            console.log(`❌ Verificación ${id} rechazada por admin ${adminId}. Motivo: ${notes}`);

            return res.status(200).json({
                success: true,
                message: 'Verificación rechazada correctamente',
                data: result
            });
        } catch (error) {
            console.error('Error rechazando verificación:', error);
            return res.status(500).json({
                success: false,
                error: 'Error al rechazar verificación',
                details: error.message
            });
        }
    }
}

module.exports = KycController;
