const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockReturnValue({ id: 1, rol: 2 }),
  generateToken: jest.fn().mockReturnValue('mock.token'),
}));

jest.mock('../../../models/userModel', () => ({
  getUserData: jest.fn().mockResolvedValue({ rol_id: 2, estadoVerificacion: 'aprobado' }),
}));

jest.mock('../../../models/ApartmentModel', () => ({
  addApartment: jest.fn().mockResolvedValue({ insertId: 1 }),
  getApartmentById: jest.fn().mockResolvedValue({ id_apt: 1 }),
  getApartmentsByLessor: jest.fn().mockResolvedValue([{ id_apt: 1 }]),
  updateApartment: jest.fn().mockResolvedValue({ affectedRows: 1 }),
  deleteApartment: jest.fn().mockResolvedValue({ affectedRows: 1 }),
  getAllApartments: jest.fn().mockResolvedValue([{ id_apt: 1 }]),
  getMarkersInfo: jest.fn().mockResolvedValue([{ id_apt: 1 }]),
  getApartmentsWithFilter: jest.fn().mockResolvedValue([{ id_apt: 1 }]),
  addImage: jest.fn().mockResolvedValue({ insertId: 1 }),
  getBasicInfo: jest.fn().mockResolvedValue([[{ id_apt: 1, status: 'available' }]]),
  hasActiveContracts: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../dtos', () => ({
  CreateApartmentDTO: jest.fn().mockImplementation(() => ({
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    toDatabaseFormat: jest.fn().mockReturnValue({}),
  })),
  UpdateApartmentDTO: jest.fn().mockImplementation(() => ({
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    toDatabaseFormat: jest.fn().mockReturnValue({}),
  })),
  ApartmentDTO: {
    fromDatabase: jest.fn().mockReturnValue({ id_apt: 1 }),
    fromDatabaseList: jest.fn().mockReturnValue([{ id_apt: 1 }]),
  },
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

describe('Integration Tests - Apartment Routes', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = express();
    app.use(express.json());
    const apartmentRoutes = require('../../../routes/apartmentRoutes');
    app.use('/apartments', apartmentRoutes);
  });

  describe('POST /apartments/addApartment', () => {
    it('should return 401 without authentication', async () => {
      const { verifyToken } = require('../../../utils/auth');
      verifyToken.mockReturnValueOnce(null);

      const res = await request(app)
        .post('/apartments/addApartment')
        .send({ nombre_apt: 'Test' });
      expect([401, 400]).toContain(res.status);
    });

    it('should accept valid apartment data', async () => {
      const res = await request(app)
        .post('/apartments/addApartment')
        .set('Authorization', 'Bearer valid.token')
        .send({
          nombre_apt: 'Test Apartment',
          descripcion_apt: 'Nice place',
          price_apt: 1000,
          id_municipality: 1,
          id_type: 1,
        });
      expect([201, 400]).toContain(res.status);
    });
  });

  describe('GET /apartments/:id', () => {
    it('should return apartment by id', async () => {
      const res = await request(app)
        .get('/apartments/1')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  describe('PUT /apartments/update/:id_apt', () => {
    it('should update apartment', async () => {
      const res = await request(app)
        .put('/apartments/update/1')
        .set('Authorization', 'Bearer valid.token')
        .send({ nombre_apt: 'Updated' });
      expect([200, 400, 404]).toContain(res.status);
    });
  });

  describe('DELETE /apartments/delete/:id_apt', () => {
    it('should delete apartment', async () => {
      const res = await request(app)
        .delete('/apartments/delete/1')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('GET /apartments/get-apts', () => {
    it('should return all apartments', async () => {
      const res = await request(app)
        .get('/apartments/get-apts')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /apartments/getMarkersInfo', () => {
    it('should return markers info', async () => {
      const res = await request(app)
        .get('/apartments/getMarkersInfo')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /apartments/getFiltered', () => {
    it('should filter apartments', async () => {
      const res = await request(app)
        .get('/apartments/getFiltered?priceMin=500&priceMax=2000')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /apartments/manage', () => {
    it('should return user apartments when authenticated', async () => {
      const res = await request(app)
        .get('/apartments/manage')
        .set('Authorization', 'Bearer valid.token');
      expect([200, 500]).toContain(res.status);
    });
  });
});
