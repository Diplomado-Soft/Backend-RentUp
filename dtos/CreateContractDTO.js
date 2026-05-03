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
        
        // Campos adicionales que el modelo podría usar en el futuro
        if (this.deposit_amount !== null) data.deposit_amount = this.deposit_amount;
        if (this.terms) data.terms = this.terms;
        
        return data;
    }
}

module.exports = CreateContractDTO;
