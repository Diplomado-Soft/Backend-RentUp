const multer = require('multer');
const sharp = require('sharp');
const idriveService = require('../utils/idriveService');
require('dotenv').config();

const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'svg']);
const ALLOWED_KYC_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf'
]);
const MAX_IMAGE_DIMENSION = 1920;

const storage = multer.memoryStorage();

exports.upload = multer({
    storage,
    limits: {
        fileSize: process.env.MAX_FILE_SIZE || 15 * 1024 * 1024,
        files: 15
    }
});

async function detectImageFormat(buffer) {
    try {
        const metadata = await sharp(buffer).metadata();
        return metadata.format;
    } catch {
        return null;
    }
}

exports.validateFiles = async (req, res, next) => {
    // req.files puede ser array (upload.array) u objeto (upload.fields)
    const raw = req.files;
    if (!raw) return next();
    const files = Array.isArray(raw) ? raw : Object.values(raw).flat();
    if (files.length === 0) return next();

    const kycFieldNames = new Set(['id_document']);

    try {
        req.processedFiles = [];
        req.kycDocuments = {};
        const userId = req.user?.id;

        if (!userId) {
            throw new Error('Usuario no autenticado');
        }

        for (const file of files) {
            const fieldName = file.fieldname;

            // ============ KYC DOCUMENTS (id_document) ============
            if (kycFieldNames.has(fieldName)) {
                if (!ALLOWED_KYC_MIMES.has(file.mimetype)) {
                    throw new Error(`Tipo de archivo no permitido para ${fieldName}: ${file.originalname}. Solo JPG, PNG y PDF`);
                }

                const uploadResult = await idriveService.uploadDocument(
                    file.buffer,
                    userId,
                    fieldName,
                    file.originalname,
                    file.mimetype
                );

                req.kycDocuments[fieldName] = {
                    key: uploadResult.key,
                    url: uploadResult.signedUrl,
                    expiresAt: uploadResult.expiresAt
                };

                console.log(`✅ Documento KYC procesado: ${fieldName} -> ${uploadResult.key}`);
                continue;
            }

            // ============ IMAGES (fieldname = 'images', 'new_images', or 'image') ============
            try {
                const format = await detectImageFormat(file.buffer);
                if (!format || !ALLOWED_IMAGE_FORMATS.has(format)) {
                    throw new Error(`Tipo de archivo no permitido: ${file.originalname}`);
                }

                const processedBuffer = await sharp(file.buffer)
                    .resize({
                        width: MAX_IMAGE_DIMENSION,
                        height: MAX_IMAGE_DIMENSION,
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .webp({ quality: 80 })
                    .toBuffer();

                const uploadResult = await idriveService.uploadImage(
                    processedBuffer,
                    userId,
                    req.body?.apartmentId || 'temp',
                    file.originalname
                );

                req.processedFiles.push({
                    s3_key: uploadResult.key,
                    signed_url: uploadResult.signedUrl,
                    expires_at: uploadResult.expiresAt,
                    fileName: file.originalname
                });
            } catch (fileError) {
                console.error('Error procesando archivo:', file.originalname, fileError.message);
                throw fileError;
            }
        }

        next();
    } catch (error) {
        return next(error);
    }
};
