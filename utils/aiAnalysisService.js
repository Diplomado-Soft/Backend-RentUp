/**
 * AI Analysis Service
 * Comunicación con Ollama para análisis de sentimiento y moderación
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3.5:latest';

/**
 * Verificar si Ollama está corriendo
 */
const isOllamaRunning = async () => {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        return response.ok;
    } catch (error) {
        return false;
    }
};

/**
 * Health check completo del servicio de IA
 */
const healthCheck = async () => {
    try {
        const isRunning = await isOllamaRunning();
        
        if (!isRunning) {
            return {
                success: false,
                ollama: { available: false, error: 'Ollama no está corriendo' }
            };
        }

        // Verificar si el modelo está disponible
        const response = await fetch(`${OLLAMA_URL}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        
        if (!response.ok) {
            return {
                success: false,
                ollama: { available: true, error: 'Error obteniendo modelos' }
            };
        }

        const data = await response.json();
        const models = data.models || [];
        const hasModel = models.some(m => m.name === OLLAMA_MODEL || m.name === OLLAMA_MODEL.split(':')[0]);

        return {
            success: true,
            ollama: {
                available: true,
                model: OLLAMA_MODEL,
                model_available: hasModel,
                models: models.map(m => m.name)
            }
        };
    } catch (error) {
        return {
            success: false,
            ollama: { available: false, error: error.message }
        };
    }
};

/**
 * Analizar una reseña con Ollama
 * @param {string} comment - Texto de la reseña
 * @param {number} rating - Rating numérico (1-5)
 * @returns {Object} Análisis de sentimiento y moderación
 */
const processReviewAnalysis = async (comment, rating) => {
    try {
        const prompt = `Eres un moderador de reseñas de apartamentos. Analiza:

DATOS: Rating ${rating}/5. Comentario: "${comment || 'Sin comentario'}"

RESPONDE SOLO JSON VÁLIDO:
{
  "sentiment": {"sentiment": "positive|negative|neutral", "score": 1-5},
  "moderation": {
    "requires_moderation": boolean,
    "reason": "explicación corta",
    "flags": ["TIPO"],
    "severity": "low|medium|high"
  }
}

TIPOS DE FLAGS (Usa SOLO estos):
- "LENGUAJE_OFENSIVO": Insultos, palabrotas, discriminatorio, hate speech
- "AMENAZAS_ACOSO": Amenazas físicas, acoso, bullying, hostigamiento
- "SPAM": Texto repetitivo, sin sentido, publicidad, irrelevant
- "INFO_PERSONAL": Teléfonos (300-123-456), direcciones, emails, IDs
- "CONTENIDO_SEXUAL": Lenguaje sexual, pornografía, inapropiado
- "MENTIRAS_FACTUALES": Afirmaciones falsas sobre el inmueble (ej: "tiene piscina" cuando no)
- "OTRO": Cualquier otro problema grave

EJEMPLOS:
1. "Me encantó, muy limpio" -> {"sentiment": {"sentiment": "positive", "score": 5}, "moderation": {"requires_moderation": false}}
2. "Eres un idiota, maricón" -> {"sentiment": {"sentiment": "negative", "score": 1}, "moderation": {"requires_moderation": true, "reason": "Lenguaje ofensivo discriminatorio", "flags": ["LENGUAJE_OFENSIVO"], "severity": "high"}}
3. "Llamame al 300-123-4567 para quejas" -> {"moderation": {"requires_moderation": true, "reason": "Contiene teléfono personal", "flags": ["INFO_PERSONAL"], "severity": "medium"}}
4. "Compro apartamento" repetido 20 veces -> {"moderation": {"requires_moderation": true, "reason": "Spam repetitivo", "flags": ["SPAM"], "severity": "low"}}
5. "Tiene piscina y gimnasio" (cuando no tiene) -> {"moderation": {"requires_moderation": true, "reason": "Mentira factual", "flags": ["MENTIRAS_FACTUALES"], "severity": "medium"}}`;

        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false,
                format: 'json'
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`Ollama respondió con status ${response.status}`);
        }

        const data = await response.json();
        const analysis = JSON.parse(data.response);

        return {
            status: 'analyzed',
            sentiment: analysis.sentiment || { sentiment: 'neutral', score: rating || 3 },
            moderation: analysis.moderation || { requires_moderation: false, reason: null, flags: [], severity: 'low' }
        };

    } catch (error) {
        console.error('❌ Error en análisis con Ollama:', error.message);
        return {
            status: 'error',
            sentiment: { sentiment: 'neutral', score: rating || 3 },
            moderation: { requires_moderation: false, reason: null, flags: [], severity: 'low' }
        };
    }
};

module.exports = {
    isOllamaRunning,
    processReviewAnalysis,
    healthCheck
};
