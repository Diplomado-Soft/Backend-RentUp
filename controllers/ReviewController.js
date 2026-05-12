const Review = require('../models/ReviewModel');
const AIAnalysisService = require('../utils/aiAnalysisService');
const Notification = require('../models/NotificationModel');
const Contract = require('../models/ContractModel');
const { CreateReviewDTO, UpdateReviewDTO, ReviewDTO } = require('../dtos');

/**
 * POST /reviews - Crear una nueva reseña
 */
exports.createReview = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const reviewer_id = req.user.id || req.user.user_id; // Usuario autenticado

    // Usar CreateReviewDTO para validación
    const reviewDTO = new CreateReviewDTO({
      ...req.body,
      reviewer_id
    });

    const validation = reviewDTO.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Datos de reseña inválidos',
        details: validation.errors
      });
    }

    const dtoData = reviewDTO.toDatabaseFormat();

    // Verificar si el usuario ya ha reseñado esta propiedad
    const hasReviewed = await Review.userHasReviewForProperty(reviewer_id, dtoData.property_id);
    if (hasReviewed) {
      return res.status(409).json({
        error: 'Ya has reseñado esta propiedad'
      });
    }

    // Verificar si el usuario tiene un contrato con la propiedad
    const contract = await Contract.hasUserRentedProperty(reviewer_id, dtoData.property_id);
    
    let verified_booking = false;
    if (contract) {
      verified_booking = true;
      console.log(`✅ Usuario ${reviewer_id} tiene contrato ${contract.status} con propiedad ${dtoData.property_id}`);
    } else {
      console.log(`⚠️ Usuario ${reviewer_id} NO tiene contrato con propiedad ${dtoData.property_id}`);
    }

    const review = await Review.createReview({
      ...dtoData,
      verified_booking
    });

    // ===== T-13: Análisis de sentimiento con IA (Asincrónico) =====
    const { comment: reviewComment, rating: reviewRating } = dtoData;
    (async () => {
      try {
        console.log(`[T-13] Analizando sentimiento para review ${review.review_id}...`);
        const analysis = await AIAnalysisService.processReviewAnalysis(
          reviewComment || '',
          reviewRating
        );

        await Review.updateSentimentAnalysis(review.review_id, {
          sentiment: analysis.sentiment?.sentiment || 'neutral',
          sentiment_score: analysis.sentiment?.score || 3,
          moderation_flag: analysis.moderation?.requires_moderation || false,
          flag_reason: analysis.moderation?.reason || null,
          analyzed_at: new Date()
        });

        if (analysis.moderation?.requires_moderation) {
          await Review.logModerationAction(
            review.review_id,
            null,
            'ai_flagged',
            `IA Flags: ${analysis.moderation.flags.join(', ')} (${analysis.moderation.severity})`
          );
          const notificationDTO = new CreateNotificationDTO({
            user_id: 0,
            type: 'review_flagged',
            title: 'Reseña flaggeada por IA',
            message: `La IA detectó contenido en una reseña: ${analysis.moderation.reason || analysis.moderation.flags.join(', ')}`,
            reference_id: review.review_id,
            reference_type: 'review'
          });

          const notifValidation = notificationDTO.validate();
          if (notifValidation.isValid) {
            const dtoData = notificationDTO.toDatabaseFormat();
            delete dtoData.user_id;
            await Notification.createForAdmins(dtoData);
          }
          console.log(`[T-13] Review ${review.review_id} flagged: ${analysis.moderation.reason}`);
        } else {
          console.log(`[T-13] Review ${review.review_id} analizada - Sentimiento: ${analysis.sentiment?.sentiment}`);
        }
      } catch (analysisError) {
        console.error(`[T-13] Error analizando review ${review.review_id}:`, analysisError.message);
      }
    })();

    res.status(201).json({
      success: true,
      message: '¡Reseña creada exitosamente!',
      data: review
    });
  } catch (error) {
    console.error('Error creando reseña:', error);
    res.status(500).json({
      error: error.message || 'Error al crear reseña'
    });
  }
};

