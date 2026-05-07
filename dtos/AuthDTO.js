/**
 * LoginDTO - DTO para validación de login (Firebase)
 */
class LoginDTO {
    constructor(data) {
        this.firebaseToken = data.firebaseToken || data.token;
        this.rolId = data.rolId ? parseInt(data.rolId) : null;
        this.email = data.email?.toLowerCase().trim();
        this.nombre = data.nombre?.trim();
        this.apellido = data.apellido?.trim();
        this.photoURL = data.photoURL || data.profile_image || null;
    }

    validate() {
        const errors = [];

        if (!this.firebaseToken) {
            errors.push('firebaseToken es requerido');
        }

        if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
            errors.push('Formato de email inválido');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toFirebaseFormat() {
        return {
            firebaseToken: this.firebaseToken,
            rolId: this.rolId,
            email: this.email,
            nombre: this.nombre,
            apellido: this.apellido,
            photoURL: this.photoURL
        };
    }
}

/**
 * RefreshTokenDTO - DTO para validación de refresh token
 */
class RefreshTokenDTO {
    constructor(data) {
        this.refreshToken = data.refreshToken || data.refresh_token;
    }

    validate() {
        const errors = [];

        if (!this.refreshToken) {
            errors.push('refreshToken es requerido');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

/**
 * LogoutDTO - DTO para validación de logout
 */
class LogoutDTO {
    constructor(data) {
        this.firebaseToken = data.firebaseToken || data.token;
    }

    validate() {
        const errors = [];

        if (!this.firebaseToken) {
            errors.push('firebaseToken es requerido');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = {
    LoginDTO,
    RefreshTokenDTO,
    LogoutDTO
};
