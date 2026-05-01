/**
 * Ollama Auto-Analysis Service
 * Analiza automáticamente las reseñas pendientes cuando Ollama está disponible
 */

const AIAnalysisService = require('../utils/aiAnalysisService');
const Review = require('../models/ReviewModel');

const PROCESS_BATCH_SIZE = 20;
const DELAY_BETWEEN_REQUESTS = 1000;

async function analyzePendingReviews(options = {}) {
    const { batchSize = PROCESS_BATCH_SIZE, delay = DELAY_BETWEEN_REQUESTS } = options;
    
    try {
        console.log('🤖 Verificando disponibilidad de Ollama...');
        
        const isRunning = await AIAnalysisService.isOllamaRunning();
        
        if (!isRunning) {
            console.log('⚠️ Ollama no está disponible. Saltando análisis automático.');
            console.log('   Para activar: enciende Ollama y llama a /api/reviews/admin/analyze-batch');
            return {
                success: false,
                ollamaAvailable: false,
                message: 'Ollama no está corriendo'
            };
        }

        console.log('✅ Ollama está disponible. Buscando reseñas pendientes...');
        
        const unanalyzedReviews = await Review.getUnanalyzedReviews(batchSize);
        
        if (unanalyzedReviews.length === 0) {
            console.log('✅ No hay reseñas pendientes por analizar');
            return {
                success: true,
                ollamaAvailable: true,
                analyzed: 0,
                message: 'No hay reseñas pendientes'
            };
        }

        console.log(`📝 Encontradas ${unanalyzedReviews.length} reseñas pendientes`);

        let analyzed = 0;
        let flagged = 0;
        let errors = 0;

        for (const review of unanalyzedReviews) {
            try {
                console.log(`🔄 Analizando reseña ${review.review_id}...`);
                
                const analysis = await AIAnalysisService.processReviewAnalysis(
                    review.comment,
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
                        console.log(`⚠️ Reseña ${review.review_id} marcada para revisión`);
                    }

                    analyzed++;
                    console.log(`✅ Reseña ${review.review_id} analizada (sentimiento: ${analysis.sentiment?.sentiment})`);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
                
            } catch (reviewError) {
                errors++;
                console.error(`❌ Error analizando reseña ${review.review_id}:`, reviewError.message);
            }
        }

        console.log('='.repeat(50));
        console.log('📊 Resumen del análisis automático:');
        console.log(`   Total analizadas: ${analyzed}`);
        console.log(`   Marcadas para revisión: ${flagged}`);
        console.log(`   Errores: ${errors}`);
        console.log('='.repeat(50));

        return {
            success: true,
            ollamaAvailable: true,
            analyzed,
            flagged,
            errors,
            message: `Analizadas ${analyzed} reseñas`
        };

    } catch (error) {
        console.error('❌ Error en análisis automático:', error.message);
        return {
            success: false,
            ollamaAvailable: false,
            error: error.message
        };
    }
}

async function startOllamaWatchdog(intervalMs = 60000) {
    console.log('🔄 Iniciando watchdog de Ollama...');
    
    setInterval(async () => {
        try {
            const isRunning = await AIAnalysisService.isOllamaRunning();
            
            if (isRunning) {
                const unanalyzed = await Review.getUnanalyzedReviews(1);
                
                if (unanalyzed.length > 0) {
                    console.log('🔔 Ollama disponible, analizando reseñas pendientes...');
                    await analyzePendingReviews({ batchSize: 10, delay: 500 });
                }
            }
        } catch (error) {
            console.error('Error en watchdog:', error.message);
        }
    }, intervalMs);
}

module.exports = {
    analyzePendingReviews,
    startOllamaWatchdog
};
