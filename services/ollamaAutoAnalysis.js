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
}

module.exports = { analyzePendingReviews };