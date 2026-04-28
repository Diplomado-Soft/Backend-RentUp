const Stats = require('../models/statsModel');

const getUserTopApartment = async (req, res) => {
    const userId = req.user?.id || req.user?.user_id;
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

module.exports = { getUserTopApartment, getTopLandlord };
