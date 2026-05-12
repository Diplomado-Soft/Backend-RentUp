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
            'nlptown/bert-base-multilingual-uncased-sentiment'
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

const processReviewAnalysis = async (comment, rating) => {
    try {
        const pipe = await getPipeline();
        if (!pipe) {
            return {
                status: 'error',
                sentiment: { sentiment: 'neutral', score: rating || 3 },
                moderation: { requires_moderation: false, reason: null, flags: [], severity: 'low' }
            };
        }

        const result = await pipe(comment || 'Sin comentario');
        const label = result[0].label;
        const score = result[0].score;

        const stars = parseInt(label.charAt(0));
        const sentiment = starToSentiment(stars);
        const requiresModeration = sentiment === 'negative' && score > 0.7;

        return {
            status: 'analyzed',
            sentiment: { sentiment, score: stars },
            moderation: {
                requires_moderation: requiresModeration,
                reason: requiresModeration ? 'Comentario negativo detectado por IA' : null,
                flags: requiresModeration ? ['NEGATIVO_FUERTE'] : [],
                severity: requiresModeration ? 'medium' : 'low'
            }
        };
    } catch (error) {
        console.error('Error en análisis con IA:', error.message);
        return {
            status: 'error',
            sentiment: { sentiment: 'neutral', score: rating || 3 },
            moderation: { requires_moderation: false, reason: null, flags: [], severity: 'low' }
        };
    }
};

module.exports = {
    isServiceRunning,
    processReviewAnalysis,
    healthCheck
};
