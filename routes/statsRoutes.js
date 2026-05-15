const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController'); // Importar el controlador de estadísticas
const authMiddleware = require('../middlewares/authMiddleware');



const isAdmin = (req, res, next) => {
    const userRole = req.user?.rol;
    if (req.user && (userRole === 3 || userRole === '3')) return next();
    return res.status(403).json({ success: false, error: 'Acceso denegado. Se requieren permisos de administrador' });
};

router.get('/get-user-top-apartment', authMiddleware, statsController.getUserTopApartment);
router.get('/get-top-landlord', statsController.getTopLandlord);
router.get('/admin', authMiddleware, isAdmin, statsController.getAdminStats);
router.get('/occupation-trend', authMiddleware, statsController.getOccupationTrend);
router.get('/revenue-by-zone', authMiddleware, statsController.getRevenueByZone);
router.get('/vacancy-rate', authMiddleware, statsController.getVacancyRate);
module.exports = router;