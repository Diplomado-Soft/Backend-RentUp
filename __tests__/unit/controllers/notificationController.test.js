const jwt = require('jsonwebtoken');
const { verifyToken } = require('../../../utils/auth');

jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockReturnValue(null),
  generateToken: jest.fn().mockReturnValue('mock.token'),
}));

jest.mock('../../../models/NotificationModel', () => ({
  getForAdmin: jest.fn().mockResolvedValue([]),
  markRead: jest.fn().mockResolvedValue(undefined),
  markAllRead: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../dtos/CreateNotificationDTO', () => {
  return jest.fn().mockImplementation((data) => ({
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    toDatabaseFormat: jest.fn().mockReturnValue(data),
  }));
});

jest.mock('../../../dtos/NotificationDTO', () => ({
  fromDatabase: jest.fn().mockReturnValue({ id: 1 }),
  fromDatabaseList: jest.fn().mockReturnValue([{ id: 1 }]),
}));

describe('Unit Tests - Notification Controller', () => {
  let req, res;
  const NotificationModel = require('../../../models/NotificationModel');
  const { verifyToken } = require('../../../utils/auth');

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 1, rol: 3 },
      params: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getNotifications', () => {
    it('should return 403 if user is not admin', async () => {
      req.user = { id: 1, rol: 1 };
      const { getNotifications } = require('../../../controllers/notificationController');
      await getNotifications(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return notifications for admin', async () => {
      req.user = { id: 1, rol: 3 };
      NotificationModel.getForAdmin.mockResolvedValue([{ id: 1, message: 'Test' }]);

      const { getNotifications } = require('../../../controllers/notificationController');
      await getNotifications(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('markRead', () => {
    it('should return 403 if user is not admin', async () => {
      req.user = { id: 1, rol: 1 };
      req.params.id = '1';
      const { markRead } = require('../../../controllers/notificationController');
      await markRead(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should mark notification as read', async () => {
      req.user = { id: 1, rol: 3 };
      req.params.id = '1';
      NotificationModel.markRead.mockResolvedValue(undefined);

      const { markRead } = require('../../../controllers/notificationController');
      await markRead(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('markAllRead', () => {
    it('should return 403 if user is not admin', async () => {
      req.user = { id: 1, rol: 1 };
      const { markAllRead } = require('../../../controllers/notificationController');
      await markAllRead(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should mark all notifications as read', async () => {
      req.user = { id: 1, rol: 3 };
      NotificationModel.markAllRead.mockResolvedValue(undefined);

      const { markAllRead } = require('../../../controllers/notificationController');
      await markAllRead(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
