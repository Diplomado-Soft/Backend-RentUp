const VisitModel = require('../models/VisitModel');
const db = require('../config/db');
const pushService = require('../services/pushService');

exports.schedule = async (req, res) => {
    try {
        const tenant_id = req.user.id;
        const { property_id, landlord_id, visit_date } = req.body;

        if (!property_id || !landlord_id || !visit_date) {
            return res.status(400).json({ error: 'property_id, landlord_id y visit_date son requeridos' });
        }

        // El dueño del apartamento no puede agendar visita a su propia propiedad
        const [property] = await db.execute(
            'SELECT user_id FROM apartments WHERE id_apt = ?',
            [property_id]
        );
        if (!property || property.length === 0) {
            return res.status(404).json({ error: 'Propiedad no encontrada' });
        }
        if (property[0].user_id === tenant_id) {
            return res.status(403).json({ error: 'No puedes agendar una visita a tu propia propiedad' });
        }

        const visitDate = new Date(visit_date);
        if (isNaN(visitDate.getTime())) {
            return res.status(400).json({ error: 'Fecha de visita inválida' });
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        if (visitDate < tomorrow) {
            return res.status(400).json({ error: 'La visita debe agendarse con al menos un día de anticipación' });
        }

        const taken = await VisitModel.isTimeSlotTaken(property_id, visit_date);
        if (taken) {
            return res.status(409).json({ error: 'Este horario ya está ocupado. Por favor selecciona otro.' });
        }

        const insertId = await VisitModel.schedule({ property_id, tenant_id, landlord_id, visit_date });
        const visit = await VisitModel.getById(insertId);

        // Notificación push al arrendador
        try {
            const [aptInfo] = await db.execute(
                'SELECT direccion_apt FROM apartments WHERE id_apt = ?',
                [property_id]
            );
            const [tenantInfo] = await db.execute(
                'SELECT user_name, user_lastname FROM users WHERE user_id = ?',
                [tenant_id]
            );
            const tenantName = tenantInfo.length > 0
                ? `${tenantInfo[0].user_name} ${tenantInfo[0].user_lastname}`
                : 'Un estudiante';
            const aptAddress = aptInfo.length > 0 ? aptInfo[0].direccion_apt : 'una propiedad';
            const visitDateStr = new Date(visit_date).toLocaleDateString('es-CO', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            pushService.sendToUser(landlord_id, {
                title: 'Nueva visita agendada',
                body: `${tenantName} ha agendado una visita a ${aptAddress} para el ${visitDateStr}`,
                url: '/dashboard',
                type: 'visit_scheduled',
                referenceId: insertId,
                referenceType: 'visit',
            }).catch(e => console.error('Error push notif:', e.message));
        } catch (pushErr) {
            console.error('Error enviando push de visita:', pushErr.message);
        }

        res.status(201).json({ success: true, message: 'Visita agendada exitosamente', visit });
    } catch (error) {
        console.error('Error agendando visita:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getMyVisits = async (req, res) => {
    try {
        const visits = await VisitModel.getByTenant(req.user.id);
        res.json(visits);
    } catch (error) {
        console.error('Error obteniendo visitas:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getLandlordVisits = async (req, res) => {
    try {
        const visits = await VisitModel.getByLandlord(req.user.id);
        res.json(visits);
    } catch (error) {
        console.error('Error obteniendo visitas:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.confirm = async (req, res) => {
    try {
        const { id } = req.params;
        const visit = await VisitModel.getById(id);

        if (!visit) return res.status(404).json({ error: 'Visita no encontrada' });
        if (visit.landlord_id !== req.user.id) {
            return res.status(403).json({ error: 'No eres el arrendador de esta propiedad' });
        }
        if (visit.status !== 'pending') {
            return res.status(400).json({ error: 'Esta visita ya fue procesada' });
        }

        await VisitModel.confirm(id);
        const updated = await VisitModel.getById(id);

        res.json({ success: true, message: 'Visita confirmada', visit: updated });
    } catch (error) {
        console.error('Error confirmando visita:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.cancel = async (req, res) => {
    try {
        const { id } = req.params;
        const visit = await VisitModel.getById(id);

        if (!visit) return res.status(404).json({ error: 'Visita no encontrada' });
        if (visit.tenant_id !== req.user.id && visit.landlord_id !== req.user.id) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        if (visit.status === 'cancelled') {
            return res.status(400).json({ error: 'Esta visita ya fue cancelada' });
        }

        await VisitModel.cancel(id);
        console.log(`📅 Visita ${id} cancelada, horario liberado para otros usuarios`);
        res.json({ success: true, message: 'Visita cancelada. El horario ha sido liberado.' });
    } catch (error) {
        console.error('Error cancelando visita:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getOccupiedSlots = async (req, res) => {
    try {
        const { property_id, date } = req.query;
        if (!property_id || !date) {
            return res.status(400).json({ error: 'property_id y date son requeridos' });
        }
        const slots = await VisitModel.getOccupiedSlots(property_id, date);
        res.json({ occupied: slots });
    } catch (error) {
        console.error('Error obteniendo slots ocupados:', error);
        res.status(500).json({ error: error.message });
    }
};