/**
 * GET /reviews/property/:property_id - Obtener reseñas de una propiedad
 */
exports.getPropertyReviews = async (req, res) => {
  try {
    const { property_id } = req.params;

    const reviews = await Review.getPropertyReviews(property_id);
    const stats = await Review.getPropertyReviewStats(property_id);

    // Usar ReviewDTO para formatear respuesta
    const formattedReviews = ReviewDTO.fromDatabaseList(reviews);

    res.json({
      success: true,
      reviews: formattedReviews,
      stats
    });
  } catch (error) {
    console.error('Error obteniendo reseñas:', error);
    res.status(500).json({
      error: error.message || 'Error al obtener reseñas'
    });
  }
};

/**
 * GET /reviews/:review_id - Obtener una reseña específica
 */
exports.getReview = async (req, res) => {
  try {
    const { review_id } = req.params;

    const review = await Review.getReviewById(review_id);

    if (!review) {
      return res.status(404).json({
        error: 'Reseña no encontrada'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error obteniendo reseña:', error);
    res.status(500).json({
      error: error.message || 'Error al obtener reseña'
    });
  }
};

/**
 * PUT /reviews/:review_id - Actualizar una reseña (solo el autor)
 */
exports.updateReview = async (req, res) => {
  try {
    const { review_id } = req.params;
    const user_id = req.user.id || req.user.user_id;

    // Verificar que la reseña existe y pertenece al usuario
    const review = await Review.getReviewById(review_id);

    if (!review) {
      return res.status(404).json({
        error: 'Reseña no encontrada'
      });
    }

    if (review.reviewer_id !== user_id) {
      return res.status(403).json({
        error: 'No tienes permisos para actualizar esta reseña'
      });
    }

    // Usar UpdateReviewDTO para validación
    const updateDTO = new UpdateReviewDTO(req.body);
    const validation = updateDTO.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Datos de actualización inválidos',
        details: validation.errors
      });
    }

    const dtoData = updateDTO.toDatabaseFormat();

    const updatedReview = await Review.updateReview(review_id, dtoData);

    res.json({
      success: true,
      message: 'Reseña actualizada exitosamente',
      data: updatedReview
    });
  } catch (error) {
    console.error('Error actualizando reseña:', error);
    res.status(500).json({
      error: error.message || 'Error al actualizar reseña'
    });
  }
};

/**
 * DELETE /reviews/:review_id - Eliminar una reseña (solo el autor o admin)
 */
exports.deleteReview = async (req, res) => {
  try {
    const { review_id } = req.params;
    const user_id = req.user.id || req.user.user_id;
    const user_role = req.user.rol_id || req.user.rolId;

    // Verificar que la reseña existe
    const review = await Review.getReviewById(review_id);

    if (!review) {
      return res.status(404).json({
        error: 'Reseña no encontrada'
      });
    }

    // Permitir eliminación si es el autor o admin
    if (review.reviewer_id !== user_id && user_role !== 3) {
      return res.status(403).json({
        error: 'No tienes permisos para eliminar esta reseña'
      });
    }

    const deleted = await Review.deleteReview(review_id);

    if (!deleted) {
      return res.status(500).json({
        error: 'No se pudo eliminar la reseña'
      });
    }

    res.json({
      success: true,
      message: 'Reseña eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando reseña:', error);
    res.status(500).json({
      error: error.message || 'Error al eliminar reseña'
    });
  }
};

/**
 * GET /reviews/property/:property_id/stats - Obtener estadísticas de reseñas
 */
exports.getReviewStats = async (req, res) => {
  try {
    const { property_id } = req.params;

    const stats = await Review.getPropertyReviewStats(property_id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: error.message || 'Error al obtener estadísticas'
    });
  }
};

// ===== T-13: MÉTODOS DE ANÁLISIS DE SENTIMIENTO =====

/**
 * GET /admin/reviews/flagged - Obtener reviews flagged para moderación
 */
