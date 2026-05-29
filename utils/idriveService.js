const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: generateSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
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
        console.log(`✅ Imagen subida a IDrive e2: ${key}`);

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
        console.error('❌ Error al subir imagen a IDrive e2:', error.message);
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

        console.log(`✅ URL firmada generada para: ${key}`);

        return {
            signedUrl,
            expiresAt
        };
    } catch (error) {
        console.error('❌ Error al generar URL firmada:', error.message);
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

        console.log(`✅ Imagen eliminada de IDrive e2: ${key}`);
    } catch (error) {
        console.error('❌ Error al eliminar imagen de IDrive e2:', error.message);
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
/**
 * Subir documento (PDF/imagen) a IDrive e2 para KYC
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} userId - ID del usuario
 * @param {string} docType - Tipo de documento ('id_document')
 * @param {string} originalName - Nombre original del archivo
 * @param {string} mimeType - Tipo MIME del archivo
 * @returns {Promise<{key: string, signedUrl: string, expiresAt: Date}>}
 */
exports.uploadDocument = async (fileBuffer, userId, docType, originalName, mimeType) => {
    try {
        const timestamp = Date.now();
        const randomString = Math.round(Math.random() * 1E9);
        const ext = originalName.split('.').pop() || 'pdf';
        const key = `kyc/${userId}/${docType}/${timestamp}-${randomString}.${ext}`;

        const uploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType,
            Metadata: {
                'user-id': userId.toString(),
                'doc-type': docType,
                'original-name': originalName
            }
        });

        await s3Client.send(uploadCommand);
        console.log(`✅ Documento subido a IDrive e2: ${key}`);

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
        console.error('❌ Error al subir documento a IDrive e2:', error.message);
        throw new Error(`Error al subir documento: ${error.message}`);
    }
};

/**
 * Eliminar imagen de IDrive e2 usando la URL firmada
 * @param {string} imageUrl - URL firmada de la imagen
 */
exports.deleteImageByUrl = async (imageUrl) => {
    if (!imageUrl) return;
    try {
        const key = imageUrl.split(`${BUCKET_NAME}/`)[1]?.split('?')[0];
        if (!key) {
            console.warn('No se pudo extraer la key de la URL:', imageUrl);
            return;
        }
        await exports.deleteImage(key);
    } catch (error) {
        console.error('Error al eliminar imagen por URL:', error.message);
    }
};

/**
 * Subir firma como PNG a IDrive e2
 * @param {number} agreement_id - ID del contrato
 * @param {'tenant'|'landlord'} role - Rol del firmante
 * @param {string} base64 - Datos base64 de la firma (data:image/png;base64,...)
 * @returns {Promise<string>} - Key del objeto en S3
 */
exports.uploadSignature = async (agreement_id, role, base64) => {
    const raw = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    const timestamp = Date.now();
    const key = `signatures/${agreement_id}/${role}_${timestamp}.png`;

    const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
        Metadata: {
            'agreement-id': agreement_id.toString(),
            'signer-role': role
        }
    });

    await s3Client.send(uploadCommand);
    console.log(`✅ Firma subida a IDrive e2: ${key}`);
    return key;
};

/**
 * Obtener firma como base64 desde IDrive e2
 * @param {string} key - Key del objeto en S3
 * @returns {Promise<string|null>} - base64 data URI o null si no existe
 */
exports.getSignatureBase64 = async (key) => {
    if (!key) return null;
    try {
        const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const response = await s3Client.send(getCommand);
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error(`Error obteniendo firma de IDrive (${key}):`, error.message);
        return null;
    }
};

exports.uploadSignedPdf = async (pdfBuffer, key) => {
    try {
        const uploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
            Metadata: {
                'upload-type': 'signed-contract'
            }
        });

        await s3Client.send(uploadCommand);
        console.log(`Signed PDF uploaded to IDrive e2: ${key}`);
        return { key };
    } catch (error) {
        console.error('Error uploading signed PDF:', error.message);
        throw new Error(`Error al subir PDF firmado: ${error.message}`);
    }
};

exports.uploadReceipt = async (pdfBuffer, paymentId) => {
    const key = `receipts/${paymentId}.pdf`;

    const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
            'payment-id': paymentId.toString(),
            'upload-type': 'receipt'
        }
    });

    await s3Client.send(uploadCommand);
    console.log(`✅ Recibo subido a IDrive e2: ${key}`);
    return key;
};

exports.getSignedPdfUrl = async (key) => {
    try {
        const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const signedUrl = await generateSignedUrl(s3Client, getCommand, {
            expiresIn: URL_EXPIRATION
        });

        const expiresAt = new Date(Date.now() + URL_EXPIRATION * 1000);

        return { signedUrl, expiresAt };
    } catch (error) {
        console.error('Error getting signed PDF URL:', error.message);
        return null;
    }
};

exports.testConnection = async () => {
    try {
        const headCommand = new HeadBucketCommand({ 
            Bucket: BUCKET_NAME 
        });
        await s3Client.send(headCommand);
        console.log('✅ Conexión a IDrive e2 establecida correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error al conectar a IDrive e2:', error.message);
        return false;
    }
};
