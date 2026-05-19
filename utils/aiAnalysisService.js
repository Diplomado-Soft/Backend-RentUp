const sentimentApi = require('./sentimentApiService');

let pipeline = null;
let sentimentPipeline = null;
let pipelineLoaded = false;

const getPipeline = async () => {
    if (pipelineLoaded) return sentimentPipeline;
    try {
        const { pipeline: p } = await import('@huggingface/transformers');
        pipeline = p;
        sentimentPipeline = await pipeline(
            'sentiment-analysis',
            'Xenova/bert-base-multilingual-uncased-sentiment'
        );
        pipelineLoaded = true;
        console.log('Modelo de sentimiento multilingüe cargado en Node.js');
        return sentimentPipeline;
    } catch (error) {
        console.error('Error cargando modelo de IA:', error.message);
        return null;
    }
};

const isServiceRunning = async () => {
    try {
        const pipe = await getPipeline();
        return pipe !== null;
    } catch {
        return false;
    }
};

const healthCheck = async () => {
    try {
        const running = await isServiceRunning();
        return {
            success: running,
            ai: { available: running }
        };
    } catch (error) {
        return {
            success: false,
            ai: { available: false, error: error.message }
        };
    }
};

const starToSentiment = (stars) => {
    if (stars >= 4) return 'positive';
    if (stars <= 2) return 'negative';
    return 'neutral';
};

const labelToSentiment = (label) => {
    const normalized = label.toLowerCase().trim();

    if (normalized === 'positive' || normalized === 'pos' || normalized === 'label_2') {
        return 'positive';
    }
    if (normalized === 'negative' || normalized === 'neg' || normalized === 'label_0') {
        return 'negative';
    }
    if (normalized === 'neutral' || normalized === 'neu' || normalized === 'label_1') {
        return 'neutral';
    }

    const firstChar = parseInt(label.charAt(0));
    if (!isNaN(firstChar)) {
        return starToSentiment(firstChar);
    }

    return 'neutral';
};

const processReviewAnalysis = async (comment, rating) => {
    try {
        const pipe = await getPipeline();

        if (pipe && comment && comment.trim().length > 0) {
            const result = await pipe(comment);
            const label = result[0].label;
            const score = result[0].score;

            const sentiment = labelToSentiment(label);
            const requiresModeration = sentiment === 'negative' && score > 0.7;

            return {
                status: 'analyzed',
                sentiment: { sentiment, score },
                moderation: {
                    requires_moderation: requiresModeration,
                    reason: requiresModeration ? 'Comentario negativo detectado por IA' : null,
                    flags: requiresModeration ? ['NEGATIVO_FUERTE'] : [],
                    severity: requiresModeration ? 'medium' : 'low'
                }
            };
        }

        try {
            const apiResult = await sentimentApi.analyzeComment(comment);
            const sentiment = labelToSentiment(apiResult.codigo);
            const requiresModeration = sentiment === 'negative';

            return {
                status: 'analyzed',
                sentiment: { sentiment, score: sentiment === 'positive' ? 4 : sentiment === 'negative' ? 2 : 3 },
                moderation: {
                    requires_moderation,
                    reason: requiresModeration ? 'Comentario negativo detectado por API externa' : null,
                    flags: requiresModeration ? ['NEGATIVO_API'] : [],
                    severity: requiresModeration ? 'medium' : 'low'
                }
            };
        } catch (apiError) {
            console.error('Error con API externa de sentimientos:', apiError.message);
        }

        return {
            status: 'error',
            sentiment: { sentiment: starToSentiment(rating || 3), score: rating || 3 },
            moderation: { requires_moderation: false, reason: null, flags: [], severity: 'low' }
        };
    } catch (error) {
        console.error('Error en análisis con IA:', error.message);
        return {
            status: 'error',
            sentiment: { sentiment: starToSentiment(rating || 3), score: rating || 3 },
            moderation: { requires_moderation: false, reason: null, flags: [], severity: 'low' }
        };
    }
};

module.exports = {
    isServiceRunning,
    processReviewAnalysis,
    healthCheck
};
