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
                // Generar nueva URL firmada
                const { signedUrl, expiresAt } = await idriveService.getSignedUrl(image.s3_key);

                // Actualizar en la BD
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
