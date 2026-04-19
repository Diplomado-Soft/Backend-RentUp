
const { body, validationResult } = require('express-validator');
const ROLES_PERMITIDOS = [1, 2];

const signupRules = [
    body('nombre')
        .trim()
        .notEmpty().withMessage('El nombre es obligatorio')
        .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('El nombre solo puede contener letras'),

    body('apellido')
        .trim()
        .notEmpty().withMessage('El apellido es obligatorio')
        .isLength({ min: 2, max: 50 }).withMessage('El apellido debe tener entre 2 y 50 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('El apellido solo puede contener letras'),

    body('email')
        .trim()
        .notEmpty().withMessage('El email es obligatorio')
        .isEmail().withMessage('El formato del email no es válido')
        .normalizeEmail(),

    body('telefono')
        .trim()
        .notEmpty().withMessage('El teléfono es obligatorio')
        .matches(/^\+?[\d\s\-]{7,20}$/).withMessage('El formato del teléfono no es válido'),

    body('password')
        .notEmpty().withMessage('La contraseña es obligatoria')
        .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
        .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una mayúscula')
        .matches(/[0-9]/).withMessage('La contraseña debe contener al menos un número'),

    body('rolId')
        .notEmpty().withMessage('El rol es obligatorio')
        .toInt()
        .isInt().withMessage('El rol debe ser un número entero')
        .isIn(ROLES_PERMITIDOS)
        .withMessage(
            `El rol debe ser uno de los siguientes valores: ${ROLES_PERMITIDOS.join(', ')} ` +
            `(1 = usuario, 2 = arrendador)`
        ),
];

/**
 * Detiene la petición si hay errores de validación.
 * Retorna 400 con el listado de errores por campo.
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Datos de registro inválidos',
            campos: errors.array().map(e => ({
                campo:   e.path,
                mensaje: e.msg,
                valor:   e.value,
            })),
        });
    }
    next();
};

module.exports = { signupRules, handleValidationErrors, ROLES_PERMITIDOS };
