<<<<<<< HEAD
const axios = require('axios');

async function analyzePendingReviews(options = {}) {
    const { batchSize = 30, delay = 800 } = options;
    
    try {
        const response = await axios.post('http://localhost:9000/reviews/admin/analyze-pending', {
            batchSize,
            delay
        }, { timeout: 300000 });
        
        return {
            success: true,
            analyzed: response.data.analyzed || 0,
            ollamaAvailable: true
        };
    } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.response?.status === 503) {
            return {
                success: false,
                analyzed: 0,
                ollamaAvailable: false
            };
        }
        throw err;
    }
=======
async function analyzePendingReviews(options = {}) {
    return {
        success: false,
        ollamaAvailable: false,
        analyzed: 0
    };
>>>>>>> 33aea86 (feat: add latitude and longitude coordinates to apartment model #27)
}

module.exports = { analyzePendingReviews };