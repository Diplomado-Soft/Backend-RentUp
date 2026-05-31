const express = require('express');
const request = require('supertest');

jest.mock('../../../utils/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../utils/firebaseService', () => ({
  verifyFirebaseToken: jest.fn().mockRejectedValue(new Error('Invalid token')),
}));

jest.mock('../../../models/RolModel', () => ({
  getAll: jest.fn().mockResolvedValue([{ rol_id: 1, rol: 'usuario' }, { rol_id: 2, rol: 'arrendador' }]),
}));

jest.mock('../../../config/db', () => {
  const mockFn = jest.fn().mockResolvedValue([[]]);
  return { query: mockFn, execute: mockFn };
});

jest.mock('../../../models/userModel', () => ({
  getUserData: jest.fn().mockResolvedValue(null),
  signup: jest.fn().mockResolvedValue({ insertId: 1 }),
  findByEmail: jest.fn().mockResolvedValue(null),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed'),
  genSalt: jest.fn().mockResolvedValue('salt'),
}));

describe('Integration Tests - Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const authRoutes = require('../../../routes/auth');
    app.use('/auth', authRoutes);
  });

  describe('POST /auth/login', () => {
    it('should require Firebase token', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com' });

      // Should fail without Firebase token
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/register', () => {
    it('should return 400 for missing fields', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should require refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/google', () => {
    it('should require Firebase token', async () => {
      const res = await request(app)
        .post('/auth/google')
        .send({ token: 'google-token' });

      // Should fail without valid Firebase token
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });
});
