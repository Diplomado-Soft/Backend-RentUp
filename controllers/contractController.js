const Contract = require('../models/ContractModel');
const db = require('../config/db');
const { sendContractAgreementEmail, sendContractRenewalEmail } = require('../utils/emailService');
const { CreateContractDTO, UpdateContractDTO, ContractDTO } = require('../dtos');

exports.createContract = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        console.log('User ID:', userId);
        console.log('Request body:', req.body);

        // Usar CreateContractDTO para validación
        const contractDTO = new CreateContractDTO({
            ...req.body,
            landlord_id: userId
        });

        const validation = contractDTO.validate();
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Datos de contrato inválidos',
                errors: validation.errors
            });
        }

        if (userId === parseInt(req.body.tenant_id)) {
            return res.status(400).json({
                error: 'No puedes arrendar un apartamento a ti mismo'
            });
        }

        const dtoData = contractDTO.toDatabaseFormat();

        const contract = await Contract.create(dtoData);

        // Obtener datos para el correo
        const tenant_id = dtoData.tenant_id;
        const [tenantData] = await db.query(
            'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
            [tenant_id]
        );
        const [landlordData] = await db.query(
            'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
            [userId]
        );
        const [aptData] = await db.query(
            'SELECT direccion_apt FROM apartments WHERE id_apt = ?',
            [dtoData.id_apt]
        );

        const { start_date, end_date, monthly_rent } = dtoData;

        // Enviar correo al inquilino
        if (tenantData.length > 0) {
            sendContractAgreementEmail(
                tenantData[0].user_email,
                tenantData[0].user_name,
                tenantData[0].user_lastname,
                aptData[0]?.direccion_apt || 'Vivienda',
                new Date(start_date).toLocaleDateString(),
                new Date(end_date).toLocaleDateString(),
                monthly_rent
            ).catch(err => console.error('Error enviando correo a inquilino:', err.message));
        }

        // Enviar correo al arrendador
        if (landlordData.length > 0) {
            sendContractAgreementEmail(
                landlordData[0].user_email,
                landlordData[0].user_name,
                landlordData[0].user_lastname,
                aptData[0]?.direccion_apt || 'Vivienda',
                new Date(start_date).toLocaleDateString(),
                new Date(end_date).toLocaleDateString(),
                monthly_rent
            ).catch(err => console.error('Error enviando correo a arrendador:', err.message));
        }

        res.status(201).json({
            message: 'Arriendo creado exitosamente',
            contract
        });
    } catch (error) {
        console.error('Error creando contrato:', error);
        res.status(500).json({ 
            error: 'Error al crear el arriendo',
            message: error.message 
        });
    }
};

exports.getLandlordContracts = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const aptContracts = await Contract.getApartmentContracts(userId);
        
        // Usar ContractDTO para formatear respuesta
        const formattedContracts = ContractDTO.fromDatabaseList(aptContracts);
        res.json(formattedContracts);
    } catch (error) {
        console.error('Error obteniendo contratos:', error);
        res.status(500).json({ error: 'Error al obtener los contratos' });
    }
};

exports.getAvailableApartments = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const apartments = await Contract.getAvailableApartments(userId);
        res.json(apartments);
    } catch (error) {
        console.error('Error obteniendo apartamentos disponibles:', error);
        res.status(500).json({ error: 'Error al obtener apartamentos' });
    }
};

exports.searchTenants = async (req, res) => {
    try {
        const { q } = req.query;
        const userId = req.user?.id || req.user?.userId;
        if (!q || q.length < 2) {
            return res.json([]);
        }
        const tenants = await Contract.searchTenants(q, userId);
        res.json(tenants);
    } catch (error) {
        console.error('Error buscando inquilinos:', error);
        res.status(500).json({ error: 'Error al buscar inquilinos' });
    }
};

exports.getMyContracts = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const userRole = req.user?.rol;

        console.log('getMyContracts - userId:', userId, 'userRole:', userRole);

        let myContracts;
        if (userRole === 2) {
            myContracts = await Contract.getByLandlord(userId);
        } else {
            myContracts = await Contract.getByTenant(userId);
        }

        // Usar ContractDTO para formatear respuesta
        const formattedContracts = ContractDTO.fromDatabaseList(myContracts);
        res.json(formattedContracts);
    } catch (error) {
        console.error('Error obteniendo contratos:', error);
        res.status(500).json({ error: 'Error al obtener los contratos' });
    }
};

