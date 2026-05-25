const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const BRAND_NAVY = '#2E5A88';
const LOGO_PATH = path.join(__dirname, '..', '..', 'frontend-RentUp', 'public', 'Preview-nobg.png');

function generateReceiptBuffer(payment) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 35, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const pw = doc.page.width;

            doc.rect(0, 0, pw, 75).fill('#ffffff');
            doc.rect(0, 73, pw, 2).fill('#e5dfd2');

            try {
                doc.image(LOGO_PATH, 35, 12, { height: 50 });
            } catch {
                doc.fontSize(16).font('Helvetica-Bold').fillColor(BRAND_NAVY)
                    .text('RentUp', 35, 22);
            }

            doc.fontSize(7.5).font('Helvetica').fillColor('#536379')
                .text(`Recibo N° ${payment.payment_id}`, 35, 12, { align: 'right' })
                .text(new Date().toLocaleDateString('es-CO'), 35, 23, { align: 'right' });

            doc.save();
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#c4633a')
                .text('MODO DE PRUEBA — Sin validez legal', 35, 62);
            doc.restore();

            let y = 88;

            doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND_NAVY)
                .text('RECIBO DE PAGO', 35, y, { align: 'center' });
            y = doc.y + 5;
            doc.y = y;

            doc.moveTo(35, y).lineTo(pw - 35, y).strokeColor('#d1d5db').stroke();
            y += 5;
            doc.y = y;

            const lineHeight = 18;
            const drawField = (label, value) => {
                doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#374151')
                    .text(label, 35, y, { width: 115 });
                doc.font('Helvetica').fontSize(8.5).fillColor('#111827')
                    .text(`: ${value || '-'}`, 150, y, { width: 380 });
                y += lineHeight;
                doc.y = y;
            };

            drawField('Inquilino', `${payment.tenant_name || ''} ${payment.tenant_lastname || ''}`);
            drawField('Arrendador', `${payment.landlord_name || ''} ${payment.landlord_lastname || ''}`);
            drawField('Dirección', payment.direccion_apt || '-');
            drawField('Barrio', payment.barrio || '-');
            drawField('Método de pago', payment.payment_method === 'card' ? 'Tarjeta' :
                payment.payment_method === 'paypal' ? 'PayPal' : payment.payment_method || 'Otro');
            drawField('Estado', payment.status === 'completed' ? 'Pagado' : payment.status);
            drawField('Fecha de pago', payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('es-CO', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '-');

            y += 5;
            doc.y = y;
            doc.moveTo(35, y).lineTo(pw - 35, y).strokeColor('#d1d5db').stroke();
            y += 8;
            doc.y = y;

            doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_NAVY)
                .text(`Total pagado: $${Number(payment.amount).toLocaleString('es-CO')} COP`, 35, y, { align: 'center' });
            y = doc.y + 10;
            doc.y = y;

            if (payment.status === 'completed') {
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#059669')
                    .text('✓ PAGO CONFIRMADO', 35, y, { align: 'center' });
            }

            y = doc.page.height - 50;
            doc.y = y;
            doc.moveTo(35, y).lineTo(pw - 35, y).strokeColor('#d1d5db').stroke();
            y += 4;
            doc.y = y;

            doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
                .text('Este recibo fue generado automáticamente por RentUp — Plataforma de gestión de arriendos, Uniputumayo.', 35, y, { align: 'center' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateReceiptBuffer };
