const jwt = require('jsonwebtoken');
const { verifyToken } = require('../../../utils/auth');

jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockReturnValue(null),
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

jest.mock('../../../models/NotificationModel', () => ({
  create: jest.fn().mockResolvedValue({ insertId: 1 }),
}));

jest.mock('../../../utils/aiAnalysisService', () => ({
  analyzeReview: jest.fn().mockResolvedValue({ sentiment: 'positive', score: 0.8 }),
}));

jest.mock('../../../dtos/ReviewDTO', () => ({
  CreateReviewDTO: jest.fn().mockImplementation((data) => ({
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    toDatabaseFormat: jest.fn().mockReturnValue(data),
  })),
  UpdateReviewDTO: jest.fn().mockImplementation(() => ({
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    toDatabaseFormat: jest.fn().mockReturnValue({}),
  })),
  ReviewDTO: {
    fromDatabase: jest.fn().mockReturnValue({ review_id: 1 }),
    fromDatabaseList: jest.fn().mockReturnValue([{ review_id: 1 }]),
  },
}));

describe('Unit Tests - Review Controller', () => {
  let req, res;
  const Review = require('../../../models/ReviewModel');
  const { verifyToken } = require('../../../utils/auth');

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 1, rol: 1 },
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('createReview', () => {
    it('should return 401 if user not authenticated', async () => {
      req.user = null;
      const { createReview } = require('../../../controllers/ReviewController');
      await createReview(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should create review with valid data', async () => {
      req.body = {
        property_id: 1,
        rating: 5,
        comment: 'Great place!',
      };
      Review.userHasReviewForProperty.mockResolvedValue(false);
      Review.createReview.mockResolvedValue({ review_id: 1 });

      const { createReview } = require('../../../controllers/ReviewController');
      await createReview(req, res);
      expect(Review.createReview).toHaveBeenCalled();
    });

    it('should return 409 if user already reviewed', async () => {
      req.body = {
        property_id: 1,
        rating: 5,
        comment: 'Great place!',
      };
      Review.userHasReviewForProperty.mockResolvedValue(true);

      const { createReview } = require('../../../controllers/ReviewController');
      await createReview(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('getPropertyReviews', () => {
    it('should return reviews for property', async () => {
      req.params.property_id = '1';
      Review.getPropertyReviews.mockResolvedValue([{ review_id: 1 }]);
      Review.getPropertyReviewStats.mockResolvedValue({ avg_rating: 4.5, total_reviews: 10 });

      const { getPropertyReviews } = require('../../../controllers/ReviewController');
      await getPropertyReviews(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getReview', () => {
    it('should return review by id', async () => {
      req.params.review_id = '1';
      Review.getReviewById.mockResolvedValue({ review_id: 1, rating: 5 });

      const { getReview } = require('../../../controllers/ReviewController');
      await getReview(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 404 if review not found', async () => {
      req.params.review_id = '999';
      Review.getReviewById.mockResolvedValue(null);

      const { getReview } = require('../../../controllers/ReviewController');
      await getReview(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getUserReviews', () => {
    it('should return reviews by reviewer', async () => {
      Review.getUserReviews.mockResolvedValue([{ review_id: 1 }]);

      const { getUserReviews } = require('../../../controllers/ReviewController');
      await getUserReviews(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('updateReview', () => {
    it('should update review with valid data', async () => {
      req.params.review_id = '1';
      req.body = { rating: 4, comment: 'Updated comment' };
      Review.getReviewById.mockResolvedValue({ review_id: 1, reviewer_id: 1 });
      Review.updateReview.mockResolvedValue({ review_id: 1 });

      const { updateReview } = require('../../../controllers/ReviewController');
      await updateReview(req, res);
      expect(Review.updateReview).toHaveBeenCalled();
    });
  });

  describe('deleteReview', () => {
    it('should delete review', async () => {
      req.params.review_id = '1';
      Review.getReviewById.mockResolvedValue({ review_id: 1, reviewer_id: 1 });
      Review.deleteReview.mockResolvedValue({ affectedRows: 1 });

      const { deleteReview } = require('../../../controllers/ReviewController');
      await deleteReview(req, res);
      expect(Review.deleteReview).toHaveBeenCalledWith('1');
    });
  });

  describe('getReviewStats', () => {
    it('should return review stats for property', async () => {
      req.params.property_id = '1';
      Review.getPropertyReviewStats.mockResolvedValue({ avg_rating: 4.5, total_reviews: 10 });

      const { getReviewStats } = require('../../../controllers/ReviewController');
      await getReviewStats(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        success: true,
        data: expect.objectContaining({ avg_rating: 4.5 })
      }));
    });
  });

  describe('getFlaggedReviews', () => {
    it('should return flagged reviews for admin', async () => {
      req.user = { id: 1, rol: 3 };
      Review.getFlaggedReviews.mockResolvedValue([{ review_id: 1 }]);

      const { getFlaggedReviews } = require('../../../controllers/ReviewController');
      await getFlaggedReviews(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getLandlordReviews', () => {
    it('should return landlord reviews', async () => {
      req.user = { id: 1, rol: 2 }; // Role 2 = landlord
      req.params.landlord_id = '1';
      Review.getLandlordReviews.mockResolvedValue([{ review_id: 1 }]);
      Review.getLandlordReviewStats.mockResolvedValue({ avg_rating: 4.5, total: 10 });
      Review.getLandlordReviewsByProperty.mockResolvedValue([{ property_id: 1 }]);

      const { getLandlordReviews } = require('../../../controllers/ReviewController');
      await getLandlordReviews(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 403 for non-landlord users', async () => {
      req.user = { id: 1, rol: 1 }; // Role 1 = tenant, not landlord
      req.params.landlord_id = '1';

      const { getLandlordReviews } = require('../../../controllers/ReviewController');
      await getLandlordReviews(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
