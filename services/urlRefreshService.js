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
