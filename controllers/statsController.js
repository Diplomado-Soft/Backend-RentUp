const Stats = require('../models/statsModel');

const getUserTopApartment = async (req, res) => {
    const userId = req.user?.id;
    console.log("userId", userId);

    try {
        const stats = await Stats.getStats(userId);
        console.log("Resultados de la consulta:", stats);
        
        if (!stats || stats.length === 0) {
            return res.status(200).json([]);
        }
        
        res.status(200).json(stats[0]);
    } catch (error) {
        console.error('Error al obtener las estadísticas:', error); 
        res.status(500).json({ message: "Error al obtener las estadísticas." });
    }
};

const getTopLandlord = async (req, res) => {
    try {
        const topLandlord = await Stats.getTopLandlord();
        console.log("Arrendador/es con más apartamentos publicados:", topLandlord);
        res.status(200).json(topLandlord || []);
    } catch (error) {
        console.error("Error en getTopLandlord controller:", error);
        res.status(500).json({ message: "Error al obtener el arrendador." });
    }
};

const getAdminStats = async (req, res) => {
    try {
        const stats = await Stats.getAdminStats();
        res.status(200).json(stats);
    } catch (error) {
        console.error('Error al obtener estadísticas de admin:', error);
        res.status(500).json({ message: "Error al obtener estadísticas." });
    }
};

const getOccupationTrend = async (req, res) => {
    try {
        const days = req.query.days || 30;
        const data = await Stats.getOccupationTrend(days);
        res.status(200).json(data);
    } catch (error) {
        console.error('Error al obtener tendencia de ocupación:', error);
        res.status(500).json({ message: "Error al obtener tendencia de ocupación." });
    }
};

const getRevenueByZone = async (req, res) => {
    try {
        const data = await Stats.getRevenueByZone();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error al obtener ingresos por zona:', error);
        res.status(500).json({ message: "Error al obtener ingresos por zona." });
    }
};

const getVacancyRate = async (req, res) => {
    try {
        const data = await Stats.getVacancyRate();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error al obtener tasa de vacancia:', error);
        res.status(500).json({ message: "Error al obtener tasa de vacancia." });
    }
};

module.exports = { getUserTopApartment, getTopLandlord, getAdminStats, getOccupationTrend, getRevenueByZone, getVacancyRate };
