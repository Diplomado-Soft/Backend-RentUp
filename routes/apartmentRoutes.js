const express = require('express');
const router = express.Router();
const { upload, validateFiles } = require('../middlewares/fileUpload');
const ApartmentController = require('../controllers/apartmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const isLandlord = require('../middlewares/isLandlord');

// Rutas con middlewares aplicados
router.post('/uploadImage/:id_apt', 
    authMiddleware,
    isLandlord,
    upload.array('images'),
    validateFiles,
    ApartmentController.uploadImage
);

const kycFileFields = [
    { name: 'images', maxCount: 10 },
    { name: 'id_document', maxCount: 1 },
    { name: 'property_certificate', maxCount: 1 }
];

router.post('/addApartment', 
    authMiddleware,
    isLandlord,
    (req, res, next) => {
        console.log('🔍 DEBUG Route - Body:', req.body);
        next();
    },
    upload.fields(kycFileFields),
    (req, res, next) => {
        const imageCount = req.files?.images?.length || 0;
        const kycCount = (req.files?.id_document?.length || 0) + (req.files?.property_certificate?.length || 0);
        console.log(`🔍 DEBUG After upload - Imágenes: ${imageCount}, KYC: ${kycCount}`);
        next();
    },
    validateFiles,
    (req, res, next) => {
        console.log('🔍 DEBUG After validateFiles - processedFiles:', req.processedFiles?.length || 0, '| kycDocuments:', Object.keys(req.kycDocuments || {}));
        next();
    },
    ApartmentController.addApartment
);

router.put('/update/:id_apt', 
    authMiddleware,
    isLandlord,
    upload.fields([
        { name: 'new_images', maxCount: 10 },
        { name: 'id_document', maxCount: 1 },
        { name: 'property_certificate', maxCount: 1 }
    ]),
    validateFiles,
    ApartmentController.updateApartment
);

// Rutas sin manejo de archivos
router.get('/manage', 
    authMiddleware,
    isLandlord,
    ApartmentController.getApartmentsByLessor
);
router.delete('/delete/:id_apt', 
    authMiddleware,
    isLandlord,
    ApartmentController.deleteApartment
);
router.get('/getapts', ApartmentController.getAllApartments);
router.get('/getFiltered', ApartmentController.getApartmentsFiltered);
router.get('/getMarkersInfo', ApartmentController.getMarkersInfo);
router.get('/:id', ApartmentController.getApartmentById);

module.exports = router;