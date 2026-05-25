class PaymentDTO {
    constructor(payment) {
        this.payment_id = payment.payment_id;
        this.agreement_id = payment.agreement_id;
        this.tenant_id = payment.tenant_id;
        this.landlord_id = payment.landlord_id;
        this.amount = payment.amount;
        this.payment_method = payment.payment_method;
        this.status = payment.status;
        this.stripe_payment_intent_id = payment.stripe_payment_intent_id || null;
        this.paypal_order_id = payment.paypal_order_id || null;
        this.receipt_url = payment.receipt_url || null;
        this.paid_at = payment.paid_at;
        this.created_at = payment.created_at;

        this.direccion_apt = payment.direccion_apt || null;
        this.barrio = payment.barrio || null;
        this.tenant_name = payment.tenant_name || null;
        this.tenant_lastname = payment.tenant_lastname || null;
        this.landlord_name = payment.landlord_name || null;
        this.landlord_lastname = payment.landlord_lastname || null;
        this.contract_rent = payment.contract_rent || null;
    }

    static fromDatabase(payment) {
        return new PaymentDTO(payment);
    }

    static fromDatabaseList(payments) {
        return payments.map(p => new PaymentDTO(p));
    }
}

class CreatePaymentDTO {
    constructor(data) {
        this.agreement_id = parseInt(data.agreement_id);
        this.amount = parseFloat(data.amount);
        this.payment_method = data.payment_method || 'other';
    }

    validate() {
        const errors = [];
        if (!this.agreement_id || isNaN(this.agreement_id)) {
            errors.push('agreement_id debe ser un número válido');
        }
        if (!this.amount || isNaN(this.amount) || this.amount <= 0) {
            errors.push('amount debe ser un número mayor a 0');
        }
        if (!['card', 'paypal', 'transfer', 'cash', 'other', 'simulated'].includes(this.payment_method)) {
            errors.push('payment_method debe ser: card, paypal, transfer, cash u other');
        }
        return { isValid: errors.length === 0, errors };
    }
}

module.exports = { PaymentDTO, CreatePaymentDTO };
