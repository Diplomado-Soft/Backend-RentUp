const { validationResult, body, param } = require('express-validator');

/**
 * Middleware para validar resultados de express-validator
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Datos inválidos',
            details: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

/**
 * Validaciones para creación de usuario (signup)
 */
const signupValidation = [
    body('nombre')
        .trim()
        .isLength({ min: 2 })
        .withMessage('El nombre debe tener al menos 2 caracteres'),
    body('apellido')
        .trim()
        .isLength({ min: 2 })
        .withMessage('El apellido debe tener al menos 2 caracteres'),
    body('email')
        .trim()
        .isEmail()
        .withMessage('Formato de email inválido')
        .normalizeEmail(),
    body('telefono')
        .trim()
        .custom(value => {
            const digits = value.replace(/\D/g, '');
            if (digits.length < 7 || digits.length > 15) {
                throw new Error('El teléfono debe tener entre 7 y 15 dígitos');
            }
            return true;
        }),
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('rolId')
        .isInt({ min: 1 })
        .withMessage('rolId debe ser un número entero válido'),
    validate
];

/**
 * Validaciones para actualización de usuario
 */
const updateUserValidation = [
    body('nombre')
        .trim()
        .isLength({ min: 2 })
        .withMessage('El nombre debe tener al menos 2 caracteres'),
    body('apellido')
        .trim()
        .isLength({ min: 2 })
        .withMessage('El apellido debe tener al menos 2 caracteres'),
    body('email')
        .trim()
        .isEmail()
        .withMessage('Formato de email inválido')
        .normalizeEmail(),
    body('telefono')
        .trim()
        .custom(value => {
            const digits = value.replace(/\D/g, '');
            if (digits.length < 7 || digits.length > 15) {
                throw new Error('El teléfono debe tener entre 7 y 15 dígitos');
            }
            return true;
        }),
    body('rol')
        .isInt({ min: 1 })
        .withMessage('El rol debe ser un número entero válido'),
    body('password')
        .optional()
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres'),
    validate
];

/**
 * Validaciones para creación de apartamento
 */
const createApartmentValidation = [
    body('barrio')
        .trim()
        .isLength({ min: 2 })
        .withMessage('Barrio es requerido y debe tener al menos 2 caracteres'),
    body('direccion')
        .trim()
        .isLength({ min: 5 })
        .withMessage('Dirección es requerida y debe tener al menos 5 caracteres'),
    body('price')
        .isFloat({ min: 0.01 })
        .withMessage('Precio debe ser un número válido mayor a 0'),
    body('addInfo')
        .trim()
        .isLength({ min: 10 })
        .withMessage('Información adicional debe tener al menos 10 caracteres'),
    body('latitud')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitud inválida'),
    body('longitud')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitud inválida'),
    body('bedrooms')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Número de habitaciones inválido'),
    body('bathrooms')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Número de baños inválido'),
    body('area_m2')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Área inválida'),
    validate
];

/**
 * Validaciones para actualización de apartamento
 */
const updateApartmentValidation = [
    body('direccion_apt')
        .trim()
        .isLength({ min: 5 })
        .withMessage('Dirección es requerida y debe tener al menos 5 caracteres'),
    body('barrio')
        .trim()
        .isLength({ min: 2 })
        .withMessage('Barrio es requerido y debe tener al menos 2 caracteres'),
    body('latitud_apt')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitud inválida'),
    body('longitud_apt')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitud inválida'),
    validate
];

module.exports = {
    validate,
    signupValidation,
    updateUserValidation,
    createApartmentValidation,
    updateApartmentValidation
};
