// server/routes/userRoutes.js

// Importación de módulos necesarios
const express = require('express'); 
const router = express.Router(); 
const userController = require('../controllers/userController'); 
const authMiddleware = require('../middlewares/authMiddleware'); 

/**
 * RUTAS PÚBLICAS
 * No requieren token (Auth)
 */
// Registro de nuevos usuarios (Inquilinos/Arrendadores)
router.post('/signup', userController.signup);
// Inicio de sesión tradicional
router.post('/login', userController.login);

/**
 * RUTAS PROTEGIDAS
 * Requieren token JWT válido a través de authMiddleware
 */

// Obtener el perfil del usuario autenticado (Suele usarse /profile o /me)
router.get('/profile', authMiddleware, userController.getUserData);

// Actualizar datos generales del perfil (Nombre, Email, Password)
router.put('/update', authMiddleware, userController.updateUserData);

// Sprint 4 - T-20: Actualizar específicamente número de WhatsApp y teléfono
router.put('/update-whatsapp', authMiddleware, userController.updateWhatsApp);

// Eliminar cuenta de usuario y sus roles asociados
router.delete('/delete-account', authMiddleware, userController.deleteAccount);

// Exportación del router para usarlo en la aplicación principal (app.js o server.js)
module.exports = router;