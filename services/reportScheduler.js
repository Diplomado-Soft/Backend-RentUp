const cron = require('node-cron');
const Contract = require('../models/ContractModel');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const REPORTS_DIR = path.join(__dirname, '../reports');
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function drawHeader(doc, title, subtitle) {
    doc.rect(0, 0, doc.page.width, 80).fill('#6A6BEF');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('RentUP', 40, 22);
    doc.font('Helvetica').fontSize(11).text(title, 40, 48);
    doc.fontSize(10).fillColor('#d0d1ff').text(subtitle, 40, 62);
    doc.fillColor('#000000').moveDown(4);
}

function drawSectionTitle(doc, text) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#6A6BEF').text(text);
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y)
        .strokeColor('#6A6BEF').lineWidth(1).stroke();
    doc.moveDown(0.4);
    doc.fillColor('#000000').font('Helvetica').fontSize(10);
}

function drawTable(doc, headers, rows) {
    const startX = 40;
    const colWidths = [30, 140, 80, 100, 60, 60, 75];
    const rowH = 18;
    let y = doc.y;

    doc.rect(startX, y, doc.page.width - 80, rowH).fill('#6A6BEF');
    let x = startX + 4;
    headers.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
            .text(h, x, y + 5, { width: colWidths[i], lineBreak: false });
        x += colWidths[i];
    });
    y += rowH;

    rows.forEach((row, rowIdx) => {
        if (y + rowH > doc.page.height - 60) { doc.addPage(); y = 50; }
        doc.rect(startX, y, doc.page.width - 80, rowH).fill(rowIdx % 2 === 0 ? '#f5f5ff' : '#ffffff');
        x = startX + 4;
        row.forEach((cell, i) => {
            doc.font('Helvetica').fontSize(8).fillColor('#222222')
                .text(String(cell ?? '-'), x, y + 5, { width: colWidths[i] - 4, lineBreak: false });
            x += colWidths[i];
        });
        y += rowH;
    });
    doc.y = y + 10;
    doc.fillColor('#000000');
}

async function generateMonthlyReportForPreviousMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const targetYear  = month === 0 ? year - 1 : year;
    const targetMonth = month === 0 ? 12 : month;

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate   = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

    console.log(`[CRON] Generando reporte PDF automático para: ${startDate} - ${endDate}`);

    try {
        const contracts    = await Contract.getContractDetailsForReport(startDate, endDate);
        const stats        = await Contract.getMonthlyStats(targetYear, targetMonth);
        const periodLabel  = `${monthNames[targetMonth - 1]} ${targetYear}`;
        const filename     = `Reporte_Auto_${monthNames[targetMonth - 1]}_${targetYear}.pdf`;
        const filepath     = path.join(REPORTS_DIR, filename);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const writeStream = fs.createWriteStream(filepath);
        doc.pipe(writeStream);

        drawHeader(doc,
            `Reporte Mensual — ${periodLabel}`,
            `Generado automáticamente el ${new Date().toLocaleDateString('es-CO')}`
        );

        drawSectionTitle(doc, 'Resumen del período');
        const metrics = [
            ['Total de contratos', stats.total_contracts  || 0],
            ['Contratos activos',  stats.active_contracts || 0],
            ['Ingresos totales',   `$${(stats.total_revenue || 0).toLocaleString('es-CO')}`],
        ];
        const baseY = doc.y;
        metrics.forEach((m, i) => {
            doc.font('Helvetica').fontSize(10).fillColor('#555555').text(m[0], 50, baseY + i * 22, { width: 220 });
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(String(m[1]), 280, baseY + i * 22);
        });
        doc.y = baseY + metrics.length * 22 + 10;
        doc.fillColor('#000000');

        drawSectionTitle(doc, 'Detalle de contratos');
        if (contracts && contracts.length > 0) {
            const headers = ['ID', 'Apartamento', 'Barrio', 'Inquilino', 'Inicio', 'Fin', 'Renta'];
            const rows = contracts.map(c => [
                c.id_contract,
                (c.direccion_apt  || '').substring(0, 22),
                (c.barrio_name    || '').substring(0, 12),
                `${c.tenant_name || ''} ${c.tenant_lastname || ''}`.trim().substring(0, 16),
                c.start_date ? new Date(c.start_date).toLocaleDateString('es-CO') : '-',
                c.end_date   ? new Date(c.end_date).toLocaleDateString('es-CO')   : '-',
                c.monthly_rent ? `$${Number(c.monthly_rent).toLocaleString('es-CO')}` : '-',
            ]);
            drawTable(doc, headers, rows);
        } else {
            doc.font('Helvetica').fontSize(10).fillColor('#888888')
                .text('No hay contratos registrados para este período.', { align: 'center' });
        }

        doc.moveDown(2);
        doc.fontSize(8).fillColor('#aaaaaa')
            .text(`RentUP — Reporte automático ${new Date().toLocaleString('es-CO')}`, { align: 'center' });

        doc.end();

        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        console.log(`[CRON] ✅ Reporte PDF guardado: ${filename}`);

        try {
            await db.query(
                `INSERT INTO monthly_reports (year, month, report_path, generated_at, summary_data)
                VALUES (?, ?, ?, NOW(), ?)
                ON DUPLICATE KEY UPDATE report_path = VALUES(report_path), generated_at = NOW(), summary_data = VALUES(summary_data)`,
                [targetYear, targetMonth, filepath, JSON.stringify({
                    total_contracts: stats.total_contracts || 0,
                    active_contracts: stats.active_contracts || 0,
                    total_revenue: stats.total_revenue || 0,
                    total_landlords: stats.total_landlords || 0,
                    total_tenants: stats.total_tenants || 0
                })]
            );
            console.log(`[CRON] Reporte registrado en monthly_reports: ${targetYear}-${targetMonth}`);
        } catch (dbErr) {
            console.error('[CRON] Error guardando en monthly_reports:', dbErr.message);
        }
    } catch (error) {
        console.error('[CRON] Error generando reporte PDF:', error);
    }
}

function startReportScheduler() {
    console.log('[CRON] Iniciando programador de reportes PDF automáticos');
    cron.schedule('0 6 1 * *', () => {
        console.log('[CRON] Ejecutando generación de reporte mensual PDF...');
        generateMonthlyReportForPreviousMonth();
    });
    console.log('[CRON] Programado: día 1 de cada mes a las 6:00 AM');
}

module.exports = { startReportScheduler, generateMonthlyReportForPreviousMonth };
