class VisitDTO {
    constructor(visit) {
        this.id = visit.id;
        this.property_id = visit.property_id;
        this.tenant_id = visit.tenant_id;
        this.landlord_id = visit.landlord_id;
        this.visit_date = visit.visit_date;
        this.status = visit.status;
        this.created_at = visit.created_at;
        this.updated_at = visit.updated_at;
        this.direccion_apt = visit.direccion_apt || null;
        this.barrio = visit.barrio || null;
        this.tenant_name = visit.tenant_name
            ? `${visit.tenant_name} ${visit.tenant_lastname || ''}`.trim()
            : null;
        this.tenant_email = visit.tenant_email || null;
        this.tenant_phone = visit.tenant_phone || null;
        this.landlord_name = visit.landlord_name
            ? `${visit.landlord_name} ${visit.landlord_lastname || ''}`.trim()
            : null;
    }

    static fromDatabase(visit) {
        return new VisitDTO(visit);
    }

    static fromDatabaseList(visits) {
        return visits.map(v => new VisitDTO(v));
    }
}

class CreateVisitDTO {
    constructor(data) {
        this.property_id = parseInt(data.property_id, 10);
        this.tenant_id = parseInt(data.tenant_id, 10);
        this.landlord_id = parseInt(data.landlord_id, 10);
        this.visit_date = data.visit_date;
    }

    validate() {
        const errors = [];

        if (!this.property_id || isNaN(this.property_id)) {
            errors.push('property_id debe ser un número válido');
        }

        if (!this.tenant_id || isNaN(this.tenant_id)) {
            errors.push('tenant_id debe ser un número válido');
        }

        if (!this.landlord_id || isNaN(this.landlord_id)) {
            errors.push('landlord_id debe ser un número válido');
        }

        if (!this.visit_date) {
            errors.push('visit_date es requerido');
        } else {
            const date = new Date(this.visit_date);
            if (isNaN(date.getTime())) {
                errors.push('visit_date debe ser una fecha válida');
            } else if (date <= new Date()) {
                errors.push('visit_date debe ser una fecha futura');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toDatabaseFormat() {
        return {
            property_id: this.property_id,
            tenant_id: this.tenant_id,
            landlord_id: this.landlord_id,
            visit_date: this.visit_date
        };
    }
}

module.exports = {
    VisitDTO,
    CreateVisitDTO
};
