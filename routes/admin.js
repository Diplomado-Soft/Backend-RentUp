const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
// Aquí importarías el middleware de JWT que ya tiene el proyecto
const verifyToken = require('../middleware/verifyToken'); 

router.get('/users', verifyToken, adminController.getUsers);
router.patch('/users/:id/status', verifyToken, adminController.updateUserStatus);

module.exports = router;