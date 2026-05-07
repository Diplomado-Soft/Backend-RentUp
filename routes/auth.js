const express = require('express');
const router = express.Router();
const { verifyToken, generateAccessToken } = require('../utils/auth');
const { firebaseLogin, githubRedirect, githubCallback, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { RefreshTokenDTO } = require('../dtos');

// Firebase Google Sign-In: recibe Firebase token y devuelve JWT de la app
router.post('/firebase-login', firebaseLogin);
router.post('/login', firebaseLogin);
router.post('/google', firebaseLogin);

// Register: not implemented
router.post('/register', (req, res) => {
    res.status(501).json({ error: 'Not implemented' });
});

// GitHub OAuth: deprecated (kept for backwards compatibility)
router.get('/github', githubRedirect);
router.get('/github/callback', githubCallback);

// Renovar access token con refresh token
router.post('/refresh-token', (req, res) => {
    // Usar RefreshTokenDTO para validación
    const refreshDTO = new RefreshTokenDTO(req.body);
    const validation = refreshDTO.validate();
    
    if (!validation.isValid) {
        return res.status(401).json({ 
            error: 'Token de refresco inválido', 
            errors: validation.errors 
        });
    }
    
    const { refreshToken } = refreshDTO;
    
    try {
        const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccesToken = generateAccessToken({ id: decoded.id, role: decoded.role });
        res.json({ accessToken: newAccesToken });
    } catch (error) {
        console.error('Error refrescando token:', error);
        res.status(401).json({ error: 'Token de refresco inválido o expirado' });
    }
});

// Alias para /refresh
router.post('/refresh', (req, res) => {
    // Usar RefreshTokenDTO para validación
    const refreshDTO = new RefreshTokenDTO(req.body);
    const validation = refreshDTO.validate();
    
    if (!validation.isValid) {
        return res.status(401).json({ 
            error: 'Token de refresco inválido', 
            errors: validation.errors 
        });
    }
    
    const { refreshToken } = refreshDTO;
    
    try {
        const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccesToken = generateAccessToken({ id: decoded.id, role: decoded.role });
        res.json({ accessToken: newAccesToken });
    } catch (error) {
        console.error('Error refrescando token:', error);
        res.status(401).json({ error: 'Token de refresco inválido o expirado' });
    }
});

router.post('/logout', logout);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;