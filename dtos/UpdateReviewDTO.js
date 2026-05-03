/**
 * UpdateReviewDTO - DTO para validación de actualización de reseñas
 */
class UpdateReviewDTO {
    constructor(data) {
        this.rating = data.rating ? parseInt(data.rating) : null;
        this.comment = data.comment?.trim();
        this.moderation_flag = data.moderation_flag;
    }

    validate() {
        const errors = [];

        if (this.rating && (isNaN(this.rating) || this.rating < 1 || this.rating > 5)) {
            errors.push('rating debe ser un número entre 1 y 5');
        }

        if (this.comment && this.comment.length > 1000) {
            errors.push('comment no puede exceder 1000 caracteres');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toDatabaseFormat() {
        const data = {};
        if (this.rating) data.rating = this.rating;
        if (this.comment) data.comment = this.comment;
        if (this.moderation_flag !== undefined) data.moderation_flag = this.moderation_flag;
        return data;
    }
}

module.exports = UpdateReviewDTO;
