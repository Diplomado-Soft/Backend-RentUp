const express = require('express');
const request = require('supertest');

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
    it('should return not implemented', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(501);
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
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