exports.getFlaggedReviews = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const user_role = req.user.rol;

    console.log('=== getFlaggedReviews ===');
    console.log('req.user:', req.user);
    console.log('user_role:', user_role);

    // Solo admins
    if (user_role !== 3) {
      console.log('Acceso denegado - rol no es 3');
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Se requieren permisos de administrador'
      });
    }

    const result = await Review.getFlaggedReviews(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      reviews: result
    });
  } catch (error) {
    console.error('Error obteniendo reviews flagged:', error);
    res.status(500).json({
      error: error.message || 'Error al obtener reviews flagged'
    });
  }
};

/**
 * GET /reviews/property/:property_id/sentiment - Obtener estadísticas de sentimiento
 */
exports.getPropertySentimentStats = async (req, res) => {
  try {
    const { property_id } = req.params;

    const stats = await Review.getPropertySentimentStats(property_id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de sentimiento:', error);
    res.status(500).json({
      error: error.message || 'Error al obtener estadísticas de sentimiento'
    });
  }
};

/**
 * GET /admin/reviews/:review_id/history - Obtener historial de moderación
 */
exports.getModerationHistory = async (req, res) => {
  try {
    const { review_id } = req.params;
    const user_role = req.user.rol_id || req.user.userRole;

    // Solo admins
    if (user_role !== 3) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const history = await Review.getModerationHistory(review_id);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      error: error.message || 'Error al obtener historial'
    });
  }
};

/**
 * POST /admin/reviews/:review_id/approve - Aprobar una review flagged
 */
exports.approveReview = async (req, res) => {
  try {
    const { review_id } = req.params;
    const { notes = '' } = req.body;
    const admin_id = req.user.id || req.user.userId;
    const user_role = req.user.rol_id || req.user.userRole;

    // Solo admins
    if (user_role !== 3) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    // Actualizar para quitar flag
    await Review.updateSentimentAnalysis(review_id, {
      sentiment: 'neutral', // Mantener sentimiento
      sentiment_score: 0,
      moderation_flag: false,
      flag_reason: null
    });

    // Registrar acción
    await Review.logModerationAction(review_id, admin_id, 'approve', notes);

    console.log(`✅ Review ${review_id} aprobada por admin ${admin_id}`);

    res.json({
      success: true,
      message: 'Review aprobada correctamente'
    });
  } catch (error) {
    console.error('Error aprobando review:', error);
    res.status(500).json({
      error: error.message || 'Error al aprobar review'
    });
  }
};

/**
 * POST /admin/reviews/:review_id/reject - Rechazar/eliminar una review
 */
exports.rejectReview = async (req, res) => {
  try {
    const { review_id } = req.params;
    const { notes = 'Sin especificar' } = req.body;
    const admin_id = req.user.id || req.user.userId;
    const user_role = req.user.rol_id || req.user.userRole;

    // Solo admins
    if (user_role !== 3) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    if (!notes || notes.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un motivo para rechazar'
      });
    }

    // Registrar acción antes de eliminar
    await Review.logModerationAction(review_id, admin_id, 'reject', notes);

    // Eliminar la review
    const deleted = await Review.deleteReview(review_id);

    if (!deleted) {
      return res.status(500).json({
        error: 'No se pudo eliminar la review'
      });
    }

    console.log(`❌ Review ${review_id} rechazada por admin ${admin_id}. Motivo: ${notes}`);

    res.json({
      success: true,
      message: 'Review rechazada y eliminada correctamente'
    });
  } catch (error) {
    console.error('Error rechazando review:', error);
    res.status(500).json({
      error: error.message || 'Error al rechazar review'
    });
  }
};

/**
 * POST /admin/reviews/analyze-batch - Analizar reviews sin analizar con IA
 */
