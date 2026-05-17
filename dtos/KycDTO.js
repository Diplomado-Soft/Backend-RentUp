class KycDTO {
    constructor(verification) {
        this.id = verification.id;
        this.user_id = verification.user_id;
        this.apartment_id = verification.apartment_id;
        this.id_document_url = verification.id_document_url;
        this.property_certificate_url = verification.property_certificate_url;
        this.status = verification.status;
        this.admin_notes = verification.admin_notes;
        this.reviewed_by = verification.reviewed_by;
        this.reviewed_at = verification.reviewed_at;
        this.created_at = verification.created_at;
        this.updated_at = verification.updated_at;

        this.user_name = verification.user_name || null;
        this.user_lastname = verification.user_lastname || null;
        this.user_email = verification.user_email || null;
        this.user_phonenumber = verification.user_phonenumber || null;
        this.is_verified = !!verification.is_verified;

        this.direccion_apt = verification.direccion_apt || null;
        this.barrio = verification.barrio || null;
        this.price = verification.price || null;
        this.admin_name = verification.admin_name || null;
    }

    static fromDatabase(verification) {
        return new KycDTO(verification);
    }

    static fromDatabaseList(verifications) {
        return verifications.map(v => new KycDTO(v));
    }
}

module.exports = { KycDTO };
