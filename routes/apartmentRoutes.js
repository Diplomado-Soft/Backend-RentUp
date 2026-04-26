const express = require('express');
const router = express.Router();
const { upload, validateFiles } = require('../middlewares/fileUpload');
const ApartmentController = require('../controllers/apartmentController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rutas con middlewares aplicados
router.post('/uploadImage/:id_apt', 
    authMiddleware,
    upload.array('images'),
    validateFiles,
    ApartmentController.uploadImage
);

router.post('/addApartment', 
    authMiddleware,
    upload.array('images'),
    validateFiles,
    ApartmentController.addApartment
);

router.put('/update/:id_apt', 
    authMiddleware,
    upload.array("new_images"),
    validateFiles,
    ApartmentController.updateApartment
);

// Rutas sin manejo de archivos
router.get('/manage', 
    authMiddleware,
    ApartmentController.getApartmentsByLessor
);
router.delete('/delete/:id_apt', 
    authMiddleware,
    ApartmentController.deleteApartment
);
router.get('/getapts', ApartmentController.getAllApartments);
router.get('/getFiltered', ApartmentController.getApartmentsFiltered);
router.get('/getMarkersInfo', ApartmentController.getMarkersInfo);
<<<<<<< HEAD
=======
router.get('/:id', ApartmentController.getApartmentById);
>>>>>>> ca6300ea2952765ab65be92a35fe9e8c9b7ad2e0

module.exports = router;