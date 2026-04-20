const express = require('express');
const router = express.Router();

<<<<<<< HEAD
router.get('/', (req, res) => res.json({ message: 'Contract routes placeholder' }));
router.post('/', (req, res) => res.json({ message: 'Create contract placeholder' }));
router.get('/:id', (req, res) => res.json({ message: 'Get contract placeholder' }));
=======
router.get('/', (req, res) => res.json({ message: 'Contract routes' }));
router.post('/create', (req, res) => res.json({ message: 'Create contract' }));
>>>>>>> 33aea86 (feat: add latitude and longitude coordinates to apartment model #27)

module.exports = router;