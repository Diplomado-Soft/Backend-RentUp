const express = require('express');
const router = express.Router();
const Contract = require('../models/ContractModel');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', (req, res) => res.json({ message: 'Contract routes placeholder' }));

router.post('/', (req, res) => res.json({ message: 'Create contract placeholder' }));

router.get('/:id', (req, res) => res.json({ message: 'Get contract placeholder' }));

router.get('/landlord/contracts', authMiddleware, async (req, res) => {
    try {
        const landlordId = req.user.id;
        const contracts = await Contract.getByLandlord(landlordId);
        res.json(contracts);
    } catch (error) {
        console.error('Error fetching contracts:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/landlord/available-apartments', authMiddleware, async (req, res) => {
    try {
        const landlordId = req.user.id;
        const apartments = await Contract.getAvailableApartments(landlordId);
        res.json(apartments);
    } catch (error) {
        console.error('Error fetching available apartments:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;