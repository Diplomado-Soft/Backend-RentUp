/**
 * ReviewDTO - Data Transfer Object para respuestas de reseñas
 */
class ReviewDTO {
    constructor(review) {
        this.review_id = review.review_id;
        this.reviewer_id = review.reviewer_id;
        this.property_id = review.property_id;
        this.rating = review.rating;
        this.comment = review.comment;
        this.verified_booking = review.verified_booking;
        this.moderation_flag = review.moderation_flag;
        this.created_at = review.created_at;
        this.reviewer_name = review.reviewer_name || null;
    }

    static fromDatabase(review) {
        return new ReviewDTO(review);
    }

    static fromDatabaseList(reviews) {
        return reviews.map(r => new ReviewDTO(r));
    }
}

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

module.exports = {
    ReviewDTO,
    CreateReviewDTO,
    UpdateReviewDTO
};
