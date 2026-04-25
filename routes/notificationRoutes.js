const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ message: 'Notification routes placeholder' }));
router.post('/send', (req, res) => res.json({ message: 'Send notification placeholder' }));

module.exports = router;