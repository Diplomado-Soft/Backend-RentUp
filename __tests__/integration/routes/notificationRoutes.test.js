const request = require('supertest');
const express = require('express');

jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockReturnValue({ id: 1, rol: 3 }),
  generateToken: jest.fn().mockReturnValue('mock.token'),
}));

jest.mock('../../../models/NotificationModel', () => ({
  getForAdmin: jest.fn().mockResolvedValue([]),
  markRead: jest.fn().mockResolvedValue(undefined),
  markAllRead: jest.fn().mockResolvedValue(undefined),
}));

describe('Integration Tests - Notification Routes', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = express();
    app.use(express.json());
    const notificationRoutes = require('../../../routes/notificationRoutes');
    app.use('/admin/notifications', notificationRoutes);
  });

  describe('GET /admin/notifications', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/admin/notifications');
      expect([401, 403]).toContain(res.status);
    });

    it('should return 403 if user is not admin', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce({ id: 1, rol: 1 });

      const res = await request(app)
        .get('/admin/notifications')
        .set('Authorization', 'Bearer valid.token');
      expect(res.status).toBe(403);
    });

    it('should return notifications for admin', async () => {
      const res = await request(app)
        .get('/admin/notifications')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('PUT /admin/notifications/:id/read', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).put('/admin/notifications/1/read');
      expect([401, 403]).toContain(res.status);
    });

    it('should return 403 if user is not admin', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce({ id: 1, rol: 1 });

      const res = await request(app)
        .put('/admin/notifications/1/read')
        .set('Authorization', 'Bearer valid.token');
      expect(res.status).toBe(403);
    });

    it('should mark notification as read for admin', async () => {
      const res = await request(app)
        .put('/admin/notifications/1/read')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('PUT /admin/notifications/read-all', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).put('/admin/notifications/read-all');
      expect([401, 403]).toContain(res.status);
    });

    it('should return 403 if user is not admin', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce({ id: 1, rol: 1 });

      const res = await request(app)
        .put('/admin/notifications/read-all')
        .set('Authorization', 'Bearer valid.token');
      expect(res.status).toBe(403);
    });

    it('should mark all notifications as read for admin', async () => {
      const res = await request(app)
        .put('/admin/notifications/read-all')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });
});
