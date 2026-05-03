/**
 * ReviewDTO - Data Transfer Object para respuestas de reseñas
 */
class ReviewDTO {
    constructor(review) {
        this.id = review.review_id;
        this.reviewer_id = review.reviewer_id;
        this.property_id = review.property_id;
        this.rating = review.rating;
        this.comment = review.comment;
        this.verified_booking = !!review.verified_booking;
        this.created_at = review.created_at;
        this.moderation_flag = review.moderation_flag;
        
        if (review.user_name) {
            this.reviewer = {
                name: review.user_name,
                lastname: review.user_lastname
            };
        }
        
        if (review.direccion_apt) {
            this.property = {
                id: review.property_id,
                direccion: review.direccion_apt,
                barrio: review.barrio
            };
        }
    }

    static fromDatabase(review) {
        return new ReviewDTO(review);
    }

    static fromDatabaseList(reviews) {
        return reviews.map(r => new ReviewDTO(r));
    }
}

module.exports = ReviewDTO;
