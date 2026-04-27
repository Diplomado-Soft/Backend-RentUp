const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Contract = require('../models/ContractModel');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

function drawHeader(doc, title, subtitle) {
    doc.rect(0, 0, doc.page.width, 80).fill('#6A6BEF');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('RentUP', 40, 22);
    doc.font('Helvetica').fontSize(11).text(title, 40, 48);
    doc.fontSize(10).fillColor('#d0d1ff').text(subtitle, 40, 62);
    doc.fillColor('#000000');
    doc.moveDown(4);
}

function drawSectionTitle(doc, text) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#6A6BEF').text(text);
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#6A6BEF').lineWidth(1).stroke();
    doc.moveDown(0.4);
    doc.fillColor('#000000').font('Helvetica').fontSize(10);
}

function drawMetricRow(doc, label, value, y) {
    doc.font('Helvetica').fontSize(10).fillColor('#555555').text(label, 50, y, { width: 220 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(String(value), 280, y);
    doc.fillColor('#000000').font('Helvetica');
}

function drawTable(doc, headers, rows) {
    const startX = 40;
    const colWidths = [25, 110, 70, 65, 60, 60, 60, 75];
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
        if (y + rowH > doc.page.height - 60) {
            doc.addPage();
            y = 50;
        }
        const bg = rowIdx % 2 === 0 ? '#f5f5ff' : '#ffffff';
        doc.rect(startX, y, doc.page.width - 80, rowH).fill(bg);
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

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

class ReportPdfService {
    static getReportPath(year, month) {
        return path.join(REPORTS_DIR, `reporte_${year}_${String(month).padStart(2, '0')}.pdf`);
    }

    static getDisplayFilename(year, month) {
        return `Reporte_RentUP_${monthNames[month - 1]}_${year}.pdf`;
    }

    static reportExists(year, month) {
        const filePath = this.getReportPath(year, month);
        return fs.existsSync(filePath);
    }

    static getReportInfo(year, month) {
        const filePath = this.getReportPath(year, month);
        if (!fs.existsSync(filePath)) return null;

        const stats = fs.statSync(filePath);
        return {
            path: filePath,
            filename: this.getDisplayFilename(year, month),
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        };
    }

    static async generateMonthlyReportPdf(year, month) {
        ensureReportsDir();

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        console.log(`📄 Generando reporte PDF: ${startDate} - ${endDate}`);

        const contracts = await Contract.getContractDetailsForReport(startDate, endDate);
        const stats = await Contract.getMonthlyStats(year, month);

        const periodLabel = `${monthNames[month - 1]} ${year}`;
        const filenameShort = `reporte_${year}_${String(month).padStart(2, '0')}.pdf`;
        const displayFilename = this.getDisplayFilename(year, month);
        const filePath = path.join(REPORTS_DIR, filenameShort);

        return new Promise((resolve, reject) => {
            const chunks = [];
            const doc = new PDFDocument({ margin: 40, size: 'A4' });

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                fs.writeFileSync(filePath, pdfBuffer);
                console.log(`📁 PDF guardado: ${filePath}`);
                resolve({
                    filePath,
                    filename: filenameShort,
                    displayFilename
                });
            });
            doc.on('error', reject);

            // Header
            drawHeader(doc, `Reporte Mensual — ${periodLabel}`, `Generado el ${new Date().toLocaleDateString('es-CO')} | RentUP Platform`);

            // Metrics
            drawSectionTitle(doc, 'Resumen del período');
            const avgRent = stats.average_rent ? Number(stats.average_rent).toFixed(2) : '0.00';
            const metrics = [
                ['Total de contratos', stats.total_contracts || 0],
                ['Contratos activos', stats.active_contracts || 0],
                ['Contratos vencidos', stats.expired_contracts || 0],
                ['Ingresos totales', `$${(stats.total_revenue || 0).toLocaleString('es-CO')}`],
                ['Promedio de renta', `$${Number(avgRent).toLocaleString('es-CO')}`],
                ['Total arrendadores', stats.total_landlords || 0],
                ['Total inquilinos', stats.total_tenants || 0],
            ];
            const baseY = doc.y;
            metrics.forEach((m, i) => drawMetricRow(doc, m[0], m[1], baseY + i * 22));
            doc.y = baseY + metrics.length * 22 + 10;

            // Table
            drawSectionTitle(doc, 'Detalle de contratos');
            if (!contracts || contracts.length === 0) {
                doc.font('Helvetica').fontSize(10).fillColor('#888888')
                    .text('No hay contratos registrados para este período.', { align: 'center' });
            } else {
                const headers = ['#', 'Inmueble', 'Barrio', 'Propietario', 'Inquilino', 'Inicio', 'Fin', 'Precio'];
                const rows = contracts.map((c, idx) => [
                    c.agreement_id || idx + 1,
                    (c.direccion_apt || '').substring(0, 18),
                    (c.barrio_name || '').substring(0, 10),
                    `${c.landlord_name || ''} ${c.landlord_lastname || ''}`.trim().substring(0, 12),
                    `${c.tenant_name || ''} ${c.tenant_lastname || ''}`.trim().substring(0, 12),
                    c.start_date ? new Date(c.start_date).toLocaleDateString('es-CO') : '-',
                    c.end_date ? new Date(c.end_date).toLocaleDateString('es-CO') : '-',
                    c.monthly_rent ? `$${Number(c.monthly_rent).toLocaleString('es-CO')}` : '-',
                ]);
                drawTable(doc, headers, rows);
            }

            // Footer
            doc.moveDown(2);
            doc.fontSize(8).fillColor('#aaaaaa')
                .text(`RentUP — Reporte generado automáticamente el ${new Date().toLocaleString('es-CO')}`, { align: 'center' });

            doc.end();
        });
    }
}

module.exports = ReportPdfService;
