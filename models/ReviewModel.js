const db = require('../config/db');

class Review {
  /**
   * Crear una nueva reseña
   */
  static async createReview({ reviewer_id, property_id, rating, comment, verified_booking = false }) {
    try {
      if (!reviewer_id || !property_id || !rating) {
        throw new Error('reviewer_id, property_id y rating son requeridos');
      }

      if (rating < 1 || rating > 5) {
        throw new Error('El rating debe estar entre 1 y 5');
      }

      const [result] = await db.execute(
        `INSERT INTO reviews (reviewer_id, property_id, rating, comment, verified_booking)
         VALUES (?, ?, ?, ?, ?)`,
        [reviewer_id, property_id, rating, comment || null, verified_booking ? 1 : 0]
      );

      return {
        review_id: result.insertId,
        reviewer_id,
        property_id,
        rating,
        comment,
        verified_booking: !!verified_booking,
        created_at: new Date()
      };
    } catch (error) {
      throw new Error(`Error al crear reseña: ${error.message}`);
    }
  }

  /**
   * Obtener todas las reseñas de una propiedad
   */
  static async getPropertyReviews(property_id) {
    try {
      const [reviews] = await db.execute(
        `SELECT 
          r.review_id, 
          r.reviewer_id, 
          r.rating, 
          r.comment, 
          r.verified_booking,
          r.created_at,
          u.user_name, 
          u.user_lastname
         FROM reviews r
         INNER JOIN users u ON r.reviewer_id = u.user_id
         WHERE r.property_id = ?
          ORDER BY r.created_at DESC`,
        [property_id]
      );

      return reviews;
    } catch (error) {
      throw new Error(`Error al obtener reseñas: ${error.message}`);
    }
  }

  /**
   * Obtener todas las reseñas feitas por un usuario
   */
  static async getUserReviews(user_id) {
    try {
      const [reviews] = await db.execute(
        `SELECT 
          r.review_id, 
          r.reviewer_id, 
          r.rating, 
          r.comment, 
          r.verified_booking,
          r.created_at,
          r.moderation_flag,
          a.id_apt as property_id,
          a.direccion_apt,
          b.barrio
         FROM reviews r
         INNER JOIN apartments a ON r.property_id = a.id_apt
         LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
         WHERE r.reviewer_id = ?
         ORDER BY r.created_at DESC`,
        [user_id]
      );

      return reviews;
    } catch (error) {
      throw new Error(`Error al obtener reseñas del usuario: ${error.message}`);
    }
  }

