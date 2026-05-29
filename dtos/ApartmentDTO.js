/**
 * ApartmentDTO - Data Transfer Object para respuestas de apartamentos
 */
class ApartmentDTO {
    constructor(apartment) {
        this.id_apt = apartment.id_apt;
        this.barrio = apartment.barrio;
        this.direccion_apt = apartment.direccion_apt;
        this.latitud_apt = apartment.latitud_apt;
        this.longitud_apt = apartment.longitud_apt;
        this.info_add_apt = apartment.info_add_apt;
        this.precio_apt = apartment.precio_apt || apartment.price || null;
        this.habitaciones = apartment.habitaciones || apartment.bedrooms || null;
        this.banos = apartment.banos || apartment.bathrooms || null;
        this.metros_apt = apartment.metros_apt || apartment.area_m2 || null;
        this.comodidades = apartment.comodidades || apartment.amenities || '';
        this.user_id = apartment.user_id;
        this.publication_status = apartment.publication_status || 'pending';
        this.status = apartment.status || 'available';
        this.images = apartment.images || [];
        this.user_name = apartment.user_name || null;
        this.user_lastname = apartment.user_lastname || null;
        this.user_phonenumber = apartment.user_phonenumber || null;
        this.whatsapp = apartment.whatsapp || null;
        this.id_document_url = apartment.id_document_url || null;
        this.id_document_key = apartment.id_document_key || null;
        this.kyc_status = apartment.kyc_status || 'pending';
    }

    static fromDatabase(apartment) {
        return new ApartmentDTO(apartment);
    }

    static fromDatabaseList(apartments) {
        return apartments.map(apt => new ApartmentDTO(apt));
    }
}

/**
 * CreateApartmentDTO - DTO para validación de creación de apartamento
 * Campos deben coincidir con lo que espera ApartmentModel.addApartment()
 */
class CreateApartmentDTO {
    constructor(data) {
        this.barrio = data.barrio?.trim();
        this.direccion = data.direccion?.trim() || data.direccion_apt?.trim();
        this.latitud = data.latitud ? parseFloat(data.latitud) : null;
        this.longitud = data.longitud ? parseFloat(data.longitud) : null;
        this.addInfo = data.addInfo || data.info_add_apt;
        this.price = data.price ? parseFloat(data.price) : null;
        this.bedrooms = data.bedrooms ? parseInt(data.bedrooms) : null;
        this.bathrooms = data.bathrooms ? parseInt(data.bathrooms) : null;
        this.area_m2 = data.area_m2 ? parseInt(data.area_m2) : null;
        this.amenities = data.amenities || data.comodidades || '';
        this.userId = data.userId || data.user_id;
    }

    validate() {
        const errors = [];

        if (!this.barrio || this.barrio.length < 2) {
            errors.push('Barrio es requerido y debe tener al menos 2 caracteres');
        }
        if (this.barrio && /\d/.test(this.barrio)) {
            errors.push('El barrio no debe contener números');
        }

        if (!this.direccion || this.direccion.length < 5) {
            errors.push('Dirección es requerida y debe tener al menos 5 caracteres');
        }

        if (!this.price || isNaN(this.price) || this.price <= 0) {
            errors.push('Precio debe ser un número válido mayor a 0');
        }

        if (this.latitud && (isNaN(this.latitud) || this.latitud < -90 || this.latitud > 90)) {
            errors.push('Latitud inválida');
        }

        if (this.longitud && (isNaN(this.longitud) || this.longitud < -180 || this.longitud > 180)) {
            errors.push('Longitud inválida');
        }

        if (this.bedrooms && (isNaN(this.bedrooms) || this.bedrooms < 0)) {
            errors.push('Número de habitaciones inválido');
        }

        if (this.bathrooms && (isNaN(this.bathrooms) || this.bathrooms < 0)) {
            errors.push('Número de baños inválido');
        }

        if (this.area_m2 && (isNaN(this.area_m2) || this.area_m2 <= 0)) {
            errors.push('Área debe ser un número válido mayor a 0');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toDatabaseFormat() {
        return {
            barrio: this.barrio,
            direccion: this.direccion,
            latitud: this.latitud,
            longitud: this.longitud,
            addInfo: this.addInfo,
            price: this.price,
            bedrooms: this.bedrooms,
            bathrooms: this.bathrooms,
            area_m2: this.area_m2,
            amenities: this.amenities,
            userId: this.userId
        };
    }
}

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

module.exports = {
    ApartmentDTO,
    CreateApartmentDTO,
    UpdateApartmentDTO
};
