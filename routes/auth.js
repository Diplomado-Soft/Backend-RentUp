const express = require('express');
const router = express.Router();

<<<<<<< HEAD
router.post('/login', (req, res) => res.json({ message: 'Login placeholder' }));
router.post('/register', (req, res) => res.json({ message: 'Register placeholder' }));
router.post('/refresh', (req, res) => res.json({ message: 'Refresh placeholder' }));
router.post('/google', (req, res) => res.json({ message: 'Google placeholder' }));
=======
router.post('/google', (req, res) => res.json({ message: 'Google auth' }));
router.post('/login', (req, res) => res.json({ message: 'Login' }));
>>>>>>> 33aea86 (feat: add latitude and longitude coordinates to apartment model #27)

module.exports = router;