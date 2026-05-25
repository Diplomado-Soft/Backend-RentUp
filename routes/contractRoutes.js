const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const authMiddleware = require('../middlewares/authMiddleware');
const isLandlord = require('../middlewares/isLandlord');

router.post('/', authMiddleware, isLandlord, contractController.createContract);
router.get('/my', authMiddleware, contractController.getMyContracts);
router.get('/my-contracts', authMiddleware, contractController.getMyContracts);
router.get('/landlord/contracts', authMiddleware, isLandlord, contractController.getLandlordContracts);
router.get('/landlord/available-apartments', authMiddleware, isLandlord, contractController.getAvailableApartments);
router.get('/search-tenants', authMiddleware, contractController.searchTenants);
router.post('/expire-old', contractController.expireOldContracts);
router.get('/:agreement_id', authMiddleware, contractController.getContractById);
router.get('/:agreement_id/pdf', authMiddleware, contractController.getContractPdf);
router.put('/:agreement_id/status', authMiddleware, contractController.updateContractStatus);
router.get('/stats/monthly', authMiddleware, contractController.getMonthlyStats);
router.put('/:agreement_id/sign', authMiddleware, contractController.signContract);
router.post('/:agreement_id/renew', authMiddleware, contractController.renewContract);
router.post('/:agreement_id/end', authMiddleware, contractController.endAndMakeAvailable);
router.put('/:agreement_id/sign', authMiddleware, contractController.signContract);
router.get('/:agreement_id/pdf', (req, res, next) => {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    if (token && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${token}`;
    }
    authMiddleware(req, res, next);
}, contractController.getContractPdf);

module.exports = router;