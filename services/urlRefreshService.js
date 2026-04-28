const cron = require('node-cron');
const { refreshAllUrls, getSignedUrl } = require('../utils/idriveService');

let refreshJob = null;

function startUrlRefreshService() {
    const intervalMinutes = parseInt(process.env.URL_REFRESH_INTERVAL_MINUTES) || 60;
    
    refreshJob = cron.schedule(`*/${intervalMinutes} * * * *`, async () => {
        try {
            console.log('🔄 [UrlRefresh] Renovando URLs...');
            await refreshAllUrls();
            console.log('✅ [UrlRefresh] URLs renovadas');
        } catch (err) {
            console.error('❌ [UrlRefresh] Error:', err.message);
        }
    });
    
    console.log(`✅ [UrlRefresh]Servicio iniciado cada ${intervalMinutes} minutos`);
}

function stopUrlRefreshService() {
    if (refreshJob) {
        refreshJob.stop();
        refreshJob = null;
    }
}

async function getValidSignedUrl(imageId) {
    try {
        // Obtener la key de la imagen desde la BD
        const db = require('../config/db');
        const [images] = await db.query(
            'SELECT s3_key FROM apartment_images WHERE id_image = ?',
            [imageId]
        );
        
        if (!images || images.length === 0) {
            throw new Error('Imagen no encontrada');
        }
        
        const { s3_key } = images[0];
        
        // Generar nueva URL firmada
        const urlData = await getSignedUrl(s3_key);
        
        // Actualizar en BD
        await db.query(
            'UPDATE apartment_images SET signed_url = ?, expires_at = ? WHERE id_image = ?',
            [urlData.signedUrl, urlData.expiresAt, imageId]
        );
        
        return { signedUrl: urlData.signedUrl, expiresAt: urlData.expiresAt };
    } catch (error) {
        console.error('Error processing image:', error.message);
        throw error;
    }
}

module.exports = { startUrlRefreshService, stopUrlRefreshService, getValidSignedUrl };
