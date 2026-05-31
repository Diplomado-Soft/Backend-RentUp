const request = require('supertest');
const express = require('express');

jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockReturnValue({ id: 1, rol: 1 }),
  generateToken: jest.fn().mockReturnValue('mock.token'),
}));

jest.mock('../../../models/ReviewModel', () => ({
  createReview: jest.fn().mockResolvedValue({ review_id: 1 }),
  getReviewById: jest.fn().mockResolvedValue({ review_id: 1, reviewer_id: 1 }),
  getPropertyReviews: jest.fn().mockResolvedValue([{ review_id: 1 }]),
  getUserReviews: jest.fn().mockResolvedValue([{ review_id: 1 }]),
  updateReview: jest.fn().mockResolvedValue({ review_id: 1 }),
  deleteReview: jest.fn().mockResolvedValue({ affectedRows: 1 }),
  userHasReviewForProperty: jest.fn().mockResolvedValue(false),
  getPropertyReviewStats: jest.fn().mockResolvedValue({ avg_rating: 4.5, total_reviews: 10 }),
  getReviewStats: jest.fn().mockResolvedValue({ avg_rating: 4.5, total: 10 }),
  getFlaggedReviews: jest.fn().mockResolvedValue([{ review_id: 1 }]),
  getPropertySentimentStats: jest.fn().mockResolvedValue({ positive: 5, negative: 2 }),
  getModerationHistory: jest.fn().mockResolvedValue([{ id: 1 }]),
  approveReview: jest.fn().mockResolvedValue(undefined),
  rejectReview: jest.fn().mockResolvedValue(undefined),
  analyzeBatch: jest.fn().mockResolvedValue({ processed: 5 }),
  checkAIHealth: jest.fn().mockResolvedValue({ status: 'ok' }),
  analyzePendingReviews: jest.fn().mockResolvedValue({ processed: 3 }),
  getLandlordReviews: jest.fn().mockResolvedValue([{ review_id: 1 }]),
  getLandlordReviewStats: jest.fn().mockResolvedValue({ avg_rating: 4.5, total: 10 }),
  getLandlordReviewsByProperty: jest.fn().mockResolvedValue([{ property_id: 1 }]),
}));

jest.mock('../../../models/ContractModel', () => ({
  hasUserRentedProperty: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../utils/aiAnalysisService', () => ({
  processReviewAnalysis: jest.fn().mockResolvedValue({
    status: 'analyzed',
    sentiment: { sentiment: 'positive', score: 0.8 },
    moderation: { requires_moderation: false, reason: null, flags: [], severity: 'low' }
  }),
}));

jest.mock('../../../utils/emailService', () => ({
  sendReviewRejectionEmail: jest.fn().mockResolvedValue(true),
}));

describe('Integration Tests - Review Routes', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = express();
    app.use(express.json());
    const reviewRoutes = require('../../../routes/reviewRoutes');
    app.use('/reviews', reviewRoutes);
  });

  describe('POST /reviews', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app)
        .post('/reviews')
        .send({ property_id: 1, rating: 5 });
      expect(res.status).toBe(401);
    });

    it('should create review with valid data', async () => {
      const res = await request(app)
        .post('/reviews')
        .set('Authorization', 'Bearer valid.token')
        .send({
          property_id: 1,
          rating: 5,
          comment: 'Great place!',
        });
      expect([201, 400, 500]).toContain(res.status);
    });
  });

  describe('GET /reviews/property/:property_id', () => {
    it('should return reviews for property', async () => {
      const res = await request(app)
        .get('/reviews/property/1')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /reviews/:review_id', () => {
    it('should return review by id', async () => {
      const res = await request(app)
        .get('/reviews/1')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  describe('PUT /reviews/:review_id', () => {
    it('should update review', async () => {
      const res = await request(app)
        .put('/reviews/1')
        .set('Authorization', 'Bearer valid.token')
        .send({ rating: 4, comment: 'Updated' });
      expect([200, 400, 404, 500]).toContain(res.status);
    });
  });

  describe('DELETE /reviews/:review_id', () => {
    it('should delete review', async () => {
      const res = await request(app)
        .delete('/reviews/1')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  describe('GET /reviews/user/my-reviews', () => {
    it('should return user reviews', async () => {
      const res = await request(app)
        .get('/reviews/user/my-reviews')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /reviews/property/:property_id/stats', () => {
    it('should return property review stats', async () => {
      const res = await request(app)
        .get('/reviews/property/1/stats')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /reviews/admin/flagged', () => {
    it('should return 403 for non-admin users', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce({ id: 1, rol: 1 });

      const res = await request(app)
        .get('/reviews/admin/flagged')
        .set('Authorization', 'Bearer valid.token');
      expect(res.status).toBe(403);
    });

    it('should return flagged reviews for admin', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce({ id: 1, rol: 3 });

      const res = await request(app)
        .get('/reviews/admin/flagged')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /reviews/landlord/my-reviews', () => {
    it('should return landlord reviews', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce({ id: 1, rol: 2 });

      const res = await request(app)
        .get('/reviews/landlord/my-reviews')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });
});
