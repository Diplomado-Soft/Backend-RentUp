const Contract = require('../models/ContractModel');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

// ─── Helpers de dibujo PDF ────────────────────────────────────────────────────

function drawHeader(doc, title, subtitle) {
    doc.rect(0, 0, doc.page.width, 80).fill('#6A6BEF');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22)
        .text('RentUP', 40, 22);
    doc.font('Helvetica').fontSize(11)
        .text(title, 40, 48);
    doc.fontSize(10).fillColor('#d0d1ff')
        .text(subtitle, 40, 62);
    doc.fillColor('#000000');
    doc.moveDown(4);
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

    // Encabezado
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

// ─── Controladores ────────────────────────────────────────────────────────────

exports.generateMonthlyReport = async (req, res) => {
    try {
        const { year, month } = req.query;
        const targetYear  = parseInt(year)  || new Date().getFullYear();
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;

        const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
        const endDate   = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

        console.log(`📄 Generando reporte PDF para: ${startDate} - ${endDate}`);

        const contracts = await Contract.getContractDetailsForReport(startDate, endDate);
        const stats     = await Contract.getMonthlyStats(targetYear, targetMonth);

        const periodLabel = `${monthNames[targetMonth - 1]} ${targetYear}`;
        const filename    = `Reporte_RentUP_${monthNames[targetMonth - 1]}_${targetYear}.pdf`;
        const filenameShort = `reporte_${targetYear}_${String(targetMonth).padStart(2, '0')}.pdf`;

        ensureReportsDir();
        const filePath = path.join(REPORTS_DIR, filenameShort);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            fs.writeFileSync(filePath, pdfBuffer);
            console.log(`📁 PDF guardado en: ${filePath}`);
        });
        doc.pipe(res);

        // Encabezado
        drawHeader(
            doc,
            `Reporte Mensual — ${periodLabel}`,
            `Generado el ${new Date().toLocaleDateString('es-CO')} | RentUP Platform`
        );

        // Resumen
        drawSectionTitle(doc, 'Resumen del período');
        const avgRent = stats.average_rent ? Number(stats.average_rent).toFixed(2) : '0.00';
        const metrics = [
            ['Total de contratos',  stats.total_contracts   || 0],
            ['Contratos activos',   stats.active_contracts  || 0],
            ['Contratos vencidos',  stats.expired_contracts || 0],
            ['Ingresos totales',    `$${(stats.total_revenue || 0).toLocaleString('es-CO')}`],
            ['Promedio de renta',   `$${Number(avgRent).toLocaleString('es-CO')}`],
            ['Total arrendadores',  stats.total_landlords   || 0],
            ['Total inquilinos',    stats.total_tenants     || 0],
        ];
        const baseY = doc.y;
        metrics.forEach((m, i) => drawMetricRow(doc, m[0], m[1], baseY + i * 22));
        doc.y = baseY + metrics.length * 22 + 10;

        // Tabla de contratos
        drawSectionTitle(doc, 'Detalle de contratos');
        if (!contracts || contracts.length === 0) {
            doc.font('Helvetica').fontSize(10).fillColor('#888888')
                .text('No hay contratos registrados para este período.', { align: 'center' });
        } else {
            const headers = ['#', 'Inmueble', 'Barrio', 'Propietario', 'Inquilino', 'Inicio', 'Fin', 'Precio'];
            const rows = contracts.map((c, idx) => [
                c.agreement_id || idx + 1,
                (c.direccion_apt  || '').substring(0, 18),
                (c.barrio_name    || '').substring(0, 10),
                `${c.landlord_name || ''} ${c.landlord_lastname || ''}`.trim().substring(0, 12),
                `${c.tenant_name || ''} ${c.tenant_lastname || ''}`.trim().substring(0, 12),
                c.start_date ? new Date(c.start_date).toLocaleDateString('es-CO') : '-',
                c.end_date   ? new Date(c.end_date).toLocaleDateString('es-CO')   : '-',
                c.monthly_rent ? `$${Number(c.monthly_rent).toLocaleString('es-CO')}` : '-',
            ]);
            drawTable(doc, headers, rows);
        }

        // Pie
        doc.moveDown(2);
        doc.fontSize(8).fillColor('#aaaaaa')
            .text(`RentUP — Reporte generado automáticamente el ${new Date().toLocaleString('es-CO')}`,
                { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('❌ Error generando reporte PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error al generar el reporte PDF' });
        }
    }
};

exports.getAvailableReports = async (req, res) => {
    try {
        const reports = [];
        const currentDate = new Date();
        for (let i = 0; i < 12; i++) {
            const date  = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const year  = date.getFullYear();
            const month = date.getMonth() + 1;
            reports.push({ year, month, monthName: monthNames[month - 1], available: true });
        }
        res.json(reports);
    } catch (error) {
        console.error('Error obteniendo reportes:', error);
        res.status(500).json({ error: 'Error al obtener reportes disponibles' });
    }
};

exports.downloadReport = async (req, res) => {
    try {
        const { year, month } = req.params;
        const targetYear = parseInt(year);
        const targetMonth = parseInt(month);

        const filenameShort = `reporte_${targetYear}_${String(targetMonth).padStart(2, '0')}.pdf`;
        const filePath = path.join(REPORTS_DIR, filenameShort);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Reporte no encontrado. Genérelo primero.' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameShort}"`);
        res.download(filePath, filenameShort);
    } catch (error) {
        console.error('Error descargando reporte:', error);
        res.status(500).json({ error: 'Error al descargar el reporte' });
    }
};
