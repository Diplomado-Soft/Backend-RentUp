const express = require('express');
const router = express.Router();
const AdminApartmentController = require('../controllers/AdminApartmentController');
const authMiddleware = require('../middlewares/authMiddleware');

// Middleware: Verificar que el usuario es admin
const isAdmin = (req, res, next) => {
    console.log('🔍 isAdmin check - req.user:', req.user);
    const userRole = req.user?.rol;
    console.log('🔍 isAdmin check - userRole:', userRole, 'type:', typeof userRole);
    
    //兼容字符串和数字类型的rol比较
    if (req.user && (userRole === 3 || userRole === '3')) {
        console.log('✅ Admin check passed');
        return next();
    }
    console.log('❌ Admin check failed - no admin role');
    return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Se requieren permisos de administrador'
    });
};

// Todas las rutas requieren autenticación y rol de admin
router.use(authMiddleware, isAdmin);

// Obtener apartamentos pendientes de aprobación
router.get('/pending', AdminApartmentController.getPendingApartments);

// Obtener estado de publicación de un apartamento
router.get('/:id_apt/status', AdminApartmentController.getPublicationStatus);

// Obtener historial de aprobación de un apartamento
router.get('/:id_apt/history', AdminApartmentController.getApprovalHistory);

// Aprobar apartamento
router.post('/:id_apt/approve', AdminApartmentController.approveApartment);

// Rechazar apartamento
router.post('/:id_apt/reject', AdminApartmentController.rejectApartment);

module.exports = router;
