const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => res.json({ message: 'Login placeholder' }));
router.post('/register', (req, res) => res.json({ message: 'Register placeholder' }));
router.post('/refresh', (req, res) => res.json({ message: 'Refresh placeholder' }));
router.post('/google', (req, res) => res.json({ message: 'Google placeholder' }));

module.exports = router;