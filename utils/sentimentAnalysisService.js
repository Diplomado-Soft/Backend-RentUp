const Sentiment = require('sentiment');
const sentiment = new Sentiment();

class SentimentAnalysisService {
    /**
     * Analizar sentimiento de un texto
     * @param {string} text - Texto a analizar
     * @returns {object} {sentiment: 'positive|negative|neutral', score: -1.0 to 1.0, details: {...}}
     */
    static analyzeSentiment(text) {
        if (!text || text.trim().length === 0) {
            return {
                sentiment: 'neutral',
                score: 0,
                confidence: 0,
                details: {}
            };
        }

        // Análisis de sentimiento
        const result = sentiment.analyze(text);
        
        // Determinar sentimiento basado en score
        let sentimentLabel = 'neutral';
        if (result.score > 0.5) {
            sentimentLabel = 'positive';
        } else if (result.score < -0.5) {
            sentimentLabel = 'negative';
        }

        // Normalizar score a rango -1 a 1
        const normalizedScore = Math.max(-1, Math.min(1, result.score / 10));

        return {
            sentiment: sentimentLabel,
            score: parseFloat(normalizedScore.toFixed(2)),
            words: result.words || [],
            positive: result.positive || [],
            negative: result.negative || [],
            details: result
        };
    }

    /**
     * Detectar si una review necesita moderación
     * @param {object} review - Objeto de review
     * @returns {object} {needsModeration: boolean, flagReason: string|null}
     */
    static detectModerationFlags(review) {
        const flags = [];

        // Flag 1: Palabras ofensivas comunes
        const offensiveWords = [
            'basura', 'horrible', 'apesto', 'estafa', 'fraude',
            'sucio', 'cochino', 'asco', 'repugnante', 'vomito',
            'stupid', 'asshole', 'fuck', 'shit', 'damn',
            'damn', 'crap', 'hell'
        ];

        const commentLower = (review.comment || '').toLowerCase();
        for (const word of offensiveWords) {
            if (commentLower.includes(word)) {
                flags.push(`Lenguaje ofensivo detectado: "${word}"`);
                break;
            }
        }

        // Flag 2: Rating y sentimiento no alineados (advertencia)
        if (review.rating >= 4 && review.sentiment === 'negative') {
            flags.push('Inconsistencia: rating alto pero sentimiento negativo');
        } else if (review.rating <= 2 && review.sentiment === 'positive') {
            flags.push('Inconsistencia: rating bajo pero sentimiento positivo');
        }

        // Flag 3: Comentario muy corto con rating bajo
        if (review.rating <= 2 && commentLower.length < 10) {
            flags.push('Comentario muy corto con rating negativo');
        }

        // Flag 4: Spam (muchas repeticiones)
        const words = commentLower.split(/\s+/);
        if (words.length > 0) {
            const wordFreq = {};
            for (const word of words) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
            const maxFreq = Math.max(...Object.values(wordFreq));
            if (maxFreq > words.length * 0.5) {
                flags.push('Posible spam (palabras muy repetidas)');
            }
        }

        // Flag 5: Texto vacío o demasiado largo
        if (!review.comment || review.comment.trim().length === 0) {
            flags.push('Sin comentario de texto');
        } else if (review.comment.length > 5000) {
            flags.push('Comentario demasiado largo');
        }

        return {
            needsModeration: flags.length > 0,
            flagReason: flags.length > 0 ? flags.join('; ') : null,
            flags: flags
        };
    }

    /**
     * Procesar análisis completo de una review
     * @param {object} review - Objeto de review con comment, rating
     * @returns {object} Análisis completo
     */
    static processReviewAnalysis(review) {
        // Análisis de sentimiento
        const sentimentResult = this.analyzeSentiment(review.comment);

        // Detección de moderación
        const moderationResult = this.detectModerationFlags({
            comment: review.comment,
            rating: review.rating,
            sentiment: sentimentResult.sentiment
        });

        return {
            sentiment: sentimentResult.sentiment,
            sentiment_score: sentimentResult.score,
            moderation_flag: moderationResult.needsModeration,
            flag_reason: moderationResult.flagReason,
            analysis_details: {
                positive_words: sentimentResult.positive || [],
                negative_words: sentimentResult.negative || [],
                confidence: Math.abs(sentimentResult.score),
                word_count: (review.comment || '').split(/\s+/).length
            }
        };
    }

    /**
     * Calcular calificación promedio con weight de sentimiento
     * @param {array} reviews - Array de reviews
     * @returns {object} {average: float, by_sentiment: {positive, negative, neutral}}
     */
    static calculateWeightedRating(reviews) {
        if (!reviews || reviews.length === 0) {
            return {
                average: 0,
                count: 0,
                by_sentiment: {
                    positive: 0,
                    negative: 0,
                    neutral: 0
                }
            };
        }

        const bySentiment = {
            positive: [],
            negative: [],
            neutral: []
        };

        let totalScore = 0;
        for (const review of reviews) {
            totalScore += review.rating || 0;
            const sentiment = review.sentiment || 'neutral';
            if (bySentiment[sentiment]) {
                bySentiment[sentiment].push(review.rating);
            }
        }

        const averageRating = (totalScore / reviews.length).toFixed(1);

        return {
            average: parseFloat(averageRating),
            count: reviews.length,
            by_sentiment: {
                positive: bySentiment.positive.length > 0 
                    ? (bySentiment.positive.reduce((a, b) => a + b, 0) / bySentiment.positive.length).toFixed(1)
                    : 0,
                negative: bySentiment.negative.length > 0 
                    ? (bySentiment.negative.reduce((a, b) => a + b, 0) / bySentiment.negative.length).toFixed(1)
                    : 0,
                neutral: bySentiment.neutral.length > 0 
                    ? (bySentiment.neutral.reduce((a, b) => a + b, 0) / bySentiment.neutral.length).toFixed(1)
                    : 0
            }
        };
    }
}

module.exports = SentimentAnalysisService;
