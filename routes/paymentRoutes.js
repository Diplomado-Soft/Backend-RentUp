const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/create-intent', authMiddleware, paymentController.createPaymentIntent);
router.post('/confirm', authMiddleware, paymentController.confirmPayment);
router.get('/history', authMiddleware, paymentController.getPaymentHistory);
router.get('/stats', authMiddleware, paymentController.getPaymentStats);
router.get('/receipt/:payment_id', authMiddleware, paymentController.downloadReceipt);
router.get('/agreement/:agreement_id', authMiddleware, paymentController.getPaymentsByAgreement);
router.post('/create-paypal-order', authMiddleware, paymentController.createPayPalOrder);
router.post('/capture-paypal-order', authMiddleware, paymentController.capturePayPalOrder);
router.post('/manual', authMiddleware, paymentController.registerManualPayment);

module.exports = router;
