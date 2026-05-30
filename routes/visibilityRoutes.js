const express = require('express');
const router = express.Router();
const visibilityController = require('../controllers/visibilityController');
const authMiddleware = require('../middlewares/authMiddleware');

router.put('/:type/:id/hide', authMiddleware, visibilityController.hide);

module.exports = router;
