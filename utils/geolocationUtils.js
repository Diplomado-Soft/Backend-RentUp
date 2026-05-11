/**
 * Utility functions for geolocation calculations
 * Provides Haversine formula for distance calculations,
 * radius checking, and apartment distance sorting.
 */

const locationConfig = require('../config/locationConfig');

let configCache = null;

async function ensureCache() {
    if (!configCache) {
        const coords = await locationConfig.getUniputumayoCoordinates();
        const radius = await locationConfig.getDefaultRadius();
        configCache = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            radiusKm: radius
        };
    }
    return configCache;
}

async function getUniputumayoConfig() {
    const c = await ensureCache();
    return { name: 'Uniputumayo', ...c };
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
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

async function isWithinRadius(lat, lon, radiusKm) {
    if (!lat || !lon) return false;
    const cfg = await ensureCache();
    const dist = calculateDistance(cfg.latitude, cfg.longitude, lat, lon);
    return dist <= (radiusKm || cfg.radiusKm);
}

async function sortByDistanceFromUniputumayo(apartments) {
    const cfg = await ensureCache();
    return apartments.map(apt => {
        const distance = calculateDistance(cfg.latitude, cfg.longitude, apt.latitud_apt, apt.longitud_apt);
        return { ...apt, distance_km: parseFloat(distance.toFixed(2)) };
    }).sort((a, b) => a.distance_km - b.distance_km);
}

module.exports = {
    getUniputumayoConfig,
    calculateDistance,
    isWithinRadius,
    sortByDistanceFromUniputumayo
};
