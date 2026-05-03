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
            userId: this.userId
        };
    }
}

module.exports = CreateApartmentDTO;
