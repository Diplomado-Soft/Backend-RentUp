/**
 * Location Configuration
 * Define coordinates and search radius for Institución Universitaria del Putumayo (Uniputumayo)
 * 
 * Sprint: #24 - Coordenadas de referencia de Uniputumayo
 * Last verified: April 19, 2026
 * Source: GPS coordinates verification
 */

const LOCATION_CONFIG = {
    // Institución Universitaria del Putumayo
    UNIPUTUMAYO: {
        name: 'Institución Universitaria del Putumayo',
        latitude: -1.1512,
        longitude: -76.6488,
        description: 'Central reference point for apartment searches and distance filters'
    },

    // Default search radius options (in kilometers)
    SEARCH_RADIUS: {
        SMALL: 1,      // 1 km - nearby apartments
        MEDIUM: 2,     // 2 km - walking distance
        LARGE: 5,      // 5 km - short drive
        EXTRA_LARGE: 10 // 10 km - extended area
    },

    // Default radius used if not specified
    DEFAULT_RADIUS_KM: 2,

    // Verification metadata
    VERIFICATION: {
        coordinatesVerified: true,
        verificationDate: '2026-04-19',
        verificationMethod: 'GPS coordinates',
        latitude: -1.1512,
        longitude: -76.6488
    }
};

/**
 * Get Uniputumayo configuration
 * @returns {Object} Uniputumayo location object
 */
function getUniputumayoCoordinates() {
    return {
        latitude: LOCATION_CONFIG.UNIPUTUMAYO.latitude,
        longitude: LOCATION_CONFIG.UNIPUTUMAYO.longitude,
        name: LOCATION_CONFIG.UNIPUTUMAYO.name
    };
}

/**
 * Get available search radius options
 * @returns {Object} All available radius options
 */
function getRadiusOptions() {
    return LOCATION_CONFIG.SEARCH_RADIUS;
}

/**
 * Validate if radius is within allowed range
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean} True if valid
 */
function isValidRadius(radiusKm) {
    const min = 0.5;
    const max = 50;
    return radiusKm >= min && radiusKm <= max;
}

module.exports = {
    LOCATION_CONFIG,
    getUniputumayoCoordinates,
    getRadiusOptions,
    isValidRadius
};
