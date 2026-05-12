const isLandlord = (req, res, next) => {
    const userRole = req.user?.rol;
    if (req.user && (userRole === 2 || userRole === '2')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        error: 'Acceso denegado. Se requieren permisos de arrendador'
    });
};

module.exports = isLandlord;
