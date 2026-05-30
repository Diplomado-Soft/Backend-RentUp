/**
 * ContractDTO - Data Transfer Object para respuestas de contratos
 */
class ContractDTO {
    constructor(contract) {
        this.agreement_id = contract.agreement_id;
        this.id_apt = contract.id_apt || contract.property_id;
        this.tenant_id = contract.tenant_id;
        this.landlord_id = contract.landlord_id;
        this.start_date = contract.start_date;
        this.end_date = contract.end_date;
        this.monthly_rent = contract.monthly_rent ? Number(contract.monthly_rent) : null;
        this.deposit_amount = contract.deposit_amount ? Number(contract.deposit_amount) : null;
        this.terms = contract.terms;
        this.status = contract.status;
        this.created_at = contract.created_at;
        this.tenant_name = contract.tenant_name || null;
        this.tenant_lastname = contract.tenant_lastname || null;
        this.landlord_name = contract.landlord_name || null;
        this.landlord_lastname = contract.landlord_lastname || null;
        this.property_address = contract.property_address || contract.direccion_apt || null;
        this.barrio = contract.barrio || contract.barrio_name || null;
        this.direccion_apt = contract.direccion_apt || null;
        this.images = contract.images || [];
        this.signature_status = this._getSignatureStatus(contract);
        this.tenant_signed_at = contract.tenant_signed_at || null;
        this.landlord_signed_at = contract.landlord_signed_at || null;
        this.signed_pdf_key = contract.signed_pdf_key || null;
        this.signed_pdf_url = contract.signed_pdf_url || null;
        this.signed_pdf_expires_at = contract.signed_pdf_expires_at || null;
        this.tenant_signature_key = contract.tenant_signature_key || null;
        this.landlord_signature_key = contract.landlord_signature_key || null;
    }

    _getSignatureStatus(contract) {
        const tenantSigned = !!(contract.tenant_signature_key || contract.tenant_signature);
        const landlordSigned = !!(contract.landlord_signature_key || contract.landlord_signature);
        if (tenantSigned && landlordSigned) return 'fully_signed';
        if (tenantSigned) return 'signed_by_tenant';
        if (landlordSigned) return 'signed_by_landlord';
        return 'pending';
    }

    static fromDatabase(contract) {
        return new ContractDTO(contract);
    }

    static fromDatabaseList(contracts) {
        return contracts.map(c => new ContractDTO(c));
    }
}

/**
 * CreateContractDTO - DTO para validación de creación de contratos
 * Coincide con los campos que espera ContractModel.create()
 */
class CreateContractDTO {
    /**
     * Calcula la fecha de fin según meses calendario.
     * Ej: 31 ene + 1 mes → 28 feb, 28 feb + 1 mes → 27 mar
     */
    static calculateEndDate(startDate, months) {
        const end = new Date(startDate);
        const startDay = startDate.getDate();
        end.setMonth(end.getMonth() + months);

        if (end.getDate() !== startDay) {
            // El día no existe en el mes destino (ej: Jan 31 → Feb)
            end.setDate(0); // último día del mes anterior
        } else {
            end.setDate(end.getDate() - 1); // día anterior a la misma fecha
        }

        return end.toISOString().split('T')[0];
    }

    constructor(data) {
        this.id_apt = parseInt(data.id_apt);
        this.tenant_id = parseInt(data.tenant_id);
        this.landlord_id = parseInt(data.landlord_id);
        this.start_date = data.start_date;
        this.end_date = data.end_date || null;
        this.duration_months = data.duration_months ? parseInt(data.duration_months) : null;
        this.monthly_rent = parseFloat(data.monthly_rent);
        this.deposit_amount = data.deposit_amount ? parseFloat(data.deposit_amount) : null;
        this.terms = data.terms || null;

        // Si no hay end_date pero sí duration_months, calcular end_date automáticamente
        if (!this.end_date && this.start_date && this.duration_months && this.duration_months >= 1) {
            const start = new Date(this.start_date);
            if (!isNaN(start.getTime())) {
                this.end_date = CreateContractDTO.calculateEndDate(start, this.duration_months);
            }
        }
    }

    /**
     * Encuentra cuántos meses calendario hay entre start y endDateString.
     * Recorre 1..24 hasta que calculateEndDate(start, N) coincida con endDateString.
     */
    static getMonthsBetween(startDate, endDateString) {
        for (let m = 1; m <= 24; m++) {
            if (CreateContractDTO.calculateEndDate(startDate, m) === endDateString) {
                return m;
            }
        }
        return null;
    }

    validate() {
        const errors = [];

        if (!this.id_apt || isNaN(this.id_apt)) {
            errors.push('id_apt debe ser un número válido');
        }

        if (!this.tenant_id || isNaN(this.tenant_id)) {
            errors.push('tenant_id debe ser un número válido');
        }

        if (!this.landlord_id || isNaN(this.landlord_id)) {
            errors.push('landlord_id debe ser un número válido');
        }

        if (!this.start_date || isNaN(Date.parse(this.start_date))) {
            errors.push('start_date debe ser una fecha válida');
        }

        if (!this.end_date || isNaN(Date.parse(this.end_date))) {
            errors.push('end_date debe ser una fecha válida');
        }

        if (this.start_date && this.end_date) {
            const start = new Date(this.start_date);
            const end = new Date(this.end_date);
            if (end <= start) {
                errors.push('end_date debe ser posterior a start_date');
            } else {
                const months = CreateContractDTO.getMonthsBetween(start, this.end_date);
                if (!months) {
                    errors.push('end_date no corresponde a una cantidad exacta de meses calendario (1-24)');
                }
            }
        }

        if (!this.monthly_rent || isNaN(this.monthly_rent) || this.monthly_rent <= 0) {
            errors.push('monthly_rent debe ser un número mayor a 0');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toDatabaseFormat() {
        const data = {
            id_apt: this.id_apt,
            tenant_id: this.tenant_id,
            landlord_id: this.landlord_id,
            start_date: this.start_date,
            end_date: this.end_date,
            monthly_rent: this.monthly_rent
        };
        
        if (this.deposit_amount !== null) data.deposit_amount = this.deposit_amount;
        if (this.terms) data.terms = this.terms;
        
        return data;
    }
}

/**
 * UpdateContractDTO - DTO para validación de actualización de contratos
 */
class UpdateContractDTO {
    constructor(data) {
        this.end_date = data.end_date;
        this.monthly_rent = data.monthly_rent ? parseFloat(data.monthly_rent) : null;
        this.status = data.status?.trim();
    }

    validate() {
        const errors = [];

        if (this.end_date && isNaN(Date.parse(this.end_date))) {
            errors.push('end_date debe ser una fecha válida');
        }

        if (this.monthly_rent && (isNaN(this.monthly_rent) || this.monthly_rent <= 0)) {
            errors.push('monthly_rent debe ser un número mayor a 0');
        }

        if (this.status && !['active', 'terminated', 'expired', 'pending'].includes(this.status)) {
            errors.push('status debe ser: active, terminated, expired o pending');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toDatabaseFormat() {
        const data = {};
        if (this.end_date) data.end_date = this.end_date;
        if (this.monthly_rent) data.monthly_rent = this.monthly_rent;
        if (this.status) data.status = this.status;
        return data;
    }
}

module.exports = {
    ContractDTO,
    CreateContractDTO,
    UpdateContractDTO
};
