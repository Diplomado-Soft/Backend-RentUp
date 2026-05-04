/**
 * NotificationDTO - Data Transfer Object para respuestas de notificaciones
 */
class NotificationDTO {
    constructor(notification, type = 'user') {
        this.id = notification.id;
        this.user_id = notification.user_id;
        this.type = notification.type;
        this.title = notification.title;
        this.message = notification.message;
        this.reference_id = notification.reference_id;
        this.reference_type = notification.reference_type;
        this.read_at = notification.read_at || null;
        this.created_at = notification.created_at;
        this.is_read = !!notification.read_at;
    }

    static fromDatabase(notification, type = 'user') {
        return new NotificationDTO(notification, type);
    }

    static fromDatabaseList(notifications, type = 'user') {
        return notifications.map(n => new NotificationDTO(n, type));
    }
}

module.exports = NotificationDTO;
