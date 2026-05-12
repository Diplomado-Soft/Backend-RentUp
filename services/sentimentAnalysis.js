const AIAnalysisService = require('../utils/aiAnalysisService');
const Review = require('../models/ReviewModel');

const PROCESS_BATCH_SIZE = 20;
const DELAY_BETWEEN_REQUESTS = 1000;

async function analyzePendingReviews(options = {}) {
    const { batchSize = PROCESS_BATCH_SIZE, delay = DELAY_BETWEEN_REQUESTS } = options;

    try {
        console.log('Verificando disponibilidad del servicio de sentimiento...');

        const isRunning = await AIAnalysisService.isServiceRunning();

        if (!isRunning) {
            console.log('Modelo de IA no disponible. Saltando análisis automático.');
            return {
                success: false,
                serviceAvailable: false,

                serviceAvailable: true,

            serviceAvailable: true,

            serviceAvailable: false,
            error: error.message
        };
    }
}

module.exports = {
    analyzePendingReviews
};
