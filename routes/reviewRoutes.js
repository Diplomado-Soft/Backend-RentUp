const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/ReviewController');
const authMiddleware = require('../middlewares/authMiddleware');
const Contract = require('../models/ContractModel');

/**
 * Sprint 2 - Reviews API Routes
 * T-11: Endpoint POST /reviews
 * T-12: Listado y promedio de reseñas
 * T-13: Análisis de sentimiento y moderación
 */

// Rutas públicas (obtener reseñas)
router.get('/property/:property_id', reviewController.getPropertyReviews);
router.get('/property/:property_id/stats', reviewController.getReviewStats);
router.get('/property/:property_id/sentiment', reviewController.getPropertySentimentStats);
router.get('/:review_id', reviewController.getReview);

// Rutas protegidas de usuario
router.get('/user/my-reviews', authMiddleware, reviewController.getUserReviews);

// Rutas protegidas de arrendador
router.get('/landlord/my-reviews', authMiddleware, reviewController.getLandlordReviews);

// Verificar si el usuario puede reseñar una propiedad (tiene contrato)
router.get('/can-review/:property_id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user.user_id;
    const { property_id } = req.params;
    
    // Verificar si tiene contrato
    const contract = await Contract.hasUserRentedProperty(userId, property_id);
    
    // Verificar si ya reseñó
    const hasReviewed = await require('../models/ReviewModel').hasUserReviewedProperty(userId, property_id);
    
    res.json({
      success: true,
      canReview: !!contract && !hasReviewed,
      hasContract: !!contract,
      hasReviewed,
      contractStatus: contract ? contract.status : null
    });
  } catch (error) {
    console.error('Error verificando permiso de reseña:', error);
    res.status(500).json({ error: 'Error al verificar permiso' });
  }
});

// Rutas protegidas (crear/actualizar/eliminar reseñas - requiere autenticación)
router.post('/', authMiddleware, reviewController.createReview);
router.put('/:review_id', authMiddleware, reviewController.updateReview);
router.delete('/:review_id', authMiddleware, reviewController.deleteReview);

// ===== T-13: Rutas de moderación y análisis de sentimiento (solo admins) =====
router.get('/admin/flagged', authMiddleware, reviewController.getFlaggedReviews);
router.get('/admin/:review_id/history', authMiddleware, reviewController.getModerationHistory);
router.get('/admin/ai/health', authMiddleware, reviewController.checkAIHealth);
router.post('/admin/:review_id/approve', authMiddleware, reviewController.approveReview);
router.post('/admin/:review_id/reject', authMiddleware, reviewController.rejectReview);
router.post('/admin/analyze/batch', authMiddleware, reviewController.analyzeBatch);
router.post('/admin/analyze-pending', authMiddleware, reviewController.analyzePendingReviews);

module.exports = router;
