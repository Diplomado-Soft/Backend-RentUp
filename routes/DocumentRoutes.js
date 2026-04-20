const express = require('express');
const router = express.Router();

<<<<<<< HEAD
router.get('/', (req, res) => res.json({ message: 'Document routes placeholder' }));
router.post('/upload', (req, res) => res.json({ message: 'Upload placeholder' }));
=======
router.get('/', (req, res) => res.json({ message: 'Document routes' }));
router.post('/upload', (req, res) => res.json({ message: 'Upload endpoint' }));
>>>>>>> 33aea86 (feat: add latitude and longitude coordinates to apartment model #27)

module.exports = router;