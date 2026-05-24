const Visit = require('../models/VisitModel');
const { CreateVisitDTO, VisitDTO } = require('../dtos/VisitDTO');

exports.schedule = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;

        const createDTO = new CreateVisitDTO({
            ...req.body,
            tenant_id: userId
        });

        const validation = createDTO.validate();
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Datos de visita inválidos',
                errors: validation.errors
            });
        }

        const dtoData = createDTO.toDatabaseFormat();
        const visit = await Visit.create(dtoData);

        res.status(201).json({
            message: 'Visita agendada exitosamente',
            visit: VisitDTO.fromDatabase(visit)
        });
    } catch (error) {
        if (error.statusCode === 409) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Error agendando visita:', error);
        res.status(500).json({ error: 'Error al agendar la visita', message: error.message });
    }
};

exports.getLandlordVisits = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const visits = await Visit.getByLandlord(userId);
        res.json(VisitDTO.fromDatabaseList(visits));
    } catch (error) {
        console.error('Error obteniendo visitas del arrendador:', error);
        res.status(500).json({ error: 'Error al obtener las visitas' });
    }
};

exports.getMyVisits = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const visits = await Visit.getByTenant(userId);
        res.json(VisitDTO.fromDatabaseList(visits));
    } catch (error) {
        console.error('Error obteniendo mis visitas:', error);
        res.status(500).json({ error: 'Error al obtener las visitas' });
    }
};

exports.confirmVisit = async (req, res) => {
    try {
        const { id } = req.params;
        const visit = await Visit.confirm(parseInt(id, 10));

        res.json({
            message: 'Visita confirmada exitosamente',
            visit: VisitDTO.fromDatabase(visit)
        });
    } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 409) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        console.error('Error confirmando visita:', error);
        res.status(500).json({ error: 'Error al confirmar la visita', message: error.message });
    }
};

exports.cancelVisit = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Visit.cancel(parseInt(id, 10));

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Visita no encontrada o ya fue procesada' });
        }

        res.json({ message: 'Visita cancelada exitosamente' });
    } catch (error) {
        console.error('Error cancelando visita:', error);
        res.status(500).json({ error: 'Error al cancelar la visita' });
    }
};
