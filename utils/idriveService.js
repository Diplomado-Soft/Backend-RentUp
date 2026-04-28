const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand , GetObjectCommand} = require('@aws-sdk/client-s3');
const { getSignedUrl: generateSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

// Configuración de IDrive e2 (compatible con S3)
const s3Client = new S3Client({
    region: process.env.IDRIVE_REGION || 'ap-south-1',
    endpoint: process.env.IDRIVE_ENDPOINT || 'https://s3.ap-south-1.idrivee2.com',
    credentials: {
        accessKeyId: process.env.IDRIVE_ACCESS_KEY,
        secretAccessKey: process.env.IDRIVE_SECRET_KEY
    }
});

const BUCKET_NAME = process.env.IDRIVE_BUCKET;
const URL_EXPIRATION = parseInt(process.env.URL_EXPIRATION_SECONDS || '604800'); // 7 días por defecto

/**
 * Subir imagen a IDrive e2
 * @param {Buffer} fileBuffer - Buffer de la imagen
 * @param {string} userId - ID del usuario
 * @param {string} apartmentId - ID del apartamento
 * @param {string} originalName - Nombre original del archivo
 * @returns {Promise<{key: string, signedUrl: string, expiresAt: Date}>}
 */
exports.uploadImage = async (fileBuffer, userId, apartmentId, originalName) => {
    try {
        const timestamp = Date.now();
        const randomString = Math.round(Math.random() * 1E9);
        const key = `apartments/${userId}/${apartmentId}/${timestamp}-${randomString}.webp`;

        const uploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: 'image/webp',
            Metadata: {
                'user-id': userId.toString(),
                'apartment-id': apartmentId.toString(),
                'original-name': originalName
            }
        });

        await s3Client.send(uploadCommand);
        console.log(`Imagen subida a IDrive e2: ${key}`);

        // Generar URL firmada
        const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const signedUrl = await generateSignedUrl(s3Client, getCommand, { 
            expiresIn: URL_EXPIRATION 
        });

        const expiresAt = new Date(Date.now() + URL_EXPIRATION * 1000);

        return {
            key,
            signedUrl,
            expiresAt
        };
    } catch (error) {
        console.error('Error al subir imagen a IDrive e2:', error.message);
        throw new Error(`Error al subir imagen: ${error.message}`);
    }
};

/**
 * Generar URL firmada para una imagen existente
 * @param {string} key - Clave del objeto en IDrive e2
 * @returns {Promise<{signedUrl: string, expiresAt: Date}>}
 */
exports.getSignedUrl = async (key) => {
    try {
        const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const signedUrl = await generateSignedUrl(s3Client, getCommand, { 
            expiresIn: URL_EXPIRATION 
        });

        const expiresAt = new Date(Date.now() + URL_EXPIRATION * 1000);

        console.log(`URL firmada generada para: ${key}`);

        return {
            signedUrl,
            expiresAt
        };
    } catch (error) {
        console.error('Error al generar URL firmada:', error.message);
        throw new Error(`Error al generar URL: ${error.message}`);
    }
};

/**
 * Eliminar imagen de IDrive e2
 * @param {string} key - Clave del objeto en IDrive e2
 */
exports.deleteImage = async (key) => {
    try {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        await s3Client.send(deleteCommand);

        console.log(`Imagen eliminada de IDrive e2: ${key}`);
    } catch (error) {
        console.error('Error al eliminar imagen de IDrive e2:', error.message);
        throw new Error(`Error al eliminar imagen: ${error.message}`);
    }
};

/**
 * Verificar si una URL ha expirado
 * @param {Date} expiresAt - Fecha de expiración
 * @returns {boolean}
 */
exports.isUrlExpired = (expiresAt) => {
    const now = new Date();
    // Considerar expirada 1 hora antes para renovar con anticipación
    const buffer = 60 * 60 * 1000; // 1 hora
    return new Date(expiresAt).getTime() - buffer < now.getTime();
};

/**
 * Verificar conexión a IDrive e2
 */
exports.testConnection = async () => {
    try {
        const headCommand = new HeadBucketCommand({ 
            Bucket: BUCKET_NAME 
        });
        await s3Client.send(headCommand);
        console.log('Conexión a IDrive e2 establecida correctamente');
        return true;
    } catch (error) {
        console.error('Error al conectar a IDrive e2:', error.message);
        return false;
    }
};

/**
 * Renovar todas las URLs próximas a expirar
 * Busca imágenes en la base de datos y renueva sus URLs
 */
exports.refreshAllUrls = async () => {
    const db = require('../config/db');
    try {
        console.log('[RefreshAll] Buscando imágenes próximas a expirar...');
        
        // Buscar imágenes que ya expiraron o expiran en menos de 24 horas
        const [images] = await db.query(
            `SELECT id_image, s3_key, expires_at 
             FROM apartment_images 
             WHERE expires_at IS NOT NULL 
             AND expires_at <= DATE_ADD(NOW(), INTERVAL 24 HOUR)`
        );
        
        if (!images || images.length === 0) {
            console.log('[RefreshAll] No hay imágenes por renovar');
            return { renewed: 0 };
        }
        
        console.log(`[RefreshAll] ${images.length} imágenes encontradas para renovar`);
        
        let renewed = 0;
        for (const img of images) {
            try {
                // Generar nueva URL firmada
                const newData = await exports.getSignedUrl(img.s3_key);
                
                // Actualizar en la base de datos
                await db.query(
                    `UPDATE apartment_images 
                     SET signed_url = ?, expires_at = ? 
                     WHERE id_image = ?`,
                    [newData.signedUrl, newData.expiresAt, img.id_image]
                );
                
                renewed++;
            } catch (err) {
                console.error(`Error renovando imagen ${img.id_image}:`, err.message);
            }
        }
        
        console.log(`[RefreshAll] ${renewed} URLs renovadas`);
        return { renewed };
        
    } catch (error) {
        console.error('[RefreshAll] Error:', error.message);
        throw error;
    }
};
