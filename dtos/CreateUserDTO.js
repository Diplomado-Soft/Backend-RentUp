/**
 * CreateUserDTO - DTO para validación de creación de usuario (signup)
 */
class CreateUserDTO {
    constructor(data) {
        this.nombre = data.nombre?.trim();
        this.apellido = data.apellido?.trim();
        this.email = data.email?.toLowerCase().trim();
        this.telefono = data.telefono?.trim();
        this.password = data.password;
        this.rolId = parseInt(data.rolId);
    }

    validate() {
        const errors = [];

        if (!this.nombre || this.nombre.length < 2) {
            errors.push('El nombre debe tener al menos 2 caracteres');
        }

        if (!this.apellido || this.apellido.length < 2) {
            errors.push('El apellido debe tener al menos 2 caracteres');
        }

        if (!this.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
            errors.push('Formato de email inválido');
        }

        if (!this.telefono) {
            errors.push('El teléfono es requerido');
        } else {
            const digits = this.telefono.replace(/\D/g, '');
            if (digits.length < 7 || digits.length > 15) {
                errors.push('El teléfono debe tener entre 7 y 15 dígitos');
            }
            if (/[a-zA-Z]/.test(this.telefono)) {
                errors.push('El teléfono no debe contener letras');
            }
        }

        if (!this.password || this.password.length < 6) {
            errors.push('La contraseña debe tener al menos 6 caracteres');
        }

        if (!this.rolId || isNaN(this.rolId)) {
            errors.push('rolId debe ser un número válido');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toDatabaseFormat() {
        return {
            nombre: this.nombre,
            apellido: this.apellido,
            email: this.email,
            telefono: this.telefono,
            password: this.password,
            rolId: this.rolId
        };
    }
}

module.exports = CreateUserDTO;
