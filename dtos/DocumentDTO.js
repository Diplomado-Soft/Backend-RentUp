/**
 * DocumentDTO - Data Transfer Object para respuestas de documentos
 * Mantiene la estructura original que espera el frontend
 * Estandariza solo las imágenes
 */
class DocumentDTO {
    constructor(data) {
        this.id_apt = data.id_apt;
        this.direccion_apt = data.direccion_apt;
        this.latitud_apt = data.latitud_apt;
        this.longitud_apt = data.longitud_apt;
        this.info_add_apt = data.info_add_apt;
        this.barrio = data.barrio;
        
        if (data.user_id || data.user_name) {
            this.user_id = data.user_id;
            this.user_name = data.user_name;
            this.user_lastname = data.user_lastname;
            this.user_email = data.user_email;
            this.user_phonenumber = data.user_phonenumber;
        }
        
        if (data.images) {
            this.images = data.images.split(',').map(img => img.trim()).filter(img => img);
        }
    }

    static fromDatabase(data) {
        return new DocumentDTO(data);
    }
}

module.exports = DocumentDTO;
