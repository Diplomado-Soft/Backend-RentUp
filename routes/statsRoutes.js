const express = require('express');
const router = express.Router();

<<<<<<< HEAD
router.get('/', (req, res) => res.json({ stats: 'placeholder' }));
router.get('/dashboard', (req, res) => res.json({ dashboard: 'placeholder' }));
=======
router.get('/', (req, res) => res.json({ message: 'Stats routes' }));
>>>>>>> 33aea86 (feat: add latitude and longitude coordinates to apartment model #27)

module.exports = router;