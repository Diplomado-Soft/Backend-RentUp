/**
 * Geolocation Routes
 * Endpoints para geocodificación
 */

const express = require('express');
const router = express.Router();
const { geocodeAddress, reverseGeocode } = require('../services/geocodingService');

router.get('/geocode', async (req, res) => {
    try {
        const { address } = req.query;
        
        if (!address) {
            return res.status(400).json({ error: 'Se requiere una dirección' });
        }
        
        const result = await geocodeAddress(address);
        
        if (!result) {
            return res.status(404).json({ error: 'No se encontraron resultados' });
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error en geocode:', error);
        res.status(500).json({ error: 'Error al geocodificar dirección' });
    }
});

router.get('/reverse-geocode', async (req, res) => {
    try {
        const { lat, lng } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Se requieren lat y lng' });
        }
        
        const result = await reverseGeocode(parseFloat(lat), parseFloat(lng));
        
        if (!result) {
            return res.status(404).json({ error: 'No se encontraron resultados' });
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error en reverse-geocode:', error);
        res.status(500).json({ error: 'Error al geocodificar inversamente' });
    }
});

module.exports = router;