exports.analyzeBatch = async (req, res) => {
  try {
    const user_role = req.user.rol_id || req.user.userRole;

    if (user_role !== 3) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const aiHealth = await AIAnalysisService.isServiceRunning();
    if (!aiHealth) {
      return res.status(503).json({
        success: false,
        error: 'Servicio de IA no disponible. El modelo se cargará automáticamente.'
      });
    }

    const unanalyzedReviews = await Review.getUnanalyzedReviews(50);

    if (unanalyzedReviews.length === 0) {
      return res.json({
        success: true,
        message: 'No hay reviews sin analizar',
        analyzed: 0,
        flagged: 0
      });
    }

    console.log(`Iniciando análisis batch de ${unanalyzedReviews.length} reviews...`);

    let analyzed = 0;
    let flagged = 0;
    let errors = 0;

    for (const review of unanalyzedReviews) {
      try {
        const analysis = await AIAnalysisService.processReviewAnalysis(
          review.comment || '',
          review.rating
        );

        if (analysis.status === 'analyzed') {
          await Review.updateSentimentAnalysis(review.review_id, {
            sentiment: analysis.sentiment?.sentiment || 'neutral',
            sentiment_score: analysis.sentiment?.score || 3,
            moderation_flag: analysis.moderation?.requires_moderation || false,
            flag_reason: analysis.moderation?.reason || null,
            analyzed_at: new Date()
          });

          if (analysis.moderation?.requires_moderation) {
            await Review.logModerationAction(
              review.review_id,
              null,
              'ai_flagged',
              `IA Flags: ${analysis.moderation.flags.join(', ')}`
            );
            flagged++;
          }
          analyzed++;
        } else {
          errors++;
        }
      } catch (reviewError) {
        errors++;
        console.error(`Error analizando review ${review.review_id}:`, reviewError.message);
      }
    }

    console.log(`Batch completado: ${analyzed} analizadas, ${flagged} flagged, ${errors} errores`);

    res.json({
      success: true,
      message: `Análisis completado: ${analyzed} reviews procesadas`,
      analyzed,
      flagged,
      errors,
      total: unanalyzedReviews.length
    });
  } catch (error) {
    console.error('Error en análisis batch:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error en análisis batch'
    });
  }
};

/**
 * GET /admin/ai/health - Verificar estado del servicio de IA
 */
exports.checkAIHealth = async (req, res) => {
  try {
    const user_role = req.user.rol;

    console.log('checkAIHealth - user_role:', user_role);

    // Solo admins
    if (user_role !== 3) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const health = await AIAnalysisService.healthCheck();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error verificando salud de IA:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /reviews/user/my-reviews - Obtener las reseñas del usuario actual
 */
exports.getUserReviews = async (req, res) => {
  try {
    const userId = req.user.id || req.user.user_id;
    
    const reviews = await Review.getUserReviews(userId);
    
    res.json({
      success: true,
      reviews
    });
  } catch (error) {
    console.error('Error obteniendo reseñas del usuario:', error);
    res.status(500).json({
      error: error.message || 'Error al obtener tus reseñas'
    });
  }
};

/**
 * POST /reviews/admin/analyze-pending - Analizar reseñas pendientes con IA
 */
exports.analyzePendingReviews = async (req, res) => {
  try {
    const user_role = req.user?.rol;

    if (user_role !== 3) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Solo administradores.'
      });
    }

    const { analyzePendingReviews } = require('../services/sentimentAnalysis');
    
    const result = await analyzePendingReviews({
      batchSize: req.body.batchSize || 50,
      delay: req.body.delay || 1000
    });

    res.json(result);
  } catch (error) {
    console.error('Error en analyzePendingReviews:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /reviews/landlord/my-reviews - Obtener todas las reseñas de los apartamentos del arrendador
 */
exports.getLandlordReviews = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.rol;

    if (userRole !== 2) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Solo arrendadores.'
      });
    }

    const reviews = await Review.getLandlordReviews(userId);
    const stats = await Review.getLandlordReviewStats(userId);
    const reviewsByProperty = await Review.getLandlordReviewsByProperty(userId);

    res.json({
      success: true,
      reviews,
      stats,
      reviewsByProperty
    });
  } catch (error) {
    console.error('Error obteniendo reseñas del arrendador:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
