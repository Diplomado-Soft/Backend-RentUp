const admin = require('firebase-admin');
const serviceAccount = require('../certs/firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK inicializado correctamente');
}

const verifyFirebaseToken = async (idToken) => {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log('✅ Firebase token verificado:', decodedToken.email);
        return decodedToken;
    } catch (error) {
        console.error('❌ Error verificando Firebase token:', error.message);
        throw error;
    }
};

const revokeFirebaseToken = async (uid) => {
    try {
        await admin.auth().revokeRefreshTokens(uid);
        console.log('Tokens revocados para UID:', uid);
        return true;
    } catch (error) {
        console.error('Error revocando tokens:', error.message);
        throw error;
    }
};

module.exports = { verifyFirebaseToken, revokeFirebaseToken };

