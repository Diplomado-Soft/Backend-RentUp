const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const authMiddleware = require('../middlewares/authMiddleware');
const { upload } = require('../middlewares/fileUpload');

router.post('/create', authMiddleware, upload.single('image'), maintenanceController.createReport);
router.get('/my-reports', authMiddleware, maintenanceController.getMyReports);
router.get('/my-properties', authMiddleware, maintenanceController.getMyProperties);
router.get('/landlord', authMiddleware, maintenanceController.getLandlordReports);
router.get('/property/:id', authMiddleware, maintenanceController.getPropertyReports);
router.put('/:id/status', authMiddleware, maintenanceController.updateStatus);
router.delete('/:id', authMiddleware, maintenanceController.deleteReport);

module.exports = router;
