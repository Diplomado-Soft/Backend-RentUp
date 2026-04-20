const express = require('express');
const router = express.Router();

<<<<<<< HEAD
router.get('/', (req, res) => res.json({ message: 'Notification routes placeholder' }));
router.post('/send', (req, res) => res.json({ message: 'Send notification placeholder' }));
=======
router.get('/', (req, res) => res.json({ message: 'Notification routes' }));
>>>>>>> 33aea86 (feat: add latitude and longitude coordinates to apartment model #27)

module.exports = router;