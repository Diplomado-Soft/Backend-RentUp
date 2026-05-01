const express = require('express');
const router = express.Router();
const { firebaseLogin, logout } = require('../controllers/authController');

router.post('/firebase-login', firebaseLogin);
router.post('/logout', logout);

module.exports = router;