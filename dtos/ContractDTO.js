/**
 * ContractDTO - Data Transfer Object para respuestas de contratos
 */
class ContractDTO {
    constructor(contract) {
        this.agreement_id = contract.agreement_id;
        this.id_apt = contract.id_apt;
        this.tenant_id = contract.tenant_id;
        this.landlord_id = contract.landlord_id;
        this.start_date = contract.start_date;
        this.end_date = contract.end_date;
        this.monthly_rent = contract.monthly_rent;
        this.deposit_amount = contract.deposit_amount;
        this.terms = contract.terms;
        this.status = contract.status;
        this.created_at = contract.created_at;
        this.tenant_name = contract.tenant_name || null;
        this.landlord_name = contract.landlord_name || null;
        this.property_address = contract.property_address || null;
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
    constructor(data) {
        this.id_apt = parseInt(data.id_apt);
        this.tenant_id = parseInt(data.tenant_id);
        this.landlord_id = parseInt(data.landlord_id);
        this.start_date = data.start_date;
        this.end_date = data.end_date;
        this.monthly_rent = parseFloat(data.monthly_rent);
        this.deposit_amount = data.deposit_amount ? parseFloat(data.deposit_amount) : null;
        this.terms = data.terms || null;
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

        if (!this.monthly_rent || isNaN(this.monthly_rent) || this.monthly_rent <= 0) {
            errors.push('monthly_rent debe ser un número mayor a 0');
        }

        if (this.start_date && this.end_date && new Date(this.end_date) <= new Date(this.start_date)) {
            errors.push('end_date debe ser posterior a start_date');
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
