const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, contractController.createContract);
router.get('/my', authMiddleware, contractController.getMyContracts);
router.get('/landlord/contracts', authMiddleware, contractController.getLandlordContracts);
router.get('/landlord/available-apartments', authMiddleware, contractController.getAvailableApartments);
router.get('/search-tenants', authMiddleware, contractController.searchTenants);
router.post('/expire-old', contractController.expireOldContracts);
router.get('/:agreement_id', authMiddleware, contractController.getContractById);
router.put('/:agreement_id/status', authMiddleware, contractController.updateContractStatus);
router.get('/stats/monthly', authMiddleware, contractController.getMonthlyStats);

module.exports = router;