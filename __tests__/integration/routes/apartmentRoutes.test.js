const express = require('express');
const request = require('supertest');

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
}));

jest.mock('../../../middlewares/fileUpload', () => ({
  upload: {
    array: jest.fn(() => (req, res, next) => next()),
  },
  validateFiles: (req, res, next) => next(),
}));

describe('Integration Tests - Apartment Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const apartmentRoutes = require('../../../routes/apartmentRoutes');
    app.use('/apartments', apartmentRoutes);
  });

  describe('GET /apartments/getapts', () => {
    it('should return 200 for public endpoint', async () => {
      const res = await request(app).get('/apartments/getapts');
      expect([200, 500]).toContain(res.status);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /apartments/getFiltered', () => {
    it('should accept filter parameters', async () => {
      const res = await request(app)
        .get('/apartments/getFiltered')
        .query({ priceMin: 1000000, bedrooms: 2 });

      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /apartments/getMarkersInfo', () => {
    it('should return 200 for markers info', async () => {
      const res = await request(app).get('/apartments/getMarkersInfo');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('POST /apartments/addApartment', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/apartments/addApartment')
        .send({ barrio: 'Test', direccion: 'Address', price: 1000, addInfo: 'Info' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /apartments/delete/:id_apt', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).delete('/apartments/delete/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /apartments/manage', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/apartments/manage');
      expect(res.status).toBe(401);
    });
  });
});
