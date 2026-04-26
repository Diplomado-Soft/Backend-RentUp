const jwt = require('jsonwebtoken');
const { verifyToken } = require('../utils/auth');

module.exports = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('ℹ️ No se proporcionó un token válido');
            return res.status(401).json({ error: 'No se proporcionó un token válido' });
        }

        const token = authHeader.split(' ')[1];
        console.log('🔐 Verificando token...');

        // Verifica el token
        const decoded = verifyToken(token);

        // Si la verificación falla
        if (!decoded) {
            console.log('❌ Token inválido o expirado');
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }

        // ✅ El token contiene: { id, rol, iat, exp }
        // Guardar los datos del usuario decodificados del JWT
        req.user = {
            id: decoded.id,
            rol: decoded.rol,
            userId: decoded.id
        };
        
        console.log('✅ Token verificado exitosamente', {
            userId: req.user.id,
            userRole: req.user.rol,
            decodedPayload: decoded
        });
        
        next();
    } catch (error) {
        console.error('❌ Error en authMiddleware:', error.message);
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expirado' });
        }
        res.status(401).json({ error: 'Token inválido' });
    }
};
