/**
 * Location Configuration
 * Define coordinates and search radius for Institución Universitaria del Putumayo (Uniputumayo)
 * Reads from geolocation_config table with fallback to hardcoded defaults.
 */

const db = require('./db');

const HARDCODED = {
    UNIPUTUMAYO: {
        name: 'Institución Universitaria del Putumayo',
        latitude: -1.1512,
        longitude: -76.6488,
        description: 'Central reference point for apartment searches and distance filters'
    },
    SEARCH_RADIUS: {
        SMALL: 1,
        MEDIUM: 2,
        LARGE: 5,
        EXTRA_LARGE: 10
    },
    DEFAULT_RADIUS_KM: 2
};

let cached = null;

async function loadFromDB() {
    try {
        const [rows] = await db.query(
            'SELECT name, latitude, longitude, radius_km FROM geolocation_config WHERE is_active = 1 LIMIT 1'
        );
        if (rows.length > 0) {
            cached = {
                name: rows[0].name,
                latitude: parseFloat(rows[0].latitude),
                longitude: parseFloat(rows[0].longitude),
                radiusKm: parseFloat(rows[0].radius_km)
            };
            return true;
        }
    } catch (error) {
        console.warn('Error cargando configuración de geolocalización:', error.message);
    }
    return false;
}

async function ensureConfig() {
    if (!cached) {
        const loaded = await loadFromDB();
        if (!loaded) {
            cached = {
                name: HARDCODED.UNIPUTUMAYO.name,
                latitude: HARDCODED.UNIPUTUMAYO.latitude,
                longitude: HARDCODED.UNIPUTUMAYO.longitude,
                radiusKm: HARDCODED.DEFAULT_RADIUS_KM
            };
        }
    }
    return cached;
}

async function getUniputumayoCoordinates() {
    const config = await ensureConfig();
    return {
        latitude: config.latitude,
        longitude: config.longitude,
        name: config.name
    };
}

async function getDefaultRadius() {
    const config = await ensureConfig();
    return config.radiusKm;
}

function getRadiusOptions() {
    return HARDCODED.SEARCH_RADIUS;
}

function isValidRadius(radiusKm) {
    const min = 0.5;
    const max = 50;
    return radiusKm >= min && radiusKm <= max;
}

module.exports = {
    getUniputumayoCoordinates,
    getDefaultRadius,
    getRadiusOptions,
    isValidRadius,
    ensureConfig
};
