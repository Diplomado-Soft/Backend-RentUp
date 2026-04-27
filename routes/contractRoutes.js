const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', (req, res) => res.json({ message: 'Contract routes placeholder' }));

router.post('/', authMiddleware, contractController.createContract);

router.get('/landlord/contracts', authMiddleware, contractController.getLandlordContracts);

router.get('/landlord/available-apartments', authMiddleware, contractController.getAvailableApartments);

router.get('/search-tenants', authMiddleware, contractController.searchTenants);

router.get('/my-contracts', authMiddleware, contractController.getMyContracts);

router.get('/:id_contract', authMiddleware, contractController.getContractById);

router.put('/:id_contract/status', authMiddleware, contractController.updateContractStatus);

router.get('/stats/monthly', authMiddleware, contractController.getMonthlyStats);

router.post('/expire-old', authMiddleware, contractController.expireOldContracts);

module.exports = router;