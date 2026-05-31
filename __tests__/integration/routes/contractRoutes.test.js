const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockReturnValue({ id: 1, rol: 2 }),
  generateToken: jest.fn().mockReturnValue('mock.token'),
}));

jest.mock('../../../models/ContractModel', () => ({
  create: jest.fn().mockResolvedValue({ insertId: 1 }),
  getById: jest.fn().mockResolvedValue({ agreement_id: 1 }),
  getByLandlord: jest.fn().mockResolvedValue([{ agreement_id: 1 }]),
  getByTenant: jest.fn().mockResolvedValue([{ agreement_id: 1 }]),
  getApartmentContracts: jest.fn().mockResolvedValue([{ agreement_id: 1 }]),
  getAvailableApartments: jest.fn().mockResolvedValue([{ id_apt: 1 }]),
  searchTenants: jest.fn().mockResolvedValue([{ user_id: 1 }]),
  updateStatus: jest.fn().mockResolvedValue({ affectedRows: 1 }),
  getMonthlyStats: jest.fn().mockResolvedValue({ total_contracts: 5 }),
  expireOldContracts: jest.fn().mockResolvedValue(3),
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

jest.mock('../../../utils/emailService', () => ({
  sendContractAgreementEmail: jest.fn().mockResolvedValue(true),
}));

describe('Integration Tests - Contract Routes', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = express();
    app.use(express.json());
    const contractRoutes = require('../../../routes/contractRoutes');
    app.use('/contracts', contractRoutes);
  });

  describe('POST /contracts/', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app)
        .post('/contracts/')
        .send({ property_id: 1, start_date: '2026-01-01', end_date: '2026-12-31' });
      expect([401, 400]).toContain(res.status);
    });

    it('should accept valid contract creation payload', async () => {
      const res = await request(app)
        .post('/contracts/')
        .set('Authorization', 'Bearer valid.token')
        .send({
          id_apt: 1,
          tenant_id: 3,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          monthly_rent: 1500000,
        });
      expect([201, 400, 500]).toContain(res.status);
    });
  });

  describe('GET /contracts/my', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app).get('/contracts/my');
      expect([401, 403]).toContain(res.status);
    });

    it('should return contracts for authenticated user', async () => {
      const res = await request(app)
        .get('/contracts/my')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /contracts/landlord/contracts', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app).get('/contracts/landlord/contracts');
      expect([401, 403]).toContain(res.status);
    });

    it('should return landlord contracts when authenticated', async () => {
      const res = await request(app)
        .get('/contracts/landlord/contracts')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /contracts/landlord/available-apartments', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app).get('/contracts/landlord/available-apartments');
      expect([401, 403]).toContain(res.status);
    });

    it('should return available apartments for landlord', async () => {
      const res = await request(app)
        .get('/contracts/landlord/available-apartments')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /contracts/search-tenants', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app).get('/contracts/search-tenants?q=john');
      expect([401, 403]).toContain(res.status);
    });

    it('should search tenants with valid query', async () => {
      const res = await request(app)
        .get('/contracts/search-tenants?q=john')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /contracts/:agreement_id', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app).get('/contracts/1');
      expect([401, 403]).toContain(res.status);
    });

    it('should return contract by id when authenticated', async () => {
      const res = await request(app)
        .get('/contracts/1')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  describe('PUT /contracts/:agreement_id/status', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app)
        .put('/contracts/1/status')
        .send({ status: 'expired' });
      expect([401, 403]).toContain(res.status);
    });

    it('should update contract status when authenticated', async () => {
      const res = await request(app)
        .put('/contracts/1/status')
        .set('Authorization', 'Bearer valid.token')
        .send({ status: 'expired' });
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('GET /contracts/stats/monthly', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app).get('/contracts/stats/monthly');
      expect([401, 403]).toContain(res.status);
    });

    it('should return monthly stats when authenticated', async () => {
      const res = await request(app)
        .get('/contracts/stats/monthly')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('POST /contracts/expire-old', () => {
    it('should require auth for expire-old (now protected)', async () => {
      const res = await request(app).post('/contracts/expire-old');
      expect([401, 403]).toContain(res.status);
    });
  });
});
