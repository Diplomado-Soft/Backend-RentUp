/**
 * CreateReviewDTO - DTO para validación de creación de reseñas
 */
class CreateReviewDTO {
    constructor(data) {
        this.reviewer_id = parseInt(data.reviewer_id);
        this.property_id = parseInt(data.property_id);
        this.rating = parseInt(data.rating);
        this.comment = data.comment?.trim();
        this.verified_booking = data.verified_booking || false;
    }

    validate() {
        const errors = [];

        if (!this.reviewer_id || isNaN(this.reviewer_id)) {
            errors.push('reviewer_id debe ser un número válido');
        }

        if (!this.property_id || isNaN(this.property_id)) {
            errors.push('property_id debe ser un número válido');
        }

        if (!this.rating || isNaN(this.rating) || this.rating < 1 || this.rating > 5) {
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
        return {
            reviewer_id: this.reviewer_id,
            property_id: this.property_id,
            rating: this.rating,
            comment: this.comment,
            verified_booking: this.verified_booking
        };
    }
}

module.exports = CreateReviewDTO;
