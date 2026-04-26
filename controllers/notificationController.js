const NotificationModel = require('../models/NotificationModel');

/**
 * GET /admin/notifications
 * Obtener notificaciones in-app del admin autenticado
 */
exports.getNotifications = async (req, res) => {
    try {
        const user_id  = req.user.id || req.user.user_id;
        const user_role = req.user.rol || req.user.rol_id || req.user.userRole;

        console.log('🔔 getNotifications - user_id:', user_id, 'user_role:', user_role);

        if (user_role !== 3 && user_role !== '3') {
            return res.status(403).json({ success: false, error: 'Acceso denegado' });
        }

        const notifications = await NotificationModel.getForAdmin(user_id, 60);
        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Error obteniendo notificaciones:', error);
        res.status(500).json({ error: 'Error al obtener notificaciones' });
    }
};

/**
 * PUT /admin/notifications/:id/read
 * Marcar una notificación como leída
 */
exports.markRead = async (req, res) => {
    try {
        const user_id   = req.user.id || req.user.user_id;
        const user_role = req.user.rol || req.user.rol_id || req.user.userRole;
        if (user_role !== 3 && user_role !== '3') return res.status(403).json({ error: 'Acceso denegado' });

        const { id } = req.params;
        await NotificationModel.markRead(parseInt(id), user_id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al marcar notificación' });
    }
};

/**
 * PUT /admin/notifications/read-all
 * Marcar todas las notificaciones como leídas
 */
exports.markAllRead = async (req, res) => {
    try {
        const user_id   = req.user.id || req.user.user_id;
        const user_role = req.user.rol || req.user.rol_id || req.user.userRole;
        if (user_role !== 3 && user_role !== '3') return res.status(403).json({ error: 'Acceso denegado' });

        const count = await NotificationModel.markAllRead(user_id);
        res.json({ success: true, updated: count });
    } catch (error) {
        res.status(500).json({ error: 'Error al marcar notificaciones' });
    }
};
