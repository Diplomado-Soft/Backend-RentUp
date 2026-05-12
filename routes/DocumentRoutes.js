const express = require('express');
const router = express.Router();
const DocumentController = require('../controllers/DocumentController');
const authMiddleware = require('../middlewares/authMiddleware');

// Endpoint para generar un documento PDF de un apartamento
router.get('/apartments/:id/document/pdf', authMiddleware, DocumentController.generatePDF);

// Endpoint para generar un documento Excel de un apartamento
router.get('/apartments/:id/document/excel', authMiddleware, DocumentController.generateExcel);

module.exports = router;