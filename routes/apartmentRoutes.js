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

router.post('/addApartment', 
    authMiddleware,
    isLandlord,
    upload.array('images', 15),
    validateFiles,
    ApartmentController.addApartment
);

router.put('/update/:id_apt', 
    authMiddleware,
    isLandlord,
    upload.array('new_images', 15),
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