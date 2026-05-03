/**
 * ApartmentDTO - Data Transfer Object para respuestas de apartamentos
 * Estandariza la estructura de respuesta y oculta campos internos
 */
class ApartmentDTO {
    constructor(apartment) {
        this.id_apt = apartment.id_apt || apartment.id_apartamento;
        this.direccion_apt = apartment.direccion_apt || apartment.direccion_apartamento;
        this.barrio = apartment.barrio || apartment.barrio_apartamento || null;
        this.latitud_apt = apartment.latitud_apt || apartment.latitud_apartamento;
        this.longitud_apt = apartment.longitud_apt || apartment.longitud_apartamento;
        this.info_add_apt = apartment.info_add_apt || apartment.info_adicional_apartamento;
        this.price = apartment.price || apartment.precio_apt;
        this.bedrooms = apartment.bedrooms || apartment.habitaciones;
        this.bathrooms = apartment.bathrooms || apartment.banos;
        this.area_m2 = apartment.area_m2 || apartment.metros_apt;
        this.status = apartment.status || apartment.publication_status;
        this.created_date = apartment.created_date;
        this.updated_date = apartment.updated_date;
        this.published_date = apartment.published_date;
        
        if (apartment.admin_notes !== undefined) {
            this.admin_notes = apartment.admin_notes;
        }
        
        if (apartment.images) {
            this.images = apartment.images;
        }
        
        if (apartment.user_id || apartment.user_name) {
            this.user_id = apartment.user_id;
            this.user_name = apartment.user_name;
            this.user_lastname = apartment.user_lastname;
            this.user_email = apartment.user_email;
            this.user_phonenumber = apartment.user_phonenumber;
            this.whatsapp = apartment.whatsapp;
        }
    }

    static fromDatabase(apartment) {
        return new ApartmentDTO(apartment);
    }

    static fromDatabaseList(apartments) {
        return apartments.map(apt => new ApartmentDTO(apt));
    }
}

module.exports = ApartmentDTO;