exports.getContractById = async (req, res) => {
    try {
        const { agreement_id } = req.params;
        const contract = await Contract.getById(agreement_id);

        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        // Usar ContractDTO para formatear respuesta
        const contractDTO = ContractDTO.fromDatabase(contract);
        res.json(contractDTO);
    } catch (error) {
        console.error('Error obteniendo contrato:', error);
        res.status(500).json({ error: 'Error al obtener el contrato' });
    }
};

exports.updateContractStatus = async (req, res) => {
    try {
        const { agreement_id } = req.params;

        // Usar UpdateContractDTO para validación
        const updateDTO = new UpdateContractDTO(req.body);
        const validation = updateDTO.validate();
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Datos de actualización inválidos',
                details: validation.errors
            });
        }

        const dtoData = updateDTO.toDatabaseFormat();

        if (!dtoData.status) {
            return res.status(400).json({ error: 'Se requiere un estado válido' });
        }

        const result = await Contract.updateStatus(parseInt(agreement_id), dtoData.status);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        res.json({ message: 'Estado del contrato actualizado' });
    } catch (error) {
        console.error('Error actualizando contrato:', error);
        res.status(500).json({ error: 'Error al actualizar el contrato' });
    }
};

exports.getMonthlyStats = async (req, res) => {
    try {
        const { year, month } = req.query;
        const stats = await Contract.getMonthlyStats(
            parseInt(year) || new Date().getFullYear(),
            parseInt(month) || new Date().getMonth() +1
        );
        
        // Formatear respuesta (si es necesario)
        res.json(stats);
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

exports.renewContract = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const userRole = req.user?.rol;
        const { agreement_id } = req.params;
        const { months } = req.body;

        const monthsToAdd = months || 12;

        const contract = await Contract.getById(agreement_id);
        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        if (userRole !== 1 && userRole !== 2) {
            return res.status(403).json({ error: 'No autorizado para renovar este contrato' });
        }
        if (contract.tenant_id !== userId && contract.landlord_id !== userId) {
            return res.status(403).json({ error: 'No eres parte de este contrato' });
        }
        if (contract.status !== 'active') {
            return res.status(400).json({ error: 'Solo se pueden renovar contratos activos' });
        }

        const currentEnd = new Date(contract.end_date);
        const newEnd = new Date(currentEnd);
        newEnd.setMonth(newEnd.getMonth() + monthsToAdd);

        const renewed = await Contract.renew(parseInt(agreement_id), newEnd.toISOString().split('T')[0]);

        try {
            const [tenant] = await db.query(
                'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                [contract.tenant_id]
            );
            const [landlord] = await db.query(
                'SELECT user_name, user_lastname, user_email FROM users WHERE user_id = ?',
                [contract.landlord_id]
            );
            const [apt] = await db.query(
                'SELECT direccion_apt FROM apartments WHERE id_apt = ?',
                [contract.property_id]
            );

            if (tenant.length > 0) {
                sendContractRenewalEmail(
                    tenant[0].user_email,
                    tenant[0].user_name,
                    tenant[0].user_lastname,
                    apt[0]?.direccion_apt || 'N/A',
                    newEnd.toLocaleDateString('es-CO'),
                    monthsToAdd
                ).catch(e => console.error('Error email renovación tenant:', e.message));
            }
            if (landlord.length > 0) {
                sendContractRenewalEmail(
                    landlord[0].user_email,
                    landlord[0].user_name,
                    landlord[0].user_lastname,
                    apt[0]?.direccion_apt || 'N/A',
                    newEnd.toLocaleDateString('es-CO'),
                    monthsToAdd
                ).catch(e => console.error('Error email renovación landlord:', e.message));
            }
        } catch (emailErr) {
            console.error('Error enviando correo de renovación:', emailErr.message);
        }

        res.json({
            message: 'Contrato renovado exitosamente',
            contract: ContractDTO.fromDatabase(renewed)
        });

    } catch (error) {
        console.error('Error renovando contrato:', error);
        res.status(500).json({ error: 'Error al renovar el contrato', message: error.message });
    }
};

