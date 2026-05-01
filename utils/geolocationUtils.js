/**
 * Utility functions for geolocation calculations
 * Sprint 4 - T-23: Uniputumayo reference coordinates and search radius
 */

const UNIPUTUMAYO_CONFIG = {
    name: 'uniputumayo',
    latitude: 3.341300,
    longitude: -76.529400,
    radiusKm: 2.00
};

function getUniputumayoConfig() {
    return UNIPUTUMAYO_CONFIG;
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Check if a location is within a given radius from Uniputumayo
 * @param {number} lat - Latitude to check
 * @param {number} lon - Longitude to check
 * @param {number} radiusKm - Radius in kilometers (default: 2km)
 * @returns {boolean}
 */
function isWithinRadius(lat, lon, radiusKm = UNIPUTUMAYO_CONFIG.radiusKm) {
    if (!lat || !lon) return false;
    
    const distance = calculateDistance(
        UNIPUTUMAYO_CONFIG.latitude,
        UNIPUTUMAYO_CONFIG.longitude,
        lat,
        lon
    );
    
    return distance <= radiusKm;
}

/**
 * Get apartments sorted by distance from Uniputumayo
 * @param {Array} apartments - Array of apartment objects
 * @returns {Array} Sorted apartments with distance property
 */
function sortByDistanceFromUniputumayo(apartments) {
    return apartments.map(apt => {
        const distance = calculateDistance(
            UNIPUTUMAYO_CONFIG.latitude,
            UNIPUTUMAYO_CONFIG.longitude,
            apt.latitud_apt,
            apt.longitud_apt
        );
        return {
            ...apt,
            distance_km: parseFloat(distance.toFixed(2))
        };
    }).sort((a, b) => a.distance_km - b.distance_km);
}

module.exports = {
    getUniputumayoConfig,
    calculateDistance,
    isWithinRadius,
    sortByDistanceFromUniputumayo,
    UNIPUTUMAYO_CONFIG
};
