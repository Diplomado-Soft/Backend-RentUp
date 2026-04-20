<<<<<<< HEAD
const cron = require('node-cron');
const { refreshAllUrls } = require('../utils/idriveService');

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

module.exports = { startUrlRefreshService, stopUrlRefreshService };
=======
let refreshInterval = null;

async function refreshUrls() {
    console.log('🔄 [urlRefreshService] Verificando URLs...');
    try {
        const { getAllApartments } = require('../models/apartmentModel');
        const apartments = await getAllApartments();
        console.log(`📡 [urlRefreshService] ${apartments.length} propiedades verificadas`);
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            console.warn('⚠️ [urlRefreshService] Tablas de base de datos no listas, saltando verificación');
        } else {
            console.error('❌ [urlRefreshService] Error:', err.message);
        }
    }
}

function startUrlRefreshService() {
    console.log('🚀 [urlRefreshService] Iniciando...');
    refreshUrls();
    refreshInterval = setInterval(refreshUrls, 60 * 60 * 1000);
}

module.exports = { startUrlRefreshService };
>>>>>>> 33aea86 (feat: add latitude and longitude coordinates to apartment model #27)
