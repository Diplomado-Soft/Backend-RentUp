const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const visitController = require('../controllers/visitController');

router.post('/schedule', authMiddleware, visitController.schedule);
router.get('/my', authMiddleware, visitController.getMyVisits);
router.get('/landlord', authMiddleware, visitController.getLandlordVisits);
router.get('/occupied', authMiddleware, visitController.getOccupiedSlots);
router.put('/:id/confirm', authMiddleware, visitController.confirm);
router.put('/:id/cancel', authMiddleware, visitController.cancel);

module.exports = router;
