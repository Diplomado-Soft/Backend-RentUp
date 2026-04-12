// Importación de módulos necesarios
const express = require('express'); // Framework para manejar rutas y peticiones HTTP
const router = express.Router(); // Router para agrupar y manejar rutas
const userController = require('../controllers/userController'); // Controlador para manejar la lógica de los arrendadores
const authController = require('../controllers/authController'); // Controlador para auth Google Firebase
const authMiddleware = require('../middlewares/authMiddleware'); // Middleware para manejar autenticación

router.post('/signup', userController.signup);
router.post('/login', userController.login);
router.put('/update', authMiddleware, userController.updateUserData);
router.put('/update-whatsapp', authMiddleware, userController.updateWhatsApp);
router.get('/getUser', authMiddleware, userController.getUserData);
router.delete('/delete-account', authMiddleware, userController.deleteAccount);

// Ruta Google Firebase Auth
router.post('/auth/firebase-login', authController.firebaseLogin);

// Exportación del router para usarlo en la aplicación principal
module.exports = router;