  /**
   * Obtener todas las reseñas de los apartamentos de un arrendador
   */
  static async getLandlordReviews(landlord_id) {
    try {
      const [reviews] = await db.execute(
        `SELECT 
          r.review_id, 
          r.reviewer_id, 
          r.rating, 
          r.comment, 
          r.verified_booking,
          r.created_at,
          r.sentiment,
          r.sentiment_score,
          r.moderation_flag,
          r.flag_reason,
          u.user_name as reviewer_name, 
          u.user_lastname as reviewer_lastname,
          u.user_email as reviewer_email,
          a.id_apt as property_id,
          a.direccion_apt,
          b.barrio as property_barrio
         FROM reviews r
         INNER JOIN users u ON r.reviewer_id = u.user_id
         INNER JOIN apartments a ON r.property_id = a.id_apt
         LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
         WHERE a.user_id = ?
         ORDER BY r.created_at DESC`,
        [landlord_id]
      );

      return reviews;
    } catch (error) {
      throw new Error(`Error al obtener reseñas del arrendador: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de reseñas de los apartamentos de un arrendador
   */
  static async getLandlordReviewStats(landlord_id) {
    try {
      const [stats] = await db.execute(
        `SELECT 
          COUNT(DISTINCT r.review_id) as total_reviews,
          AVG(r.rating) as average_rating,
          COUNT(DISTINCT a.id_apt) as total_properties,
          SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) as five_stars,
          SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) as four_stars,
          SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) as three_stars,
          SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) as two_stars,
          SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) as one_star,
          SUM(CASE WHEN r.moderation_flag = 1 THEN 1 ELSE 0 END) as flagged_reviews
         FROM reviews r
         INNER JOIN apartments a ON r.property_id = a.id_apt
         WHERE a.user_id = ?`,
        [landlord_id]
      );

      return stats[0] || {
        total_reviews: 0,
        average_rating: 0,
        total_properties: 0,
        five_stars: 0,
        four_stars: 0,
        three_stars: 0,
        two_stars: 0,
        one_star: 0,
        flagged_reviews: 0
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas del arrendador: ${error.message}`);
    }
  }

  /**
   * Obtener reseñas agrupadas por apartamento para un arrendador
   */
  static async getLandlordReviewsByProperty(landlord_id) {
    try {
      const [reviews] = await db.execute(
        `SELECT 
          a.id_apt as property_id,
          a.direccion_apt,
          b.barrio as property_barrio,
          COUNT(r.review_id) as review_count,
          AVG(r.rating) as average_rating,
          SUM(CASE WHEN r.rating >= 4 THEN 1 ELSE 0 END) as positive_reviews,
          SUM(CASE WHEN r.rating <= 2 THEN 1 ELSE 0 END) as negative_reviews,
          SUM(CASE WHEN r.moderation_flag = 1 THEN 1 ELSE 0 END) as flagged_count
         FROM apartments a
         LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
         LEFT JOIN reviews r ON a.id_apt = r.property_id
         WHERE a.user_id = ?
         GROUP BY a.id_apt, a.direccion_apt, b.barrio
         ORDER BY review_count DESC, average_rating DESC`,
        [landlord_id]
      );

      return reviews;
    } catch (error) {
      throw new Error(`Error al obtener reseñas por propiedad: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de reseñas de una propiedad
   */
  static async getPropertyReviewStats(property_id) {
    try {
      const [stats] = await db.execute(
        `SELECT 
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating,
          SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
          SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
          SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
          SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
          SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
         FROM reviews
         WHERE property_id = ?`,
        [property_id]
      );

      return stats[0] || {
        total_reviews: 0,
        average_rating: 0,
        five_stars: 0,
        four_stars: 0,
        three_stars: 0,
        two_stars: 0,
        one_star: 0
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Obtener una reseña específica
   */
  static async getReviewById(review_id) {
    try {
      const [reviews] = await db.execute(
        `SELECT 
          r.*,
          u.user_name, 
          u.user_lastname
         FROM reviews r
         INNER JOIN users u ON r.reviewer_id = u.user_id
         WHERE r.review_id = ?`,
        [review_id]
      );

      return reviews[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener reseña: ${error.message}`);
    }
  }

  /**
   * Actualizar una reseña
   */
  static async updateReview(review_id, { rating, comment }) {
    try {
      if (rating && (rating < 1 || rating > 5)) {
        throw new Error('El rating debe estar entre 1 y 5');
      }

      const [result] = await db.execute(
        `UPDATE reviews 
         SET rating = COALESCE(?, rating),
             comment = COALESCE(?, comment)
         WHERE review_id = ?`,
        [rating || null, comment || null, review_id]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return this.getReviewById(review_id);
    } catch (error) {
      throw new Error(`Error al actualizar reseña: ${error.message}`);
    }
  }

  /**
   * Eliminar una reseña
   */
  static async deleteReview(review_id) {
    try {
      const [result] = await db.execute(
        `DELETE FROM reviews WHERE review_id = ?`,
        [review_id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error al eliminar reseña: ${error.message}`);
    }
  }

  /**
   * Verificar si un usuario ya ha reseñado una propiedad
   */
  static async hasUserReviewedProperty(user_id, property_id) {
    try {
      const [reviews] = await db.execute(
        `SELECT review_id FROM reviews 
         WHERE reviewer_id = ? AND property_id = ?
         LIMIT 1`,
        [user_id, property_id]
      );

      return reviews.length > 0;
    } catch (error) {
      throw new Error(`Error al verificar reseña: ${error.message}`);
    }
  }

  // ===== MÉTODOS PARA ANÁLISIS DE SENTIMIENTO =====

  /**
   * Actualizar análisis de sentimiento de una review
   */
  static async updateSentimentAnalysis(review_id, analysisData) {
    try {
      const { sentiment, sentiment_score, moderation_flag, flag_reason } = analysisData;

      const [result] = await db.execute(
        `UPDATE reviews 
         SET sentiment = ?, 
             sentiment_score = ?, 
             moderation_flag = ?, 
             flag_reason = ?,
             analyzed_at = NOW()
         WHERE review_id = ?`,
        [sentiment, sentiment_score, moderation_flag ? 1 : 0, flag_reason, review_id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error actualizando análisis de sentimiento: ${error.message}`);
    }
  }

  /**
   * Obtener reviews flagged para moderación
   */
  static async getFlaggedReviews(limit = 50, offset = 0) {
    try {
      const limitInt = parseInt(limit) || 50;
      const offsetInt = parseInt(offset) || 0;
      
      const [reviews] = await db.query(
        `SELECT 
          r.*,
          u.user_name,
          u.user_lastname,
          u.user_email,
          a.direccion_apt,
          b.barrio,
          a.user_id as landlord_id
         FROM reviews r
         INNER JOIN users u ON r.reviewer_id = u.user_id
         INNER JOIN apartments a ON r.property_id = a.id_apt
         LEFT JOIN barrio b ON a.id_barrio = b.id_barrio
         WHERE r.moderation_flag = 1
         ORDER BY r.analyzed_at DESC
         LIMIT ${limitInt} OFFSET ${offsetInt}`,
      );

      const [countResult] = await db.query(
        'SELECT COUNT(*) as total FROM reviews WHERE moderation_flag = 1'
      );

      return {
        reviews,
        total: countResult[0]?.total || 0,
        limit: limitInt,
        offset: offsetInt
      };
    } catch (error) {
      throw new Error(`Error obtaining flagged reviews: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de sentimiento para una propiedad
   */
  static async getPropertySentimentStats(property_id) {
    try {
      const [stats] = await db.execute(
        `SELECT 
          sentiment,
          COUNT(*) as count,
          AVG(rating) as avg_rating
         FROM reviews
         WHERE property_id = ? AND sentiment != 'unanalyzed'
         GROUP BY sentiment`,
        [property_id]
      );

      const result = {
        total: 0,
        positive: { count: 0, avg_rating: 0 },
        negative: { count: 0, avg_rating: 0 },
        neutral: { count: 0, avg_rating: 0 }
      };

      if (stats && stats.length > 0) {
        for (const row of stats) {
          result.total += row.count;
          result[row.sentiment] = {
            count: row.count,
            avg_rating: parseFloat(row.avg_rating || 0).toFixed(1)
          };
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Error obteniendo estadísticas de sentimiento: ${error.message}`);
    }
  }

  /**
   * Registrar acción de moderación
   */
  static async logModerationAction(review_id, admin_id, action, notes = null) {
    try {
      const [result] = await db.execute(
        `INSERT INTO review_moderation_history (review_id, admin_id, action, notes, action_date)
         VALUES (?, ?, ?, ?, NOW())`,
        [review_id, admin_id, action, notes]
      );

      return result.insertId;
    } catch (error) {
      throw new Error(`Error registrando acción de moderación: ${error.message}`);
    }
  }

  /**
   * Obtener historial de moderación de una review
   */
  static async getModerationHistory(review_id) {
    try {
      const [history] = await db.execute(
        `SELECT 
          h.*,
          u.user_name,
          u.user_email
         FROM review_moderation_history h
         LEFT JOIN users u ON h.admin_id = u.user_id
         WHERE h.review_id = ?
         ORDER BY h.action_date DESC`,
        [review_id]
      );

      return history;
    } catch (error) {
      throw new Error(`Error obteniendo historial de moderación: ${error.message}`);
    }
  }

  /**
   * Obtener reviews no analizadas para procesar en batch
   */
  static async getUnanalyzedReviews(limit = 100) {
    try {
      const limitInt = parseInt(limit) || 100;
      const [reviews] = await db.query(
        `SELECT 
          review_id,
          comment,
          rating
         FROM reviews
         WHERE sentiment = 'unanalyzed'
         LIMIT ${limitInt}`
      );

      return reviews;
    } catch (error) {
      throw new Error(`Error obtaining unanalyzed reviews: ${error.message}`);
    }
  }

  /**
   * Obtener reseñas negativas de una propiedad (sentimiento negativo O rating <= 2)
   * Usado para detección de patrones recurrentes
   */
  static async getPropertyNegativeReviews(property_id) {
    try {
      const [reviews] = await db.execute(
        `SELECT review_id, rating, sentiment, sentiment_score, created_at
         FROM reviews
         WHERE property_id = ? 
           AND (sentiment = 'negative' OR rating <= 2)
         ORDER BY created_at DESC`,
        [property_id]
      );

      return reviews;
    } catch (error) {
      throw new Error(`Error obteniendo reseñas negativas: ${error.message}`);
    }
  }
}

module.exports = Review;
