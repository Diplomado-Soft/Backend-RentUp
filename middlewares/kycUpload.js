const multer = require('multer');
const idriveService = require('../utils/idriveService');

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
        files: 2
    }
});

exports.processKycDocuments = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Debe subir al menos un documento' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        req.kycDocuments = {};

        for (const file of req.files) {
            if (!ALLOWED_MIMES.has(file.mimetype)) {
                return res.status(400).json({
                    error: `Tipo de archivo no permitido: ${file.originalname}. Solo JPG, PNG y PDF`
                });
            }

            const fieldName = file.fieldname;
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
        }

        next();
    } catch (error) {
        console.error('❌ Error procesando documentos KYC:', error.message);
        return res.status(500).json({ error: 'Error al procesar documentos: ' + error.message });
    }
};
