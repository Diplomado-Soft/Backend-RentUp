const ReportPdfService = require('../services/reportPdfService');
const fs = require('fs');
const path = require('path');

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ─── Controladores ────────────────────────────────────────────────────────────

/**
 * Genera el reporte PDF mensual y lo retorna como descarga
 */
exports.generateMonthlyReport = async (req, res) => {
    try {
        const { year, month } = req.query;
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;

        console.log(`📥 Solicitud de reporte: ${targetYear}-${targetMonth}`);

        // Generar el PDF
        const report = await ReportPdfService.generateMonthlyReportPdf(targetYear, targetMonth);

        // Retornar como descarga
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${report.displayFilename}"`);
        res.download(report.filePath, report.displayFilename, (err) => {
            if (err) {
                console.error('Error descargando reporte:', err);
            } else {
                console.log(`✅ Reporte descargado: ${report.filename}`);
            }
        });
    } catch (error) {
        console.error('❌ Error generando reporte PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Error al generar el reporte PDF',
                message: error.message 
            });
        }
    }
};

/**
 * Obtiene lista de reportes disponibles para descargar
 */
exports.getAvailableReports = async (req, res) => {
    try {
        const reports = [];
        const currentDate = new Date();

        // Últimos 12 meses
        for (let i = 0; i < 12; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const monthName = monthNames[month - 1];
            
            const exists = ReportPdfService.reportExists(year, month);
            const reportInfo = exists ? ReportPdfService.getReportInfo(year, month) : null;

            reports.push({
                year,
                month,
                monthName,
                available: exists,
                ...(reportInfo && {
                    filename: reportInfo.filename,
                    size: reportInfo.size,
                    created: reportInfo.created,
                    modified: reportInfo.modified
                })
            });
        }

        console.log(`📊 Lista de reportes enviada: ${reports.filter(r => r.available).length} disponibles`);
        res.json(reports);
    } catch (error) {
        console.error('Error obteniendo reportes:', error);
        res.status(500).json({ 
            error: 'Error al obtener reportes disponibles',
            message: error.message 
        });
    }
};

/**
 * Descarga un reporte PDF previamente generado
 */
exports.downloadReport = async (req, res) => {
    try {
        const { year, month } = req.params;
        const targetYear = parseInt(year);
        const targetMonth = parseInt(month);

        if (!targetYear || !targetMonth || targetMonth < 1 || targetMonth > 12) {
            return res.status(400).json({ error: 'Año y mes inválidos' });
        }

        const reportInfo = ReportPdfService.getReportInfo(targetYear, targetMonth);

        if (!reportInfo) {
            return res.status(404).json({ 
                error: 'Reporte no encontrado',
                message: 'Genérelo primero usando el endpoint /monthly'
            });
        }

        console.log(`📥 Descargando reporte: ${reportInfo.filename}`);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportInfo.filename}"`);
        res.download(reportInfo.path, reportInfo.filename, (err) => {
            if (err) {
                console.error('Error descargando reporte:', err);
            } else {
                console.log(`✅ Reporte descargado exitosamente`);
            }
        });
    } catch (error) {
        console.error('Error descargando reporte:', error);
        res.status(500).json({ 
            error: 'Error al descargar el reporte',
            message: error.message 
        });
    }
};
