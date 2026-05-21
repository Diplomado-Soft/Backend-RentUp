const PDFDocument = require('pdfkit');

function generateReceiptBuffer(payment) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.rect(0, 0, doc.page.width, 110).fill('#1e40af');

            doc.fontSize(28).font('Helvetica-Bold').fillColor('#ffffff')
                .text('RentUp', 50, 25);
            doc.fontSize(10).font('Helvetica').fillColor('#d0d1ff')
                .text('Comprobante de pago', 50, 65);

            const now = new Date();
            doc.fontSize(9).font('Helvetica').fillColor('#ffffff')
                .text(`Fecha: ${now.toLocaleDateString('es-CO')}`, 50, 25, { align: 'right' })
                .text(`Recibo N°: ${payment.payment_id}`, 50, 38, { align: 'right' });

            doc.y = 140;

            doc.fillColor('#1e40af').fontSize(22).font('Helvetica-Bold')
                .text('RECIBO DE PAGO', { align: 'center' }).moveDown(1);

            doc.fillColor('#000000').fontSize(11).font('Helvetica');

            const lineHeight = 20;
            let y = doc.y;

            const drawField = (label, value) => {
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151')
                    .text(label, 50, y, { width: 150, continued: true });
                doc.font('Helvetica').fontSize(10).fillColor('#111827')
                    .text(`: ${value || '-'}`, { width: 350 });
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

            y += 10;
            doc.y = y;

            doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#d1d5db').stroke();
            doc.moveDown(1.5);

            doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e40af')
                .text(`Total pagado: $${Number(payment.amount).toLocaleString('es-CO')}`, { align: 'center' });
            doc.moveDown(0.5);

            const statusColor = payment.status === 'completed' ? '#059669' : '#d97706';
            doc.font('Helvetica-Bold').fontSize(11).fillColor(statusColor)
                .text(payment.status === 'completed' ? '✓ PAGO CONFIRMADO' : '⏳ PENDIENTE', { align: 'center' });

            doc.moveDown(3);

            doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
                .text('Este recibo fue generado automáticamente por RentUp.', { align: 'center' })
                .text('Plataforma de gestión de arriendos — Uniputumayo.', { align: 'center' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateReceiptBuffer };
