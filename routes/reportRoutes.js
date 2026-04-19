const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/monthly', authMiddleware, reportController.generateMonthlyReport);
router.get('/download/:year/:month', authMiddleware, reportController.downloadReport);
router.get('/available', authMiddleware, reportController.getAvailableReports);

module.exports = router;