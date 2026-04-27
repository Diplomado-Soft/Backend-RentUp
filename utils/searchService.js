/**
 * Search Service for apartments based on location and distance
 * Sprint #24: Uniputumayo reference coordinates and search radius
 * 
 * Handles apartment filtering by distance from Uniputumayo
 */

const { LOCATION_CONFIG, isValidRadius } = require('../config/locationConfig');
const { calculateDistance, isWithinRadius, sortByDistanceFromUniputumayo } = require('./geolocationUtils');

/**
 * Filter apartments by distance from Uniputumayo
 * @param {Array} apartments - Array of apartment objects
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Array} Apartments within the specified radius
 */
function filterApartmentsByDistance(apartments, radiusKm = LOCATION_CONFIG.DEFAULT_RADIUS_KM) {
    if (!isValidRadius(radiusKm)) {
        throw new Error(`Invalid radius. Must be between 0.5 and 50 km. Received: ${radiusKm}`);
    }

    return apartments.filter(apt => {
        if (!apt.latitud_apt || !apt.longitud_apt) {
            return false;
        }
        return isWithinRadius(apt.latitud_apt, apt.longitud_apt, radiusKm);
    });
}

/**
 * Get apartment search results sorted by distance
 * @param {Array} apartments - Array of apartment objects
 * @param {number} radiusKm - Search radius in kilometers (optional)
 * @returns {Array} Apartments sorted by distance with distance_km property
 */
function getApartmentsByDistance(apartments, radiusKm = LOCATION_CONFIG.DEFAULT_RADIUS_KM) {
    if (!isValidRadius(radiusKm)) {
        throw new Error(`Invalid radius. Must be between 0.5 and 50 km. Received: ${radiusKm}`);
    }

    const filtered = filterApartmentsByDistance(apartments, radiusKm);
    return sortByDistanceFromUniputumayo(filtered);
}

/**
 * Calculate distance from apartment to Uniputumayo
 * @param {Object} apartment - Apartment object with latitud_apt and longitud_apt
 * @returns {number} Distance in kilometers
 */
function getDistanceToUniputumayo(apartment) {
    if (!apartment.latitud_apt || !apartment.longitud_apt) {
        return null;
    }

    return calculateDistance(
        LOCATION_CONFIG.UNIPUTUMAYO.latitude,
        LOCATION_CONFIG.UNIPUTUMAYO.longitude,
        apartment.latitud_apt,
        apartment.longitud_apt
    );
}

/**
 * Get available search radius options
 * @returns {Object} All predefined radius options
 */
function getSearchRadiusOptions() {
    return LOCATION_CONFIG.SEARCH_RADIUS;
}

/**
 * Get search summary with reference location info
 * @returns {Object} Summary of search configuration
 */
function getSearchConfiguration() {
    return {
        referenceLocation: LOCATION_CONFIG.UNIPUTUMAYO,
        availableRadii: LOCATION_CONFIG.SEARCH_RADIUS,
        defaultRadius: LOCATION_CONFIG.DEFAULT_RADIUS_KM,
        verification: LOCATION_CONFIG.VERIFICATION
    };
}

module.exports = {
    filterApartmentsByDistance,
    getApartmentsByDistance,
    getDistanceToUniputumayo,
    getSearchRadiusOptions,
    getSearchConfiguration
};
