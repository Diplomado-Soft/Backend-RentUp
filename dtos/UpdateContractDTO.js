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

module.exports = UpdateContractDTO;
