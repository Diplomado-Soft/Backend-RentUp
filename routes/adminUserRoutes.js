const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

// Middleware: Verificar que el usuario es admin
const isAdmin = (req, res, next) => {
    const userRole = req.user?.rol;
    if (req.user && (userRole === 3 || userRole === '3')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Se requieren permisos de administrador'
    });
};

// Todas las rutas requieren autenticación y rol de admin
router.use(authMiddleware, isAdmin);

// Obtener lista de usuarios
router.get('/', userController.getUsers);

// Bloquear usuario
router.put('/:id/block', userController.blockUser);

// Desbloquear usuario
router.put('/:id/unblock', userController.unblockUser);

module.exports = router;
