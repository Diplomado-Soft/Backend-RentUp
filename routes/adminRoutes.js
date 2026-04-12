const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../utils/auth'); // Usando la librería que instalamos

// Rutas protegidas
router.get('/users', verifyToken, adminController.getAllUsers);
router.patch('/users/:id/status', verifyToken, adminController.toggleUserStatus);

module.exports = router;