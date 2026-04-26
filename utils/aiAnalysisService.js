const axios = require('axios');

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL   || 'phi3.5';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '60000');
// Si el servidor Ollama requiere autenticación (Railway, Render, etc.)
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || null;

/**
 * Check if Ollama server is running
 * @returns {Promise<boolean>}
 */
async function isOllamaRunning() {
  try {
    const headers = OLLAMA_API_KEY ? { 'Authorization': `Bearer ${OLLAMA_API_KEY}` } : {};
    const response = await axios.get(`${OLLAMA_API_URL}/api/tags`, {
      timeout: 5000,
      headers
    });
    return response.status === 200;
  } catch (error) {
    console.error('Ollama no está disponible:', error.message);
    return false;
  }
}

/**
 * Call Ollama API for review analysis
 * @param {string} prompt - Analysis prompt
 * @returns {Promise<string>} - LLM response
 */
async function callOllama(prompt) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (OLLAMA_API_KEY) headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;

    const response = await axios.post(
      `${OLLAMA_API_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.3,
        top_p: 0.9,
      },
      { timeout: OLLAMA_TIMEOUT, headers }
    );

    return response.data.response || '';
  } catch (error) {
    console.error('Error calling Ollama:', error.message);
    throw new Error(`Ollama API error: ${error.message}`);
  }
}

/**
 * Parse JSON response from Ollama
 * Ollama sometimes returns non-JSON content, so we extract JSON from text
 * @param {string} text - Response text
 * @returns {object} - Parsed JSON
 */
function parseOllamaResponse(text) {
  try {
    // Try direct JSON parse
    return JSON.parse(text);
  } catch (e) {
    // If fails, try to extract JSON from text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.warn('Could not parse JSON from Ollama response');
        // Return default safe analysis
        return {
          legitimate: true,
          offensive: false,
          constructive: true,
          spam: false,
          explanation: text.substring(0, 200)
        };
      }
    }
    throw new Error('Invalid response format from Ollama');
  }
}

/**
 * Analyze a review for legitimacy, offensive content, and constructiveness
 * @param {string} reviewText - Review content to analyze
 * @returns {Promise<object>} - Analysis result with legitimacy, offensive, constructive, explanation
 */
async function analyzeReview(reviewText) {
  if (!reviewText || reviewText.trim().length === 0) {
    return {
      legitimate: false,
      offensive: false,
      constructive: false,
      spam: true,
      explanation: 'Review is empty'
    };
  }

  const prompt = `Analyze this apartment review and classify it. Respond ONLY with JSON, no other text.

Review: "${reviewText}"

Classification:
{
  "legitimate": boolean (is this a real review or fake?),
  "offensive": boolean (contains offensive/abusive language?),
  "constructive": boolean (is the feedback constructive?),
  "spam": boolean (is this spam or advertising?),
  "explanation": "brief reason" (max 100 chars)
}`;

  try {
    console.log(`Analyzing review with Ollama (${OLLAMA_MODEL})...`);
    const response = await callOllama(prompt);
    const analysis = parseOllamaResponse(response);

    console.log('Review analyzed:', {
      legitimate: analysis.legitimate,
      offensive: analysis.offensive,
      spam: analysis.spam
    });

    return {
      legitimate: analysis.legitimate ?? true,
      offensive: analysis.offensive ?? false,
      constructive: analysis.constructive ?? true,
      spam: analysis.spam ?? false,
      explanation: analysis.explanation || 'Analysis complete'
    };
  } catch (error) {
    console.error('Analysis failed:', error.message);
    throw error;
  }
}

/**
 * Generate sentiment analysis (positive/negative/neutral)
 * @param {string} reviewText - Review content
 * @returns {Promise<object>} - Sentiment with score
 */
async function analyzeSentiment(reviewText) {
  const prompt = `Rate the sentiment of this apartment review on a scale 1-5, where:
1 = Very Negative
2 = Negative  
3 = Neutral
4 = Positive
5 = Very Positive

Review: "${reviewText}"

Respond ONLY with JSON:
{
  "sentiment": "positive|negative|neutral",
  "score": number (1-5),
  "confidence": number (0-1),
  "reasoning": "brief explanation"
}`;

  try {
    const response = await callOllama(prompt);
    const analysis = parseOllamaResponse(response);

    return {
      sentiment: analysis.sentiment || 'neutral',
      score: Math.min(5, Math.max(1, analysis.score || 3)),
      confidence: Math.min(1, Math.max(0, analysis.confidence || 0.7)),
      reasoning: analysis.reasoning || ''
    };
  } catch (error) {
    console.error('Sentiment analysis failed:', error.message);
    throw error;
  }
}

/**
 * Detect moderation flags and reasons
 * @param {string} reviewText - Review content
 * @returns {Promise<object>} - Flag result with severity
 */
async function detectModerationFlags(reviewText) {
  const prompt = `Review this apartment review for moderation issues. Respond ONLY with JSON.

Review: "${reviewText}"

{
  "requires_moderation": boolean,
  "severity": "low|medium|high|critical",
  "flags": [array of issue types: "offensive", "spam", "fake", "adult", "violence", "harassment"],
  "reason": "explanation of flags"
}`;

  try {
    const response = await callOllama(prompt);
    const result = parseOllamaResponse(response);

    return {
      requires_moderation: result.requires_moderation ?? false,
      severity: result.severity || 'low',
      flags: Array.isArray(result.flags) ? result.flags : [],
      reason: result.reason || ''
    };
  } catch (error) {
    console.error('Moderation detection failed:', error.message);
    throw error;
  }
}

/**
 * Full review analysis - combines all analyses
 * @param {string} reviewText - Review content
 * @param {number} rating - Star rating (1-5)
 * @returns {Promise<object>} - Complete analysis result
 */
async function processReviewAnalysis(reviewText, rating = 3) {
  console.log('Starting AI analysis with Ollama...');

  try {
    // Check if Ollama is running
    const ollamaRunning = await isOllamaRunning();
    if (!ollamaRunning) {
      throw new Error('Ollama server is not running on ' + OLLAMA_API_URL);
    }

    // Run all analyses in parallel
    const [legitimacyAnalysis, sentimentAnalysis, moderationAnalysis] = await Promise.all([
      analyzeReview(reviewText),
      analyzeSentiment(reviewText),
      detectModerationFlags(reviewText)
    ]);

    // Combine results
    const analysis = {
      timestamp: new Date(),
      model: OLLAMA_MODEL,
      status: 'analyzed',
      review: {
        text: reviewText.substring(0, 500), // Store first 500 chars
        rating: rating,
        length: reviewText.length
      },
      legitimacy: legitimacyAnalysis,
      sentiment: sentimentAnalysis,
      moderation: moderationAnalysis,
      recommendation: {
        approve: legitimacyAnalysis.legitimate && !moderationAnalysis.requires_moderation,
        reason: generateRecommendation(legitimacyAnalysis, moderationAnalysis)
      }
    };

    console.log('Analysis complete:', {
      approve: analysis.recommendation.approve,
      sentiment: analysis.sentiment.sentiment,
      flags: analysis.moderation.flags
    });

    return analysis;
  } catch (error) {
    console.error('Complete analysis failed:', error.message);
    return {
      timestamp: new Date(),
      status: 'error',
      error: error.message,
      review: { text: reviewText.substring(0, 500) },
      recommendation: {
        approve: null,
        reason: 'Analysis failed - manual review required'
      }
    };
  }
}

/**
 * Generate recommendation based on analyses
 * @private
 */
function generateRecommendation(legitimacy, moderation) {
  if (!legitimacy.legitimate) {
    return 'Fake or spam review detected';
  }
  if (moderation.requires_moderation) {
    return `Review flagged for: ${moderation.flags.join(', ')} (${moderation.severity})`;
  }
  if (legitimacy.offensive) {
    return 'Contains offensive language';
  }
  return 'Safe to publish';
}

/**
 * Batch analyze multiple reviews
 * @param {array} reviews - Array of {text, rating}
 * @returns {Promise<array>} - Analysis results
 */
async function batchAnalyzeReviews(reviews) {
  console.log(`Batch analyzing ${reviews.length} reviews...`);

  const results = [];
  for (const review of reviews) {
    try {
      const analysis = await processReviewAnalysis(review.text, review.rating);
      results.push({
        review_id: review.id,
        ...analysis
      });

      // Small delay between requests to avoid overwhelming Ollama
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.push({
        review_id: review.id,
        status: 'error',
        error: error.message
      });
    }
  }

  console.log(`Batch analysis complete: ${results.filter(r => r.status === 'analyzed').length} successful`);
  return results;
}

/**
 * Health check - verify Ollama is accessible
 * @returns {Promise<object>} - Health status
 */
async function healthCheck() {
  try {
    const isRunning = await isOllamaRunning();
    
    if (isRunning) {
      // Test a simple analysis
      const testResult = await callOllama('Respond with "OK"');
      
      return {
        status: 'healthy',
        ollama: {
          url: OLLAMA_API_URL,
          model: OLLAMA_MODEL,
          available: true,
          testResponse: testResult.substring(0, 50)
        }
      };
    } else {
      return {
        status: 'unhealthy',
        ollama: {
          url: OLLAMA_API_URL,
          model: OLLAMA_MODEL,
          available: false,
          error: 'Server not responding'
        }
      };
    }
  } catch (error) {
    return {
      status: 'error',
      ollama: {
        url: OLLAMA_API_URL,
        model: OLLAMA_MODEL,
        available: false,
        error: error.message
      }
    };
  }
}

module.exports = {
  analyzeReview,
  analyzeSentiment,
  detectModerationFlags,
  processReviewAnalysis,
  batchAnalyzeReviews,
  healthCheck,
  isOllamaRunning,
  callOllama
};
