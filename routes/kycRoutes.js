const express = require('express');
const router = express.Router();
const KycController = require('../controllers/kycController');
const authMiddleware = require('../middlewares/authMiddleware');
const isLandlord = require('../middlewares/isLandlord');
const { upload, processKycDocuments } = require('../middlewares/kycUpload');

const isAdmin = (req, res, next) => {
    const userRole = req.user?.rol;
    if (req.user && (userRole === 3 || userRole === '3')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Se requieren permisos de administrador'
    });
};

router.post('/upload',
    authMiddleware,
    isLandlord,
    upload.fields([
        { name: 'id_document', maxCount: 1 },
        { name: 'property_certificate', maxCount: 1 }
    ]),
    processKycDocuments,
    KycController.uploadDocuments
);

router.get('/my-status',
    authMiddleware,
    KycController.getMyVerificationStatus
);

router.get('/pending',
    authMiddleware,
    isAdmin,
    KycController.getPendingVerifications
);

router.get('/all',
    authMiddleware,
    isAdmin,
    KycController.getAllVerifications
);

router.post('/:id/approve',
    authMiddleware,
    isAdmin,
    KycController.approveVerification
);

router.post('/:id/reject',
    authMiddleware,
    isAdmin,
    KycController.rejectVerification
);

module.exports = router;
