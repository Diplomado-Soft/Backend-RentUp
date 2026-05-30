const db = require('../config/db');

class Payment {
    static async create(data) {
        const [result] = await db.query(
            `INSERT INTO payments 
                (agreement_id, tenant_id, landlord_id, amount, payment_method, status, stripe_payment_intent_id, paypal_order_id, paid_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.agreement_id,
                data.tenant_id,
                data.landlord_id,
                data.amount,
                data.payment_method || 'other',
                data.status || 'pending',
                data.stripe_payment_intent_id || null,
                data.paypal_order_id || null,
                data.status === 'completed' ? new Date() : null
            ]
        );
        return { payment_id: result.insertId, ...data };
    }

    static async getById(paymentId) {
        const [results] = await db.query(
            `SELECT p.*, 
                    a.direccion_apt, b.barrio,
                    tenant.user_name as tenant_name, tenant.user_lastname as tenant_lastname,
                    landlord.user_name as landlord_name, landlord.user_lastname as landlord_lastname,
                    ra.monthly_rent as contract_rent
            FROM payments p
            LEFT JOIN rental_agreements ra ON p.agreement_id = ra.agreement_id
            LEFT JOIN apartments a ON ra.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users tenant ON p.tenant_id = tenant.user_id
            LEFT JOIN users landlord ON p.landlord_id = landlord.user_id
            WHERE p.payment_id = ?`,
            [paymentId]
        );
        return results[0] || null;
    }

    static async getByTenant(tenantId) {
        const [results] = await db.query(
            `SELECT p.*, 
                    a.direccion_apt, b.barrio,
                    landlord.user_name as landlord_name, landlord.user_lastname as landlord_lastname,
                    ra.monthly_rent as contract_rent
            FROM payments p
            LEFT JOIN rental_agreements ra ON p.agreement_id = ra.agreement_id
            LEFT JOIN apartments a ON ra.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users landlord ON p.landlord_id = landlord.user_id
            WHERE p.tenant_id = ? AND p.vistainquilino = 'activo'
            ORDER BY p.created_at DESC`,
            [tenantId]
        );
        return results;
    }

    static async getByLandlord(landlordId) {
        const [results] = await db.query(
            `SELECT p.*, 
                    a.direccion_apt, b.barrio,
                    tenant.user_name as tenant_name, tenant.user_lastname as tenant_lastname,
                    ra.monthly_rent as contract_rent
            FROM payments p
            LEFT JOIN rental_agreements ra ON p.agreement_id = ra.agreement_id
            LEFT JOIN apartments a ON ra.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users tenant ON p.tenant_id = tenant.user_id
            WHERE p.landlord_id = ? AND p.vistaarrendador = 'activo'
            ORDER BY p.created_at DESC`,
            [landlordId]
        );
        return results;
    }

    static async getCompletedCountByAgreement(agreementId) {
        const [results] = await db.query(
            "SELECT COUNT(*) as count FROM payments WHERE agreement_id = ? AND status = 'completed'",
            [agreementId]
        );
        return results[0].count;
    }

    static async getByAgreement(agreementId) {
        const [results] = await db.query(
            `SELECT p.*, 
                    a.direccion_apt, b.barrio,
                    tenant.user_name as tenant_name,
                    landlord.user_name as landlord_name
            FROM payments p
            LEFT JOIN rental_agreements ra ON p.agreement_id = ra.agreement_id
            LEFT JOIN apartments a ON ra.property_id = a.id_apt
            LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
            LEFT JOIN users tenant ON p.tenant_id = tenant.user_id
            LEFT JOIN users landlord ON p.landlord_id = landlord.user_id
            WHERE p.agreement_id = ?
            ORDER BY p.created_at DESC`,
            [agreementId]
        );
        return results;
    }

    static async updateStatus(paymentId, status, additionalFields = {}) {
        const fields = [];
        const values = [];

        fields.push('status = ?');
        values.push(status);

        if (status === 'completed' && !additionalFields.paid_at) {
            fields.push('paid_at = ?');
            values.push(new Date());
        }

        if (additionalFields.stripe_payment_intent_id) {
            fields.push('stripe_payment_intent_id = ?');
            values.push(additionalFields.stripe_payment_intent_id);
        }

        if (additionalFields.paypal_order_id) {
            fields.push('paypal_order_id = ?');
            values.push(additionalFields.paypal_order_id);
        }

        if (additionalFields.receipt_url) {
            fields.push('receipt_url = ?');
            values.push(additionalFields.receipt_url);
        }

        if (additionalFields.receipt_signed_url) {
            fields.push('receipt_signed_url = ?');
            values.push(additionalFields.receipt_signed_url);
        }

        if (additionalFields.receipt_url_expires_at) {
            fields.push('receipt_url_expires_at = ?');
            values.push(additionalFields.receipt_url_expires_at);
        }

        values.push(paymentId);

        const [result] = await db.query(
            `UPDATE payments SET ${fields.join(', ')} WHERE payment_id = ?`,
            values
        );
        return result;
    }

    static async getPendingPayments() {
        const [results] = await db.query(
            `SELECT p.*, 
                    ra.monthly_rent, ra.end_date, ra.start_date,
                    a.direccion_apt, b.barrio,
                    tenant.user_name as tenant_name, tenant.user_lastname as tenant_lastname, tenant.user_email as tenant_email,
                    landlord.user_name as landlord_name
            FROM payments p
            JOIN rental_agreements ra ON p.agreement_id = ra.agreement_id
            JOIN apartments a ON ra.property_id = a.id_apt
            JOIN barrio b ON a.id_barrio = b.id_barrio
            JOIN users tenant ON p.tenant_id = tenant.user_id
            JOIN users landlord ON p.landlord_id = landlord.user_id
            WHERE p.status = 'pending' AND ra.status = 'active'
            ORDER BY p.created_at ASC`
        );
        return results;
    }

    static async getUpcomingPayments(daysAhead = 5) {
        const [results] = await db.query(
            `SELECT ra.*, 
                    a.direccion_apt, b.barrio,
                    tenant.user_name as tenant_name, tenant.user_lastname as tenant_lastname, tenant.user_email as tenant_email,
                    tenant.user_phonenumber as tenant_phone,
                    landlord.user_name as landlord_name
            FROM rental_agreements ra
            JOIN apartments a ON ra.property_id = a.id_apt
            JOIN barrio b ON a.id_barrio = b.id_barrio
            JOIN users tenant ON ra.tenant_id = tenant.user_id
            JOIN users landlord ON ra.landlord_id = landlord.user_id
            WHERE ra.status = 'active'
            AND DATEDIFF(ra.end_date, CURDATE()) BETWEEN 0 AND ?
            ORDER BY ra.end_date ASC`,
            [daysAhead]
        );
        return results;
    }

    static async getPaymentStats(tenantId) {
        const [results] = await db.query(
            `SELECT 
                COUNT(*) as total_payments,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_payments,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_paid,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_payments,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount
            FROM payments
            WHERE tenant_id = ?`,
            [tenantId]
        );
        return results[0];
    }
}

module.exports = Payment;
