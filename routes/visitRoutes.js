const express = require('express');
const router = express.Router();
const visitController = require('../controllers/visitController');
const authMiddleware = require('../middlewares/authMiddleware');
const isLandlord = require('../middlewares/isLandlord');

router.post('/schedule', authMiddleware, visitController.schedule);
router.get('/landlord', authMiddleware, isLandlord, visitController.getLandlordVisits);
router.get('/my', authMiddleware, visitController.getMyVisits);
router.put('/:id/confirm', authMiddleware, isLandlord, visitController.confirmVisit);
router.put('/:id/cancel', authMiddleware, visitController.cancelVisit);

module.exports = router;
