const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ stats: 'placeholder' }));
router.get('/dashboard', (req, res) => res.json({ dashboard: 'placeholder' }));

module.exports = router;