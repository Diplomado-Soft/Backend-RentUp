<<<<<<< HEAD
const cron = require('node-cron');
const { generateMonthlyReport } = require('../controllers/reportController');

let reportJob = null;

function startReportScheduler() {
    reportJob = cron.schedule('0 8 1 * *', async () => {
        try {
            console.log('📊 [ReportScheduler] Generando reporte mensual...');
            await generateMonthlyReport();
            console.log('✅ [ReportScheduler] Reporte mensual generado');
        } catch (err) {
            console.error('❌ [ReportScheduler] Error:', err.message);
        }
    });
    
    console.log('✅ [ReportScheduler] Programador iniciado (primer día del mes a las 8:00 AM)');
}

function stopReportScheduler() {
    if (reportJob) {
        reportJob.stop();
        reportJob = null;
    }
}

module.exports = { startReportScheduler, stopReportScheduler };
=======
function startReportScheduler() {
    console.log('📊 [reportScheduler] Programador iniciado');
}

module.exports = { startReportScheduler };
>>>>>>> 33aea86 (feat: add latitude and longitude coordinates to apartment model #27)
