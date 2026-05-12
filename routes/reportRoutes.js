const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
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

router.get('/monthly', authMiddleware, isAdmin, reportController.generateMonthlyReport);
router.get('/available', authMiddleware, isAdmin, reportController.getAvailableReports);

module.exports = router;