const Apartment = require('../models/ApartmentModel');

class AdminApartmentController {
    
    // Obtener apartamentos pendientes de aprobación
    static async getPendingApartments(req, res) {
        try {
            const { limit = 50, offset = 0 } = req.query;
            
            const result = await Apartment.getPendingApartments(
                parseInt(limit),
                parseInt(offset)
            );

            res.status(200).json({
                success: true,
                message: 'Apartamentos pendientes obtenidos',
                data: result
            });
        } catch (error) {
            console.error('Error obteniendo apartamentos pendientes:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener apartamentos pendientes',
                details: error.message
            });
        }
    }

    // Aprobar apartamento
    static async approveApartment(req, res) {
        try {
            const { id_apt } = req.params;
            const { notes = '' } = req.body;
            const adminId = req.user.userId; // Del middleware de autenticación

            // Validación
            if (!id_apt) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de apartamento requerido'
                });
            }

            const result = await Apartment.approveApartment(id_apt, adminId, notes);

            // LOG de auditoría
            console.log(`✅ Apartamento ${id_apt} aprobado por admin ${adminId}`);

            res.status(200).json({
                success: true,
                message: 'Apartamento aprobado correctamente',
                data: result
            });
        } catch (error) {
            console.error('Error aprobando apartamento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al aprobar apartamento',
                details: error.message
            });
        }
    }

    // Rechazar apartamento
    static async rejectApartment(req, res) {
        try {
            const { id_apt } = req.params;
            const { notes = '' } = req.body;
            const adminId = req.user.userId;

            console.log('📝 rejectApartment called:', { id_apt, adminId, notes });

            // Validación
            if (!id_apt) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de apartamento requerido'
                });
            }

            if (!notes || notes.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Motivo del rechazo requerido'
                });
            }

            const result = await Apartment.rejectApartment(id_apt, adminId, notes);

            // LOG de auditoría
            console.log(`❌ Apartamento ${id_apt} rechazado por admin ${adminId}. Motivo: ${notes}`);

            res.status(200).json({
                success: true,
                message: 'Apartamento rechazado correctamente',
                data: result
            });
        } catch (error) {
            console.error('Error rechazando apartamento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al rechazar apartamento',
                details: error.message
            });
        }
    }

    // Obtener historial de aprobación de un apartamento
    static async getApprovalHistory(req, res) {
        try {
            const { id_apt } = req.params;

            if (!id_apt) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de apartamento requerido'
                });
            }

            const history = await Apartment.getApprovalHistory(id_apt);

            res.status(200).json({
                success: true,
                message: 'Historial de aprobación obtenido',
                data: history
            });
        } catch (error) {
            console.error('Error obteniendo historial:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener historial',
                details: error.message
            });
        }
    }

    // Obtener estado de publicación de un apartamento
    static async getPublicationStatus(req, res) {
        try {
            const { id_apt } = req.params;

            if (!id_apt) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de apartamento requerido'
                });
            }

            const status = await Apartment.getApartmentPublicationStatus(id_apt);

            if (!status) {
                return res.status(404).json({
                    success: false,
                    error: 'Apartamento no encontrado'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Estado de publicación obtenido',
                data: status
            });
        } catch (error) {
            console.error('Error obteniendo estado:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener estado de publicación',
                details: error.message
            });
        }
    }
}

module.exports = AdminApartmentController;
