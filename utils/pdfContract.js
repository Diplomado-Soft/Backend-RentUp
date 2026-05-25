const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const BRAND_NAVY = '#2E5A88';
const BRAND_BLUE = '#3B8FC7';
const LOGO_PATH = path.join(__dirname, '..', '..', 'frontend-RentUp', 'public', 'Preview-nobg.png');

function generateContractBuffer(contract) {
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
                .text(`N° ${contract.agreement_id}`, 35, 12, { align: 'right' })
                .text(new Date().toLocaleDateString('es-CO'), 35, 23, { align: 'right' });

            doc.save();
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#c4633a')
                .text('MODO DE PRUEBA — Sin validez legal', 35, 62);
            doc.restore();

            let y = 88;

            doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND_NAVY)
                .text('CONTRATO DE ARRENDAMIENTO', 35, y, { align: 'center' });
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

            drawField('Arrendador', contract.landlord_name ? `${contract.landlord_name} ${contract.landlord_lastname || ''}` : '-');
            drawField('Arrendatario', contract.tenant_name ? `${contract.tenant_name} ${contract.tenant_lastname || ''}` : '-');
            drawField('Dirección del Inmueble', contract.direccion_apt || '-');
            drawField('Barrio', contract.barrio || contract.barrio_name || '-');
            drawField('Fecha de Inicio', contract.start_date ? new Date(contract.start_date).toLocaleDateString('es-CO') : '-');
            drawField('Fecha de Terminación', contract.end_date ? new Date(contract.end_date).toLocaleDateString('es-CO') : '-');
            drawField('Canon Mensual', contract.monthly_rent ? `$${Number(contract.monthly_rent).toLocaleString('es-CO')} COP` : '-');
            drawField('Depósito', contract.deposit_amount ? `$${Number(contract.deposit_amount).toLocaleString('es-CO')} COP` : 'N/A');
            drawField('Estado', contract.status === 'active' ? 'Activo' : contract.status);

            y += 2;
            doc.y = y;
            doc.moveTo(35, y).lineTo(pw - 35, y).strokeColor('#d1d5db').stroke();
            y += 4;
            doc.y = y;

            doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_NAVY)
                .text('CLÁUSULAS', 35, y);
            y = doc.y + 3;
            doc.y = y;

            const clauses = [
                'PRIMERA: El arrendador entrega en arrendamiento el inmueble descrito, para uso exclusivo como vivienda del arrendatario.',
                'SEGUNDA: El canon de arrendamiento se pagará por mensualidades vencidas dentro de los primeros cinco (5) días de cada mes, en la cuenta que el arrendador indique.',
                'TERCERA: El arrendatario se obliga a cuidar el inmueble como un buen padre de familia, realizando las reparaciones menores que demande el uso normal.',
                'CUARTA: El arrendatario no podrá subarrendar, ceder ni traspasar sus derechos sin autorización escrita y expresa del arrendador.',
                'QUINTA: El presente contrato terminará por las causales legales establecidas en la ley y por la expiración del plazo pactado.'
            ];

            doc.font('Helvetica').fontSize(7.5).fillColor('#374151');
            clauses.forEach(clause => {
                doc.text(clause, { align: 'justify', indent: 8 });
                y = doc.y + 2;
                doc.y = y;
            });

            y += 30;
            doc.y = y;
            doc.moveTo(35, y).lineTo(pw - 35, y).strokeColor('#d1d5db').stroke();
            y += 10;
            doc.y = y;

            doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_NAVY)
                .text('FIRMAS', 35, y, { align: 'center' });
            y = doc.y + 8;
            doc.y = y;

            const sigWidth = 200;
            const sigHeight = 45;
            const leftX = 50;
            const rightX = pw - 50 - sigWidth;
            const labelY = y;
            const sigImageY = y + 12;
            const dateY = sigImageY + sigHeight + 1;

            const drawSignatureBox = (label, signature, signedAt, x) => {
                doc.roundedRect(x - 5, labelY - 2, sigWidth + 10, 65, 4).strokeColor('#e5e7eb').stroke();

                doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151')
                    .text(label, x, labelY, { width: sigWidth, align: 'center' });

                if (signature) {
                    const buf = Buffer.from(signature.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                    doc.image(buf, x, sigImageY, { width: sigWidth, height: sigHeight });
                    if (signedAt) {
                        doc.font('Helvetica').fontSize(6).fillColor('#6b7280')
                            .text(`Firmado: ${new Date(signedAt).toLocaleString('es-CO')}`, x, dateY, { width: sigWidth, align: 'center' });
                    }
                } else {
                    doc.fontSize(10).fillColor('#9ca3af').font('Helvetica')
                        .text('___________________________', x, sigImageY + 4, { width: sigWidth, align: 'center' });
                    doc.fontSize(6.5).fillColor('#6b7280')
                        .text('Firma', x, sigImageY + 20, { width: sigWidth, align: 'center' });
                }
            };

            drawSignatureBox('ARRENDADOR', contract.landlord_signature, contract.landlord_signed_at, leftX);
            drawSignatureBox('ARRENDATARIO', contract.tenant_signature, contract.tenant_signed_at, rightX);

            const sigBottom = labelY + 65;
            const pageBottom = doc.page.height - 40;
            const footerY = Math.max(sigBottom + 30, pageBottom - 20);
            doc.moveTo(35, footerY).lineTo(pw - 35, footerY).strokeColor('#d1d5db').stroke();
            doc.fontSize(6).fillColor('#9ca3af').font('Helvetica')
                .text('Documento generado electrónicamente por RentUp — Sin validez legal. Contrato en modo de prueba.', 35, footerY + 3, { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateContractBuffer };
