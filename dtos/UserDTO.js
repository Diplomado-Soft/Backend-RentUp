/**
 * UserDTO - Data Transfer Object para respuestas de usuario
 * Oculta información sensible como contraseñas y Google ID
 * Mantiene nombres de campos originales para compatibilidad con frontend
 */
class UserDTO {
    constructor(user) {
        // Campos originales que espera el frontend
        this.user_id = user.user_id;
        this.user_name = user.user_name;
        this.user_lastname = user.user_lastname;
        this.user_email = user.user_email;
        this.user_phonenumber = user.user_phonenumber;
        this.whatsapp = user.whatsapp || null;
        this.rol_id = user.rol_id;
        this.profile_image = user.profile_image || null;
        this.phone_confirmed = user.phone_confirmed || false;
    }

    static fromDatabase(user) {
        return new UserDTO(user);
    }

    static fromDatabaseList(users) {
        return users.map(user => new UserDTO(user));
    }
}

module.exports = UserDTO;
