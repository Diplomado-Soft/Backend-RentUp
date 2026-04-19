const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ message: 'Document routes placeholder' }));
router.post('/upload', (req, res) => res.json({ message: 'Upload placeholder' }));

module.exports = router;