exports.endAndMakeAvailable = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const userRole = req.user?.rol;
        const { agreement_id } = req.params;

        const contract = await Contract.getById(agreement_id);
        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        if (userRole !== 1 && userRole !== 2) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        if (contract.tenant_id !== userId && contract.landlord_id !== userId) {
            return res.status(403).json({ error: 'No eres parte de este contrato' });
        }
        if (contract.status !== 'active') {
            return res.status(400).json({ error: 'El contrato no está activo' });
        }

        const expired = await Contract.hasAutoExpiredAndMakeAvailable(parseInt(agreement_id));
        if (!expired) {
            return res.status(400).json({ error: 'No se pudo finalizar el contrato' });
        }

        res.json({
            message: 'Contrato finalizado y vivienda marcada como disponible',
            agreement_id
        });

    } catch (error) {
        console.error('Error finalizando contrato:', error);
        res.status(500).json({ error: 'Error al finalizar el contrato', message: error.message });
    }
};

exports.getContractPdf = async (req, res) => {
    try {
        const { agreement_id } = req.params;
        const Contract = require('../models/ContractModel');
        const contract = await Contract.getById(agreement_id);

        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 60, layout: 'portrait' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contrato-${agreement_id}.pdf"`);

        doc.pipe(res);

        const ML = 60, MR = 60;
        const pageW = 595.28;
        const contentW = pageW - ML - MR;

        // ── Watermark / Header line ──
        doc.rect(ML, 40, contentW, 2).fill('#6A6BEF');
        doc.fillColor('#000');

        // ── Title ──
        doc.moveDown(3);
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#1a1a2e')
            .text('CONTRATO DE ARRENDAMIENTO', ML, doc.y, { align: 'center', width: contentW });
        doc.fontSize(10).font('Helvetica').fillColor('#6A6BEF')
            .text('RentUp — Plataforma Inmobiliaria', { align: 'center', width: contentW });
        doc.fillColor('#000');
        doc.moveDown(1.5);

        // ── Info block ──
        const infoBoxY = doc.y;
        doc.roundedRect(ML, infoBoxY, contentW, 8, 4).fill('#f4f4f9');
        doc.fillColor('#000');

        const col1X = ML + 15;
        const col2X = ML + contentW / 2 + 5;
        const rowH = 16;
        let rowY = infoBoxY + 10;

        const field = (x, y, label, value) => {
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6A6BEF')
                .text(label.toUpperCase(), x, y, { width: contentW / 2 - 25, lineBreak: false });
            doc.fontSize(9).font('Helvetica').fillColor('#1a1a2e')
                .text(value || '—', x, y + 10, { width: contentW / 2 - 25 });
        };

        const fields = [
            [
                { label: 'No. Contrato', value: `RA-${String(contract.agreement_id).padStart(4, '0')}` },
                { label: 'Estado', value: contract.status === 'signed' ? 'FIRMADO' : (contract.status || 'Pendiente') }
            ],
            [
                { label: 'Inquilino', value: contract.tenant_name || '—' },
                { label: 'Arrendador', value: contract.landlord_name || '—' }
            ],
            [
                { label: 'Dirección', value: contract.direccion_apt || '—' },
                { label: 'Barrio', value: contract.barrio || '—' }
            ],
            [
                { label: 'Fecha Inicio', value: contract.start_date ? new Date(contract.start_date).toLocaleDateString('es-CO') : '—' },
                { label: 'Fecha Fin', value: contract.end_date ? new Date(contract.end_date).toLocaleDateString('es-CO') : '—' }
            ],
            [
                { label: 'Canon Mensual', value: contract.monthly_rent
                    ? `$${Number(contract.monthly_rent).toLocaleString('es-CO')}`
                    : '—' },
                { label: 'Creado', value: contract.created_at ? new Date(contract.created_at).toLocaleDateString('es-CO') : '—' }
            ]
        ];

        if (contract.signed_at) {
            fields.push([
                { label: 'Firmado', value: new Date(contract.signed_at).toLocaleString('es-CO') },
                { label: '', value: '' }
            ]);
        }

        fields.forEach(pair => {
            field(col1X, rowY, pair[0].label, pair[0].value);
            field(col2X, rowY, pair[1].label, pair[1].value);
            rowY += rowH + 4;
        });

        doc.fillColor('#000');
        const boxBottom = rowY + 6;
        doc.roundedRect(ML, infoBoxY, contentW, boxBottom - infoBoxY, 4).stroke('#e0e0e8');

        // ── Cláusulas ──
        const termsStartY = boxBottom + 25;
        doc.y = termsStartY;
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a2e')
            .text('CLÁUSULAS', { align: 'center', width: contentW });
        doc.moveDown(0.3);
        doc.fontSize(8).fillColor('#6A6BEF')
            .text('—'.repeat(60), { align: 'center', width: contentW });
        doc.fillColor('#000');
        doc.moveDown(0.8);

        const clauses = [
            {
                title: 'PRIMERA — OBJETO DEL CONTRATO',
                text: 'El Arrendador entrega en arriendo al Arrendatario el inmueble identificado en la cláusula de información general, para ser destinado exclusivamente como vivienda urbana. El Arrendatario declara conocer el inmueble y recibirlo en buen estado de conservación e higiene.'
            },
            {
                title: 'SEGUNDA — PLAZO Y VIGENCIA',
                text: 'El término de duración del presente contrato será el estipulado en las fechas de inicio y fin indicadas en la información general. El contrato se renovará automáticamente por períodos iguales si ninguna de las partes manifiesta su voluntad de no renovar con al menos 30 días de antelación a la fecha de terminación.'
            },
            {
                title: 'TERCERA — CANON DE ARRENDAMIENTO',
                text: `El Arrendatario se obliga a pagar al Arrendador la suma mensual de $${Number(contract.monthly_rent).toLocaleString('es-CO')} COP, dentro de los primeros cinco (5) días de cada mes, en la cuenta bancaria que el Arrendador indique por escrito.`
            },
            {
                title: 'CUARTA — OBLIGACIONES DEL ARRENDATARIO',
                text: 'El Arrendatario se obliga a: (a) Pagar puntualmente el canon; (b) Usar el inmueble debidamente; (c) No subarrendar ni ceder el contrato sin autorización escrita; (d) Permitir visitas de inspección previa coordinación; (e) Responder por daños causados por sí o por sus acompañantes.'
            },
            {
                title: 'QUINTA — OBLIGACIONES DEL ARRENDADOR',
                text: 'El Arrendador se obliga a: (a) Entregar el inmueble en condiciones óptimas de habitabilidad; (b) Realizar las reparaciones estructurales necesarias; (c) Garantizar el uso pacífico del inmueble; (d) Restituir el depósito de garantía al finalizar el contrato, si no hay daños.'
            },
            {
                title: 'SEXTA — VALIDEZ DE LA FIRMA DIGITAL',
                text: 'Las partes aceptan que la firma digital del presente contrato, realizada a través de la plataforma RentUp, tiene plena validez legal de conformidad con la Ley 527 de 1999 y las disposiciones del Código de Comercio colombiano.'
            },
            {
                title: 'SÉPTIMA — TERMINACIÓN ANTICIPADA',
                text: 'Cualquiera de las partes puede dar por terminado el contrato de forma anticipada, dando un preaviso mínimo de 30 días calendario por escrito. En caso de terminación anticipada por parte del Arrendatario, deberá pagar una penalidad equivalente a un (1) mes de canon.'
            }
        ];

        clauses.forEach(clause => {
            if (doc.y > 650) {
                doc.addPage();
            }
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a2e')
                .text(clause.title, { continued: false });
            doc.fontSize(8.5).font('Helvetica').fillColor('#333')
                .text(clause.text, { align: 'justify', lineGap: 2 });
            doc.moveDown(0.7);
            doc.fillColor('#000');
        });

        // ── Signature section ──
        if (doc.y > 620) doc.addPage();
        doc.moveDown(2);
        doc.fontSize(8).fillColor('#6A6BEF')
            .text('—'.repeat(60), { align: 'center', width: contentW });
        doc.fillColor('#000');
        doc.moveDown(1);

        const fmtFullDate = (d) => {
            const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            const date = new Date(d);
            return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
        };

        doc.fontSize(9).font('Helvetica').fillColor('#333')
            .text(`En Mocoa, Putumayo, a ${fmtFullDate(new Date())}.`, { align: 'center', width: contentW });
        doc.moveDown(2.5);

        const sigY = doc.y;
        const sigW = 180;
        const sigGap = 40;
        const sigLeft = ML;
        const sigRight = pageW - MR - sigW;

        doc.moveTo(sigLeft, sigY).lineTo(sigLeft + sigW, sigY).stroke('#999');
        doc.moveTo(sigRight, sigY).lineTo(sigRight + sigW, sigY).stroke('#999');

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a2e');
        doc.text(contract.landlord_name || 'ARRENDADOR', sigLeft, sigY + 6, { width: sigW, align: 'center' });
        doc.fontSize(7.5).font('Helvetica').fillColor('#888')
            .text('Firma Arrendador', sigLeft, sigY + 20, { width: sigW, align: 'center' });

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a2e');
        doc.text(contract.tenant_name || 'ARRENDATARIO', sigRight, sigY + 6, { width: sigW, align: 'center' });
        doc.fontSize(7.5).font('Helvetica').fillColor('#888')
            .text('Firma Arrendatario', sigRight, sigY + 20, { width: sigW, align: 'center' });

        doc.fillColor('#000');

        if (contract.status === 'signed') {
            doc.moveDown(5);
            doc.fontSize(8.5).fillColor('#2e7d32');
            doc.text(
                `✓ Este contrato fue firmado digitalmente el ${new Date(contract.signed_at).toLocaleString('es-CO')} a través de RentUp.`,
                { align: 'center', width: contentW }
            );
            doc.fillColor('#000');
        }

        // ── Footer ──
        const footerY = pageW * 1.414 - 45;
        doc.fontSize(6.5).fillColor('#aaa')
            .text(`Documento generado electrónicamente por RentUp • RA-${String(contract.agreement_id).padStart(4, '0')} • Página`, ML, footerY, { width: contentW, align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Error generando PDF:', error);
        res.status(500).json({ error: 'Error al generar el PDF' });
    }
};

exports.signContract = async (req, res) => {
    try {
        const { agreement_id } = req.params;

        const contract = await Contract.sign(parseInt(agreement_id, 10));

        // ─────────────────────────────────────────────────────────
        // Simulación de envío de notificación por correo a ambas partes
        // Descomentar y configurar cuando se tengan las credenciales SMTP
        //
        // try {
        //     const mailOptionsTenant = {
        //         from: `"RentUp" <${process.env.GMAIL_USER}>`,
        //         to: contract.tenant_email,
        //         subject: 'Contrato firmado exitosamente - RentUp',
        //         html: `
        //             <div style="font-family: Arial, sans-serif;">
        //                 <h2 style="color: #2e5a88;">¡Contrato firmado!</h2>
        //                 <p>El contrato de arriendo para <strong>${contract.direccion_apt}</strong>
        //                    ha sido firmado digitalmente.</p>
        //                 <p>Fecha de firma: ${new Date(contract.signed_at).toLocaleString('es-CO')}</p>
        //             </div>
        //         `
        //     };
        //     await transporter.sendMail(mailOptionsTenant);
        //
        //     const mailOptionsLandlord = {
        //         from: `"RentUp" <${process.env.GMAIL_USER}>`,
        //         to: contract.landlord_email,
        //         subject: 'Contrato firmado exitosamente - RentUp',
        //         html: `
        //             <div style="font-family: Arial, sans-serif;">
        //                 <h2 style="color: #2e5a88;">¡Contrato firmado!</h2>
        //                 <p>El contrato de arriendo para <strong>${contract.direccion_apt}</strong>
        //                    ha sido firmado digitalmente por el inquilino.</p>
        //                 <p>Fecha de firma: ${new Date(contract.signed_at).toLocaleString('es-CO')}</p>
        //             </div>
        //         `
        //     };
        //     await transporter.sendMail(mailOptionsLandlord);
        // } catch (emailErr) {
        //     console.error('Error enviando notificación de firma:', emailErr.message);
        // }
        // ─────────────────────────────────────────────────────────

        res.json({
            message: 'Contrato firmado exitosamente',
            contract: ContractDTO.fromDatabase(contract)
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        console.error('Error firmando contrato:', error);
        res.status(500).json({ error: 'Error al firmar el contrato', message: error.message });
    }
};

exports.expireOldContracts = async (req, res) => {
    try {
        const expiredCount = await Contract.expireOldContracts();
        res.json({ message: `${expiredCount} contratos expirados`, expiredCount });
    } catch (error) {
        console.error('Error expirando contratos:', error);
        res.status(500).json({ error: 'Error al expirar contratos' });
    }
};
