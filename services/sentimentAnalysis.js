const AIAnalysisService = require('../utils/aiAnalysisService');
const Review = require('../models/ReviewModel');

const PROCESS_BATCH_SIZE = 20;
const DELAY_BETWEEN_REQUESTS = 1000;

async function analyzePendingReviews(options = {}) {
    const { batchSize = PROCESS_BATCH_SIZE, delay = DELAY_BETWEEN_REQUESTS } = options;

    try {
        console.log('Verificando disponibilidad del servicio de sentimiento...');

        const isAvailable = await AIAnalysisService.isServiceRunning();

        if (!isAvailable) {
            console.log('Modelo de IA no disponible. Saltando análisis automático.');
            return {
                success: false,
                serviceAvailable: false,
                analyzed: 0
            };
        }

        console.log('Modelo de IA disponible. Obteniendo reseñas pendientes...');

        const unanalyzedReviews = await Review.getUnanalyzedReviews(batchSize);

        if (!unanalyzedReviews || unanalyzedReviews.length === 0) {
            console.log('No hay reseñas pendientes por analizar.');
            return {
                success: true,
                serviceAvailable: true,
                analyzed: 0
            };
        }

        console.log(`Analizando ${unanalyzedReviews.length} reseñas...`);
        let analyzed = 0;

        for (const review of unanalyzedReviews) {
            try {
                const result = await AIAnalysisService.processReviewAnalysis(
                    review.comment,
                    review.rating
                );

                await Review.updateSentimentAnalysis(review.review_id, {
                    sentiment: result.sentiment.sentiment,
                    sentiment_score: result.sentiment.score,
                    moderation_flag: result.moderation.requires_moderation,
                    flag_reason: result.moderation.reason
                });

                analyzed++;

                if (delay > 0 && analyzed < unanalyzedReviews.length) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (reviewError) {
                console.error(`Error analizando reseña ${review.review_id}:`, reviewError.message);
            }
        }

        console.log(`Análisis completado. ${analyzed} reseñas analizadas.`);

        return {
            success: true,
            serviceAvailable: true,
            analyzed
        };

    } catch (error) {
        console.error('Error en análisis de reseñas:', error.message);
        return {
            success: false,
            serviceAvailable: false,
            analyzed: 0,
            error: error.message
        };
    }
}

module.exports = {
    analyzePendingReviews
};
