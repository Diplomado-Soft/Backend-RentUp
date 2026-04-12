const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Inicializar Firebase Admin SDK
let firebaseApp = null;
let initError = null;

const initializeFirebase = () => {
    // Si ya está inicializado, retornarlo
    if (firebaseApp) return firebaseApp;
    
    // Si hubo error previo, no reintentar
    if (initError) throw initError;

    try {
        // Leer el archivo de credenciales de Firebase desde la ruta especificada
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
            path.join(__dirname, '../certs/firebase-service-account.json');
        
        console.log(`Intentando cargar Firebase service account desde: ${serviceAccountPath}`);
        
        // Usar fs.readFileSync en lugar de require() para mejor control de errores
        if (!fs.existsSync(serviceAccountPath)) {
            throw new Error(`Service account file not found at: ${serviceAccountPath}`);
        }

        const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);

        if (!serviceAccount.project_id) {
            throw new Error('Invalid service account: missing project_id');
        }

        console.log(`Service Account Project ID: ${serviceAccount.project_id}`);

        // Inicializar Firebase Admin
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        console.log('Firebase Admin SDK inicializado correctamente');
        return firebaseApp;
    } catch (error) {
        console.error('Error inicializando Firebase Admin:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        initError = error;
        throw new Error(`Firebase initialization failed: ${error.message}`);
    }
};

/**
 * Verifica un Firebase ID Token
 * @param {string} token - Firebase ID Token
 * @returns {Promise<Object>} - Datos del usuario del token
 */
const verifyFirebaseToken = async (token) => {
    try {
        if (!token) {
            throw new Error('Token is empty or undefined');
        }

        console.log(`Verificando Firebase token (${token.substring(0, 20)}...)`);

        const app = initializeFirebase();
        const auth = admin.auth(app);
        
        // Intentar verificar el token con timeout
        const decodedToken = await Promise.race([
            auth.verifyIdToken(token),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Token verification timeout')), 10000)
            )
        ]);

        console.log(`Token verificado para usuario: ${decodedToken.email}`);
        return decodedToken;
    } catch (error) {
        console.error('Error verificando Firebase token:', {
            message: error.message,
            code: error.code,
            errorInfo: error.errorInfo
        });
        
        // Proporcionar mensajes de error más específicos
        if (error.code === 'auth/id-token-expired') {
            throw new Error('Firebase token has expired');
        } else if (error.code === 'auth/id-token-revoked') {
            throw new Error('Firebase token has been revoked');
        } else if (error.code === 'auth/invalid-id-token') {
            throw new Error('Invalid Firebase token format');
        } else if (error.message.includes('timeout')) {
            throw new Error('Firebase token verification timeout - possible connectivity issue');
        }
        
        throw new Error(`Firebase token verification failed: ${error.message}`);
    }
};

module.exports = {
    initializeFirebase,
    verifyFirebaseToken,
};
