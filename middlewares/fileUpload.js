const multer = require('multer');
const sharp = require('sharp');
const idriveService = require('../utils/idriveService');
require('dotenv').config();

// Configuración de almacenamiento EN MEMORIA (no local)
const storage = multer.memoryStorage();

<<<<<<< HEAD
// Tipos MIME permitidos
=======
// Tipos de imágenes permitidos
>>>>>>> ca98b90 (fix: ajuste final en la lógica de controladores)
const defaultMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const allowedMimes = new Set(
    process.env.ALLOWED_MIMES
        ? process.env.ALLOWED_MIMES.split(',').map(mime => mime.trim())
        : defaultMimes
);

<<<<<<< HEAD

=======
// Filtro de multer
>>>>>>> ca98b90 (fix: ajuste final en la lógica de controladores)
const fileFilter = (req, file, cb) => {
    if (!allowedMimes.has(file.mimetype)) {
        return cb(new Error('Tipo de archivo no permitido'), false);
    }
    cb(null, true);
};

exports.upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: process.env.MAX_FILE_SIZE || 10 * 1024 * 1024,
        files: process.env.MAX_FILES || 10
    }
});

<<<<<<< HEAD
=======
// Procesar y subir imágenes a IDrive e2
>>>>>>> ca98b90 (fix: ajuste final en la lógica de controladores)
exports.validateFiles = async (req, res, next) => {
    if (!req.files?.length) return next();

    try {
        req.processedFiles = [];
        const userId = req.user?.id || req.user?.user_id;
        const apartmentId = req.body?.apartmentId;

        if (!userId) {
            throw new Error('Usuario no autenticado');
        }

        for (const file of req.files) {
            try {
<<<<<<< HEAD
                // Validación de tipo real usando el mimetype de multer
                if (!allowedMimes.has(file.mimetype)) {
                    throw new Error(`Tipo de archivo no permitido: ${file.originalname}`);
                }

                // Procesar imágenes
                if (file.mimetype.startsWith('image/')) {
=======
                // Usar el mimetype declarado por multer (ya fue filtrado en fileFilter)
                const detectedMime = file.mimetype;

                if (!allowedMimes.has(detectedMime)) {
                    throw new Error(`Tipo de archivo no permitido: ${file.originalname}`);
                }

                if (detectedMime.startsWith('image/')) {
>>>>>>> ca98b90 (fix: ajuste final en la lógica de controladores)
                    const processedBuffer = await sharp(file.buffer)
                        .resize({
                            width: 1920,
                            height: 1080,
                            fit: 'inside',
                            withoutEnlargement: true
                        })
                        .webp({
                            quality: 80,
                            lossless: false,
                            alphaQuality: 100
                        })
                        .toBuffer();

                    // Subir a IDrive e2
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
<<<<<<< HEAD
                    
=======

>>>>>>> ca98b90 (fix: ajuste final en la lógica de controladores)
                    console.log('✅ Imagen procesada y subida a IDrive e2:', {
                        filename: file.originalname,
                        s3_key: uploadResult.key
                    });
                }
            } catch (fileError) {
                console.error('Error procesando archivo:', file.originalname, fileError.message);
                throw fileError;
            }
        }

        console.log(`✅ ${req.processedFiles.length} archivo(s) procesado(s) y subido(s) a IDrive e2`);
        next();
    } catch (error) {
        console.error('❌ Error en validateFiles:', error.message);
        return next(error);
    }
};
