const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/',            authMiddleware, notificationController.getNotifications);
router.put('/read-all',    authMiddleware, notificationController.markAllRead);
router.put('/:id/read',    authMiddleware, notificationController.markRead);
router.delete('/:id',      authMiddleware, notificationController.deleteNotification);

module.exports = router;
