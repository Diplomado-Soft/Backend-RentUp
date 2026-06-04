const multer = require('multer');
const crypto = require('crypto');
const idriveService = require('../utils/idriveService');
const User = require('../models/userModel');

const ALLOWED_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf'
]);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const storage = multer.memoryStorage();

exports.upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    }
});

exports.processKycDocuments = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Debe subir un documento' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        if (!ALLOWED_MIMES.has(req.file.mimetype)) {
            return res.status(400).json({
                error: `Tipo de archivo no permitido: ${req.file.originalname}. Solo JPG, PNG y PDF`
            });
        }

        const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

        const existingDoc = await User.findByDocumentHash(fileHash);
        if (existingDoc && existingDoc.user_id !== userId) {
            console.warn(`⚠️ Intento de KYC con documento duplicado. Usuario: ${userId}, dueño original: ${existingDoc.user_id}`);
            return res.status(409).json({
                error: 'Este documento de identidad ya está registrado en el sistema por otro usuario.'
            });
        }

        const uploadResult = await idriveService.uploadDocument(
            req.file.buffer,
            userId,
            'id_document',
            req.file.originalname,
            req.file.mimetype
        );

        req.kycDocuments = {
            id_document: {
                key: uploadResult.key,
                url: uploadResult.signedUrl,
                expiresAt: uploadResult.expiresAt,
                hash: fileHash
            }
        };

        console.log(`✅ Documento KYC procesado: id_document -> ${uploadResult.key}`);

        next();
    } catch (error) {
        console.error('❌ Error procesando documento KYC:', error.message);
        return res.status(500).json({ error: 'Error al procesar documento: ' + error.message });
    }
};
