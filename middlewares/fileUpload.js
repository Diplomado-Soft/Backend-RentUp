const multer = require('multer');
const sharp = require('sharp');
const idriveService = require('../utils/idriveService');
require('dotenv').config();

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'svg']);
const MAX_IMAGE_DIMENSION = 1920;

const storage = multer.memoryStorage();

exports.upload = multer({
    storage,
    limits: {
        fileSize: process.env.MAX_FILE_SIZE || 10 * 1024 * 1024,
        files: process.env.MAX_FILES || 10
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
    if (!req.files?.length) return next();

    try {
        req.processedFiles = [];
        const userId = req.user?.id;
        const apartmentId = req.body?.apartmentId;

        if (!userId) {
            throw new Error('Usuario no autenticado');
        }

        for (const file of req.files) {
            try {
                const format = await detectImageFormat(file.buffer);
                if (!format || !ALLOWED_FORMATS.has(format)) {
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
                    apartmentId || 'temp',
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
