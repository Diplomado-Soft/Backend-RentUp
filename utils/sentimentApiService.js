/**
 * Sentiment API Service
 * Comunicación con la API FastAPI de sentimientos (pysentimiento)
 * URL: https://github.com/luiscarlosjo157/apisIA
 */

const SENTIMENT_API_URL = process.env.SENTIMENT_API_URL || 'http://localhost:8077';

/**
 * Analizar un comentario usando la API de sentimientos
 * @param {string} comment - Texto del comentario
 * @returns {Object} - { sentimiento, codigo, estrellas, probabilidades }
 */
const analyzeComment = async (comment) => {
    if (!comment || comment.trim().length === 0) {
        return {
            sentimiento: 'Comentario neutro',
            codigo: 'NEU',
            estrellas: 3,
            probabilidades: { positivo: 0.33, negativo: 0.33, neutro: 0.34 }
        };
    }

    try {
        const response = await fetch(`${SENTIMENT_API_URL}/upload-comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comentario: comment }),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`API respondió con status ${response.status}`);
        }

        const data = await response.json();
        return {
            sentimiento: data.sentimiento,
            codigo: data.codigo,
            estrellas: data.estrellas,
            probabilidades: data.probabilidades
        };
    } catch (error) {
        console.error('❌ Error llamando a API de sentimientos:', error.message);
        // Fallback: retornar valores neutros
        return {
            sentimiento: 'Comentario neutro',
            codigo: 'NEU',
            estrellas: 3,
            probabilidades: { positivo: 0.33, negativo: 0.33, neutro: 0.34 }
        };
    }
};

/**
 * Verificar si la API de sentimientos está disponible
 */
const isSentimentApiRunning = async () => {
    try {
        const response = await fetch(`${SENTIMENT_API_URL}/docs`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        return response.ok;
    } catch (error) {
        return false;
    }
};

module.exports = {
    analyzeComment,
    isSentimentApiRunning
};
