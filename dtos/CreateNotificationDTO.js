/**
 * CreateNotificationDTO - DTO para validación de creación de notificaciones
 */
class CreateNotificationDTO {
    constructor(data) {
        this.user_id = parseInt(data.user_id);
        this.type = data.type?.trim();
        this.title = data.title?.trim();
        this.message = data.message?.trim();
        this.reference_id = data.reference_id ? parseInt(data.reference_id) : null;
        this.reference_type = data.reference_type?.trim();
    }

    validate() {
        const errors = [];

        if (!this.user_id || isNaN(this.user_id)) {
            errors.push('user_id debe ser un número válido');
        }

        if (!this.type || this.type.length < 2) {
            errors.push('type es requerido y debe tener al menos 2 caracteres');
        }

        if (!this.title || this.title.length < 3) {
            errors.push('title es requerido y debe tener al menos 3 caracteres');
        }

        if (!this.message || this.message.length < 5) {
            errors.push('message es requerido y debe tener al menos 5 caracteres');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toDatabaseFormat() {
        return {
            user_id: this.user_id,
            type: this.type,
            title: this.title,
            message: this.message,
            reference_id: this.reference_id,
            reference_type: this.reference_type
        };
    }
}

module.exports = CreateNotificationDTO;
