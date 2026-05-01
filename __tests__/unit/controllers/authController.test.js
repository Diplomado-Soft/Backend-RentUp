const jwt = require('jsonwebtoken');
const { firebaseLogin } = require('../../../controllers/authController');

jest.mock('../../../utils/firebaseService', () => ({
  verifyFirebaseToken: jest.fn(),
}));

jest.mock('../../../config/db', () => {
  const mockDb = {
    query: jest.fn(),
  };
  return mockDb;
});

describe('Controller - Auth Controller', () => {
  let req, res, db, verifyFirebaseToken;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES = '1h';

    db = require('../../../config/db');
    verifyFirebaseToken = require('../../../utils/firebaseService').verifyFirebaseToken;
  });

  describe('firebaseLogin', () => {
    it('should return 400 if firebaseToken is missing', async () => {
      await firebaseLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Firebase token is required' });
    });

    it('should return 401 if Firebase token verification fails', async () => {
      req.body = { firebaseToken: 'invalid-token' };
      verifyFirebaseToken.mockRejectedValue(new Error('Invalid token'));

      await firebaseLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid Firebase token',
        })
      );
    });

    it('should return 400 if no email in decoded token', async () => {
      req.body = { firebaseToken: 'valid-token' };
      verifyFirebaseToken.mockResolvedValue({ uid: 'abc123' });

      await firebaseLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should create new user if not found in database', async () => {
      const mockFirebaseData = {
        uid: 'abc123',
        email: 'newuser@test.com',
        picture: 'http://example.com/photo.jpg',
      };

      req.body = {
        firebaseToken: 'valid-token',
        rolId: 1,
        nombre: 'John',
        apellido: 'Doe',
      };

      verifyFirebaseToken.mockResolvedValue(mockFirebaseData);

      db.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{
          user_id: 1,
          user_name: 'John',
          user_lastname: 'Doe',
          user_email: 'newuser@test.com',
          user_phonenumber: null,
          whatsapp: null,
          rol_id: 1,
        }]]);

      await firebaseLogin(req, res);

      expect(db.query).toHaveBeenCalledTimes(4);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: expect.any(String),
        })
      );
    });

    it('should return existing user if found in database', async () => {
      const mockFirebaseData = {
        uid: 'abc123',
        email: 'existing@test.com',
      };

      req.body = { firebaseToken: 'valid-token' };
      verifyFirebaseToken.mockResolvedValue(mockFirebaseData);

      db.query
        .mockResolvedValueOnce([[{
          user_id: 5,
          user_name: 'Existing',
          user_lastname: 'User',
          user_email: 'existing@test.com',
          user_google_id: 'abc123',
          profile_image: 'http://example.com/old.jpg',
          rol_id: 2,
        }]])
        .mockResolvedValueOnce([{ affectedRows: 0 }]);

      await firebaseLogin(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.objectContaining({
            id: 5,
            email: 'existing@test.com',
          }),
        })
      );
    });

    it('should handle 500 error on unexpected failures', async () => {
      req.body = { firebaseToken: 'valid-token' };
      verifyFirebaseToken.mockResolvedValue({ uid: 'abc123', email: 'test@test.com' });
      db.query.mockRejectedValue(new Error('Database connection failed'));

      await firebaseLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error',
        })
      );
    });
  });
});
