const db = require('../config/db');
const NotificationModel = require('./NotificationModel');
const { sendApartmentApprovalEmail, sendApartmentRejectionEmail } = require('../utils/emailService');

class KycModel {

    static async ensureTable() {
        try {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS landlord_verification (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    apartment_id INT,
                    id_document_url VARCHAR(500),
                    id_document_key VARCHAR(500),
                    property_certificate_url VARCHAR(500),
                    property_certificate_key VARCHAR(500),
                    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                    admin_notes TEXT,
                    reviewed_by INT,
                    reviewed_at DATETIME,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(user_id),
                    FOREIGN KEY (apartment_id) REFERENCES apartments(id_apt) ON DELETE SET NULL,
                    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
                )
            `);
            console.log('✅ Tabla landlord_verification asegurada');
        } catch (error) {
            console.error('Error creando tabla landlord_verification:', error);
        }
    }

    static async init() {
        await this.ensureTable();
    }

    static async createVerification({ userId, apartmentId, idDocumentUrl, idDocumentKey, certUrl, certKey }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [existing] = await connection.query(
                `SELECT id, status FROM landlord_verification
                 WHERE user_id = ? AND apartment_id = ? AND status = 'pending'`,
                [userId, apartmentId]
            );

            if (existing.length > 0) {
                const [result] = await connection.query(
                    `UPDATE landlord_verification
                     SET id_document_url = COALESCE(?, id_document_url),
                         id_document_key = COALESCE(?, id_document_key),
                         property_certificate_url = COALESCE(?, property_certificate_url),
                         property_certificate_key = COALESCE(?, property_certificate_key),
                         status = 'pending',
                         admin_notes = NULL,
                         reviewed_by = NULL,
                         reviewed_at = NULL
                     WHERE id = ?`,
                    [idDocumentUrl, idDocumentKey, certUrl, certKey, existing[0].id]
                );
                await connection.commit();
                return { id: existing[0].id, isUpdate: true };
            }

            const [result] = await connection.query(
                `INSERT INTO landlord_verification
                 (user_id, apartment_id, id_document_url, id_document_key, property_certificate_url, property_certificate_key, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                [userId, apartmentId, idDocumentUrl, idDocumentKey, certUrl, certKey]
            );

            await connection.commit();

            try {
                await NotificationModel.createForAdmins({
                    type: 'kyc_pending',
                    title: 'Nueva solicitud de verificación',
                    message: `Un arrendador ha subido documentos de verificación. Revisa las solicitudes pendientes.`,
                    reference_id: result.insertId,
                    reference_type: 'landlord_verification'
                });
            } catch (notifErr) {
                console.error('Error notificando a admins:', notifErr.message);
            }

            return { id: result.insertId, isUpdate: false };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getPendingVerifications(limit = 50, offset = 0) {
        const connection = await db.getConnection();
        try {
            const [results] = await connection.query(
                `SELECT
                    lv.*,
                    u.user_name, u.user_lastname, u.user_email, u.user_phonenumber,
                    u.is_verified,
                    a.direccion_apt, a.barrio, a.price, a.publication_status,
                    b.barrio as barrio_nombre
                FROM landlord_verification lv
                LEFT JOIN users u ON lv.user_id = u.user_id
                LEFT JOIN apartments a ON lv.apartment_id = a.id_apt
                LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
                WHERE lv.status = 'pending'
                ORDER BY lv.created_at ASC
                LIMIT ? OFFSET ?`,
                [parseInt(limit), parseInt(offset)]
            );

            const [countResult] = await connection.query(
                `SELECT COUNT(*) as total FROM landlord_verification WHERE status = 'pending'`
            );

            const formatted = results.map(r => ({
                ...r,
                barrio: r.barrio_nombre || r.barrio
            }));

            return {
                verifications: formatted,
                total: countResult[0].total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };
        } finally {
            connection.release();
        }
    }

    static async getAllVerifications(limit = 50, offset = 0, status = '') {
        const connection = await db.getConnection();
        try {
            let whereClause = 'WHERE 1=1';
            const params = [];

            if (status) {
                whereClause += ' AND lv.status = ?';
                params.push(status);
            }

            const [results] = await connection.query(
                `SELECT
                    lv.*,
                    u.user_name, u.user_lastname, u.user_email, u.user_phonenumber,
                    u.is_verified,
                    a.direccion_apt, a.price, a.publication_status,
                    b.barrio as barrio_nombre,
                    admin.user_name as admin_name
                FROM landlord_verification lv
                LEFT JOIN users u ON lv.user_id = u.user_id
                LEFT JOIN apartments a ON lv.apartment_id = a.id_apt
                LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
                LEFT JOIN users admin ON lv.reviewed_by = admin.user_id
                ${whereClause}
                ORDER BY lv.created_at DESC
                LIMIT ? OFFSET ?`,
                [...params, parseInt(limit), parseInt(offset)]
            );

            const [countResult] = await connection.query(
                `SELECT COUNT(*) as total FROM landlord_verification ${whereClause}`,
                params
            );

            return {
                verifications: results,
                total: countResult[0].total
            };
        } finally {
            connection.release();
        }
    }

    static async getVerificationByUser(userId) {
        const [results] = await db.query(
            `SELECT * FROM landlord_verification
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId]
        );
        return results[0] || null;
    }

    static async getVerificationsByApartment(apartmentId) {
        const [results] = await db.query(
            `SELECT * FROM landlord_verification
             WHERE apartment_id = ?
             ORDER BY created_at DESC`,
            [apartmentId]
        );
        return results;
    }

    static async approveVerification(verificationId, adminId, notes = '') {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [verification] = await connection.query(
                `SELECT * FROM landlord_verification WHERE id = ?`,
                [verificationId]
            );

            if (verification.length === 0) {
                throw new Error('Solicitud de verificación no encontrada');
            }

            const v = verification[0];
            const landlordId = v.user_id;
            const apartmentId = v.apartment_id;

            await connection.query(
                `UPDATE landlord_verification
                 SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), admin_notes = ?
                 WHERE id = ?`,
                [adminId, notes || 'Verificación aprobada', verificationId]
            );

            await connection.query(
                `UPDATE users SET is_verified = TRUE WHERE user_id = ?`,
                [landlordId]
            );

            if (apartmentId) {
                await connection.query(
                    `UPDATE apartments
                     SET publication_status = 'approved', published_date = NOW(), updated_date = NOW(), admin_notes = ?
                     WHERE id_apt = ?`,
                    [notes || 'Verificación de propiedad aprobada', apartmentId]
                );

                await connection.query(
                    `INSERT INTO apartment_approval_history (id_apt, admin_id, old_status, new_status, notes, action_date)
                     VALUES (?, ?, 'pending', 'approved', ?, NOW())`,
                    [apartmentId, adminId, notes || 'Aprobado vía verificación KYC']
                );
            }

            await connection.commit();

            try {
                const [landlord] = await connection.query(
                    'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                    [landlordId]
                );

                if (landlord.length > 0) {
                    await NotificationModel.createForUser(landlordId, {
                        type: 'kyc_approved',
                        title: 'Verificación aprobada',
                        message: 'Tu identidad y propiedad han sido verificadas exitosamente. Tu apartamento ya está publicado.',
                        reference_id: verificationId,
                        reference_type: 'landlord_verification'
                    });

                    if (apartmentId) {
                        const [aptInfo] = await connection.query(
                            'SELECT direccion_apt FROM apartments WHERE id_apt = ?',
                            [apartmentId]
                        );
                        const direccion = aptInfo[0]?.direccion_apt || '';
                        await sendApartmentApprovalEmail(
                            landlord[0].user_email,
                            landlord[0].user_name,
                            landlord[0].user_lastname,
                            direccion
                        );
                    }
                }
            } catch (notifErr) {
                console.error('Error en notificación de aprobación KYC:', notifErr.message);
            }

            return { success: true, message: 'Verificación aprobada correctamente' };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async rejectVerification(verificationId, adminId, notes = '') {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [verification] = await connection.query(
                `SELECT * FROM landlord_verification WHERE id = ?`,
                [verificationId]
            );

            if (verification.length === 0) {
                throw new Error('Solicitud de verificación no encontrada');
            }

            const v = verification[0];
            const landlordId = v.user_id;
            const apartmentId = v.apartment_id;

            await connection.query(
                `UPDATE landlord_verification
                 SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), admin_notes = ?
                 WHERE id = ?`,
                [adminId, notes, verificationId]
            );

            if (apartmentId) {
                await connection.query(
                    `UPDATE apartments
                     SET publication_status = 'rejected', updated_date = NOW(), admin_notes = ?
                     WHERE id_apt = ?`,
                    [notes, apartmentId]
                );

                await connection.query(
                    `INSERT INTO apartment_approval_history (id_apt, admin_id, old_status, new_status, notes, action_date)
                     VALUES (?, ?, 'pending', 'rejected', ?, NOW())`,
                    [apartmentId, adminId, notes || 'Rechazado vía verificación KYC']
                );
            }

            await connection.commit();

            try {
                const [landlord] = await connection.query(
                    'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                    [landlordId]
                );

                if (landlord.length > 0) {
                    await NotificationModel.createForUser(landlordId, {
                        type: 'kyc_rejected',
                        title: 'Verificación rechazada',
                        message: `Tu solicitud de verificación ha sido rechazada. Motivo: ${notes || 'No especificado'}`,
                        reference_id: verificationId,
                        reference_type: 'landlord_verification'
                    });

                    if (apartmentId) {
                        const [aptInfo] = await connection.query(
                            'SELECT direccion_apt FROM apartments WHERE id_apt = ?',
                            [apartmentId]
                        );
                        const direccion = aptInfo[0]?.direccion_apt || '';
                        await sendApartmentRejectionEmail(
                            landlord[0].user_email,
                            landlord[0].user_name,
                            landlord[0].user_lastname,
                            direccion,
                            notes || 'No se especificó un motivo'
                        );
                    }
                }
            } catch (notifErr) {
                console.error('Error en notificación de rechazo KYC:', notifErr.message);
            }

            return { success: true, message: 'Verificación rechazada' };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = KycModel;
