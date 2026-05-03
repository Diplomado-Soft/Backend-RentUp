/**
 * UpdateApartmentDTO - DTO para validación de actualización de apartamento
 */
class UpdateApartmentDTO {
    constructor(data) {
        this.direccion_apt = data.direccion_apt?.trim();
        this.barrio = data.barrio?.trim();
        this.latitud_apt = data.latitud_apt ? parseFloat(data.latitud_apt) : null;
        this.longitud_apt = data.longitud_apt ? parseFloat(data.longitud_apt) : null;
        this.info_add_apt = data.info_add_apt;
        this.existing_images = data.existing_images || [];
    }

    validate() {
        const errors = [];

        if (!this.direccion_apt || this.direccion_apt.length < 5) {
            errors.push('Dirección es requerida y debe tener al menos 5 caracteres');
        }

        if (!this.barrio || this.barrio.length < 2) {
            errors.push('Barrio es requerido y debe tener al menos 2 caracteres');
        }
        if (this.barrio && /\d/.test(this.barrio)) {
            errors.push('El barrio no debe contener números');
        }

        if (this.latitud_apt && (isNaN(this.latitud_apt) || this.latitud_apt < -90 || this.latitud_apt > 90)) {
            errors.push('Latitud inválida');
        }

        if (this.longitud_apt && (isNaN(this.longitud_apt) || this.longitud_apt < -180 || this.longitud_apt > 180)) {
            errors.push('Longitud inválida');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toDatabaseFormat() {
        return {
            direccion_apt: this.direccion_apt,
            barrio: this.barrio,
            latitud_apt: this.latitud_apt,
            longitud_apt: this.longitud_apt,
            info_add_apt: this.info_add_apt,
            existing_images: this.existing_images
        };
    }
}

module.exports = UpdateApartmentDTO;
