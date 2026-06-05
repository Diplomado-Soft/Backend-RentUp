const cron = require('node-cron');
const db = require('../config/db');
const idriveService = require('../utils/idriveService');

/**
 * Job de cron para renovar URLs expiradas de imágenes
 * Corre cada 6 horas
 */
const startUrlRefreshService = () => {
    console.log('🔄 Iniciando servicio de renovación de URLs...');
    
    // Ejecutar cada 6 horas
    const job = cron.schedule('0 */6 * * *', async () => {
        console.log('⏰ Ejecutando job de renovación de URLs...');
        try {
            await refreshExpiredUrls();
        } catch (error) {
            console.error('❌ Error en job de renovación de URLs:', error.message);
        }
    });

    // También ejecutar al iniciar el servidor
    refreshExpiredUrls().catch(error => {
        console.error('❌ Error al renovar URLs al iniciar:', error.message);
    });

    return job;
};

/**
 * Renovar todas las URLs expiradas
 */
const refreshExpiredUrls = async () => {
    const connection = await db.getConnection();
    try {
        // Obtener todas las imágenes con URLs cercanas a expirar
        const [images] = await connection.query(`
            SELECT 
                id_image,
                id_apt,
                s3_key,
                signed_url,
                expires_at
            FROM apartment_images
            WHERE expires_at IS NOT NULL 
            AND expires_at < DATE_ADD(NOW(), INTERVAL 1 HOUR)
        `);

        if (!images || images.length === 0) {
            console.log('✅ Ninguna URL requiere renovación en este momento');
            return;
        }

        console.log(`🔄 Renovando ${images.length} URL(s) expirada(s)...`);

        let renovatedCount = 0;
        let errorCount = 0;

        for (const image of images) {
            try {
                const { signedUrl, expiresAt } = await idriveService.getSignedUrl(image.s3_key);

                await connection.query(`
                    UPDATE apartment_images
                    SET signed_url = ?,
                        expires_at = ?,
                        updated_at = NOW()
                    WHERE id_image = ?
                `, [signedUrl, expiresAt, image.id_image]);

                renovatedCount++;
                console.log(`✅ URL renovada para imagen ${image.id_image}`);
            } catch (error) {
                errorCount++;
                console.error(`❌ Error renovando URL para imagen ${image.id_image}:`, error.message);
            }
        }

        // También renovar URLs de maintenance_reports
        const [maintenanceImages] = await connection.query(`
            SELECT id, s3_key, image_url, expires_at
            FROM maintenance_reports
            WHERE s3_key IS NOT NULL
            AND expires_at IS NOT NULL
            AND expires_at < DATE_ADD(NOW(), INTERVAL 1 HOUR)
        `);

        if (maintenanceImages && maintenanceImages.length > 0) {
            console.log(`🔄 Renovando ${maintenanceImages.length} URL(s) de mantenimiento...`);

            for (const report of maintenanceImages) {
                try {
                    const { signedUrl, expiresAt } = await idriveService.getSignedUrl(report.s3_key);

                    await connection.query(`
                        UPDATE maintenance_reports
                        SET image_url = ?,
                            expires_at = ?
                        WHERE id = ?
                    `, [signedUrl, expiresAt, report.id]);

                    renovatedCount++;
                    console.log(`✅ URL de mantenimiento renovada para reporte ${report.id}`);
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Error renovando URL de mantenimiento para reporte ${report.id}:`, error.message);
                }
            }
        }

        // Renovar URLs de contratos firmados
        const [contractPdfs] = await connection.query(`
            SELECT agreement_id, signed_pdf_key, signed_pdf_url, signed_pdf_expires_at
            FROM rental_agreements
            WHERE signed_pdf_key IS NOT NULL
            AND signed_pdf_expires_at IS NOT NULL
            AND signed_pdf_expires_at < DATE_ADD(NOW(), INTERVAL 1 HOUR)
        `);

        if (contractPdfs && contractPdfs.length > 0) {
            console.log(`🔄 Renovando ${contractPdfs.length} URL(s) de contratos firmados...`);

            for (const row of contractPdfs) {
                try {
                    const result = await idriveService.getSignedPdfUrl(row.signed_pdf_key);
                    if (result) {
                        await connection.query(`
                            UPDATE rental_agreements
                            SET signed_pdf_url = ?,
                                signed_pdf_expires_at = ?
                            WHERE agreement_id = ?
                        `, [result.signedUrl, result.expiresAt, row.agreement_id]);

                        renovatedCount++;
                        console.log(`✅ URL de contrato renovada para agreement ${row.agreement_id}`);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Error renovando URL de contrato ${row.agreement_id}:`, error.message);
                }
            }
        }

        // Renovar URLs de recibos
        const [receiptPdfs] = await connection.query(`
            SELECT payment_id, receipt_url, receipt_signed_url, receipt_url_expires_at
            FROM payments
            WHERE receipt_url IS NOT NULL
            AND receipt_url NOT LIKE '/payments/%'
            AND receipt_url_expires_at IS NOT NULL
            AND receipt_url_expires_at < DATE_ADD(NOW(), INTERVAL 1 HOUR)
        `);

        if (receiptPdfs && receiptPdfs.length > 0) {
            console.log(`🔄 Renovando ${receiptPdfs.length} URL(s) de recibos...`);

            for (const row of receiptPdfs) {
                try {
                    const result = await idriveService.getSignedPdfUrl(row.receipt_url);
                    if (result) {
                        await connection.query(`
                            UPDATE payments
                            SET receipt_signed_url = ?,
                                receipt_url_expires_at = ?
                            WHERE payment_id = ?
                        `, [result.signedUrl, result.expiresAt, row.payment_id]);

                        renovatedCount++;
                        console.log(`✅ URL de recibo renovada para payment ${row.payment_id}`);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Error renovando URL de recibo ${row.payment_id}:`, error.message);
                }
            }
        }

        // Renovar URLs de documentos KYC (landlord_verification)
        const [kycDocs] = await connection.query(`
            SELECT id, id_document_key, id_document_url, updated_at
            FROM landlord_verification
            WHERE id_document_key IS NOT NULL
            AND id_document_url IS NOT NULL
            AND updated_at < DATE_ADD(NOW(), INTERVAL 1 HOUR)
        `);

        if (kycDocs && kycDocs.length > 0) {
            console.log(`🔄 Renovando ${kycDocs.length} URL(s) de documentos KYC...`);

            for (const doc of kycDocs) {
                try {
                    const { signedUrl, expiresAt } = await idriveService.getSignedUrl(doc.id_document_key);

                    await connection.query(`
                        UPDATE landlord_verification
                        SET id_document_url = ?,
                            updated_at = NOW()
                        WHERE id = ?
                    `, [signedUrl, doc.id]);

                    renovatedCount++;
                    console.log(`✅ URL KYC renovada para verificación ${doc.id}`);
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Error renovando URL KYC para verificación ${doc.id}:`, error.message);
                }
            }
        }

        // Renovar URLs de documentos en users (cédulas almacenadas directamente)
        const [userDocs] = await connection.query(`
            SELECT user_id, id_document_key, id_document_url
            FROM users
            WHERE id_document_key IS NOT NULL
            AND id_document_url IS NOT NULL
        `);

        if (userDocs && userDocs.length > 0) {
            console.log(`🔄 Verificando ${userDocs.length} documento(s) de usuarios...`);

            for (const doc of userDocs) {
                try {
                    const needsRenewal = await connection.query(`
                        SELECT 1 FROM landlord_verification
                        WHERE user_id = ? AND id_document_key = ?
                        AND updated_at < DATE_ADD(NOW(), INTERVAL 1 HOUR)
                        LIMIT 1
                    `, [doc.user_id, doc.id_document_key]);

                    if (needsRenewal[0] && needsRenewal[0].length > 0) {
                        const { signedUrl, expiresAt } = await idriveService.getSignedUrl(doc.id_document_key);

                        await connection.query(`
                            UPDATE users
                            SET id_document_url = ?
                            WHERE user_id = ?
                        `, [signedUrl, doc.user_id]);

                        renovatedCount++;
                        console.log(`✅ URL de cédula renovada para usuario ${doc.user_id}`);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Error renovando URL de cédula para usuario ${doc.user_id}:`, error.message);
                }
            }
        }

        console.log(`📊 Resumen: ${renovatedCount} renovadas, ${errorCount} errores`);
    } catch (error) {
        console.error('❌ Error en refreshExpiredUrls:', error.message);
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Obtener URL firmada válida para una imagen
 * Si está expirada, genera una nueva automáticamente
 */
const getValidSignedUrl = async (imageId) => {
    const connection = await db.getConnection();
    try {
        // Obtener imagen actual
        const [images] = await connection.query(`
            SELECT id_image, s3_key, signed_url, expires_at
            FROM apartment_images
            WHERE id_image = ?
        `, [imageId]);

        if (!images || images.length === 0) {
            throw new Error('Imagen no encontrada');
        }

        const image = images[0];

        // Verificar si la URL está expirada
        if (idriveService.isUrlExpired(image.expires_at)) {
            console.log(`🔄 URL expirada, generando nueva para imagen ${imageId}...`);
            
            const { signedUrl, expiresAt } = await idriveService.getSignedUrl(image.s3_key);

            // Actualizar en BD
            await connection.query(`
                UPDATE apartment_images
                SET signed_url = ?,
                    expires_at = ?,
                    updated_at = NOW()
                WHERE id_image = ?
            `, [signedUrl, expiresAt, imageId]);

            console.log(`✅ URL renovada para imagen ${imageId}`);
            return { signedUrl, expiresAt };
        }

        return {
            signedUrl: image.signed_url,
            expiresAt: image.expires_at
        };
    } catch (error) {
        console.error('❌ Error en getValidSignedUrl:', error.message);
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    startUrlRefreshService,
    refreshExpiredUrls,
    getValidSignedUrl
};
