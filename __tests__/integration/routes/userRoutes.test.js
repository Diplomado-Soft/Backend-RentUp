const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../../../utils/auth');

jest.mock('../../../utils/firebaseService', () => ({
  verifyFirebaseToken: jest.fn(),
}));

jest.mock('../../../config/db', () => {
  const mockFn = jest.fn().mockResolvedValue([[]]);
  return {
    query: mockFn,
    execute: mockFn,
    getConnection: jest.fn().mockResolvedValue({
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      query: mockFn,
      execute: mockFn,
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    }),
  };
});

jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockReturnValue(null),
  generateToken: jest.fn().mockReturnValue('mock.token'),
}));

jest.mock('../../../models/userModel', () => ({
  getUserData: jest.fn(),
  updateUserData: jest.fn(),
  signup: jest.fn(),
  findByEmail: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed'),
  genSalt: jest.fn().mockResolvedValue('salt'),
}));

describe('Integration Tests - User Routes', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = express();
    app.use(express.json());
    const userRoutes = require('../../../routes/userRoutes');
    app.use('/users', userRoutes);
  });

  describe('POST /users/signup', () => {
    it('should return 400 for missing fields', async () => {
      const res = await request(app)
        .post('/users/signup')
        .send({ nombre: 'John' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/users/signup')
        .send({
          nombre: 'John',
          apellido: 'Doe',
          email: 'invalid',
          telefono: '1234567890',
          password: 'Password123',
          rolId: 1,
        });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /users/login', () => {
    it('should return 400 for missing credentials', async () => {
      const res = await request(app)
        .post('/users/login')
        .send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
    });

    it('should accept login request with valid body structure', async () => {
      const res = await request(app)
        .post('/users/login')
        .send({ email: 'test@test.com', password: 'Password123' });
      expect([200, 401, 500]).toContain(res.status);
    });
  });

  describe('GET /users/getUser', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/users/getUser');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/users/getUser')
        .set('Authorization', 'Bearer invalid');
      expect([401, 500]).toContain(res.status);
    });
  });

  describe('PUT /users/update', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .put('/users/update')
        .send({ nombre: 'Updated' });
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /users/profile', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .put('/users/profile')
        .send({ nombre: 'Updated' });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /users/delete-account', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).delete('/users/delete-account');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /users/update-whatsapp', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .put('/users/update-whatsapp')
        .send({ telefono: '1234567890' });
      expect(res.status).toBe(401);
    });
  });
});
