const express = require('express');
const router = express.Router();
const { verifyToken, generateAccessToken, generateRefreshToken } = require('../utils/auth');
const { firebaseLogin, githubRedirect, githubCallback, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { RefreshTokenDTO } = require('../dtos');
const { signup } = require('../controllers/userController');

// Firebase Google Sign-In: recibe Firebase token y devuelve JWT de la app
router.post('/firebase-login', firebaseLogin);
// NOTA: /auth/login es alias de firebaseLogin para clientes que usan Google SSO
// El login por email+password está en /users/login (userRoutes.js)
router.post('/login', firebaseLogin);
router.post('/google', firebaseLogin);

// Register: redirige al controlador de signup
router.post('/register', signup);

// GitHub OAuth: deprecated (kept for backwards compatibility)
router.get('/github', githubRedirect);
router.get('/github/callback', githubCallback);

router.post('/refresh-token', (req, res) => {
    const refreshDTO = new RefreshTokenDTO(req.body);
    const validation = refreshDTO.validate();
    if (!validation.isValid) {
        return res.status(401).json({ error: 'Token de refresco inválido', errors: validation.errors });
    }
    
    try {
        const decoded = verifyToken(refreshDTO.refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccesToken = generateAccessToken({ id: decoded.id, rol: decoded.rol });
        const newRefreshToken = generateRefreshToken({ id: decoded.id, rol: decoded.rol });
        res.json({ accessToken: newAccesToken, refreshToken: newRefreshToken });
    } catch (error) {
        res.status(401).json({ error: 'Token de refresco inválido o expirado' });
    }
});

router.post('/refresh', (req, res) => {
    const refreshDTO = new RefreshTokenDTO(req.body);
    const validation = refreshDTO.validate();
    if (!validation.isValid) {
        return res.status(401).json({ error: 'Token de refresco inválido', errors: validation.errors });
    }
    
    try {
        const decoded = verifyToken(refreshDTO.refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccesToken = generateAccessToken({ id: decoded.id, rol: decoded.rol });
        const newRefreshToken = generateRefreshToken({ id: decoded.id, rol: decoded.rol });
        res.json({ accessToken: newAccesToken, refreshToken: newRefreshToken });
    } catch (error) {
        res.status(401).json({ error: 'Token de refresco inválido o expirado' });
    }
});

router.post('/logout', logout);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;