const jwt = require('jsonwebtoken');
const { verifyToken } = require('../../../utils/auth');

jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockReturnValue(null),
  generateToken: jest.fn().mockReturnValue('mock.token'),
}));

jest.mock('../../../models/userModel', () => ({
  getUserData: jest.fn().mockResolvedValue({ rol_id: 2, estadoVerificacion: 'aprobado' }),
}));

jest.mock('../../../models/ApartmentModel', () => ({
  addApartment: jest.fn().mockResolvedValue({ insertId: 1 }),
  getApartmentById: jest.fn().mockResolvedValue({ id_apt: 1, nombre_apt: 'Test' }),
  getApartmentsByLessor: jest.fn().mockResolvedValue([{ id_apt: 1 }]),
  updateApartment: jest.fn().mockResolvedValue({ affectedRows: 1 }),
  deleteApartment: jest.fn().mockResolvedValue({ affectedRows: 1 }),
  getAllApartments: jest.fn().mockResolvedValue([{ id_apt: 1 }]),
  getMarkersInfo: jest.fn().mockResolvedValue([{ id_apt: 1 }]),
  getApartmentsWithFilter: jest.fn().mockResolvedValue([{ id_apt: 1 }]),
  addImage: jest.fn().mockResolvedValue({ insertId: 1 }),
  getBasicInfo: jest.fn().mockResolvedValue({ id_apt: 1, nombre_apt: 'Test' }),
}));

jest.mock('../../../dtos/ApartmentDTO', () => ({
  CreateApartmentDTO: jest.fn().mockImplementation((data) => ({
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    toDatabaseFormat: jest.fn().mockReturnValue(data),
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

describe('Unit Tests - Apartment Controller', () => {
  let req, res;
  const Apartment = require('../../../models/ApartmentModel');
  const { verifyToken } = require('../../../utils/auth');

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 1, rol: 2 },
      body: {},
      params: {},
      files: [],
      processedFiles: [],
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('addApartment', () => {
    it('should return 401 if user not authenticated', async () => {
      req.user = null;
      const { addApartment } = require('../../../controllers/apartmentController');
      await addApartment(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should create apartment with valid data', async () => {
      const mockFiles = Array.from({ length: 5 }, (_, i) => ({
        s3_key: `test_${i}.jpg`,
        signed_url: `http://test.com/test_${i}.jpg`,
        expires_at: new Date(Date.now() + 86400000),
      }));
      req.body = {
        nombre_apt: 'Test Apartment',
        descripcion_apt: 'Nice place',
        price_apt: 1000,
        id_municipality: 1,
        id_type: 1,
      };
      req.files = Array.from({ length: 5 }, (_, i) => ({ filename: `test_${i}.jpg` }));
      req.processedFiles = mockFiles;

      const { addApartment } = require('../../../controllers/apartmentController');
      await addApartment(req, res);
      expect(Apartment.addApartment).toHaveBeenCalled();
    });
  });

  describe('getApartmentById', () => {
    it('should return apartment by id', async () => {
      req.params.id = '1';
      Apartment.getApartmentById.mockResolvedValue({ id_apt: 1, nombre_apt: 'Test' });

      const { getApartmentById } = require('../../../controllers/apartmentController');
      await getApartmentById(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 if apartment not found', async () => {
      req.params.id = '999';
      Apartment.getApartmentById.mockResolvedValue(null);

      const { getApartmentById } = require('../../../controllers/apartmentController');
      await getApartmentById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getApartmentsByLessor', () => {
    it('should return apartments for owner', async () => {
      req.user = { id: 1, rol: 2 };
      Apartment.getApartmentsByLessor.mockResolvedValue([{ id_apt: 1 }]);

      const { getApartmentsByLessor } = require('../../../controllers/apartmentController');
      await getApartmentsByLessor(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('updateApartment', () => {
    it('should update apartment with valid data', async () => {
      req.params.id_apt = '1';
      req.body = { nombre_apt: 'Updated', price_apt: 2000, existing_images: JSON.stringify([1, 2, 3, 4, 5]) };

      const { updateApartment } = require('../../../controllers/apartmentController');
      await updateApartment(req, res);
      expect(Apartment.updateApartment).toHaveBeenCalled();
    });
  });

  describe('deleteApartment', () => {
    it('should delete apartment', async () => {
      req.params.id_apt = '1';
      req.user = { id: 1 };
      Apartment.deleteApartment.mockResolvedValue({ affectedRows: 1 });

      const { deleteApartment } = require('../../../controllers/apartmentController');
      await deleteApartment(req, res);
      expect(Apartment.deleteApartment).toHaveBeenCalledWith('1', 1);
    });
  });

  describe('getAllApartments', () => {
    it('should return all apartments', async () => {
      Apartment.getAllApartments.mockResolvedValue([{ id_apt: 1 }]);

      const { getAllApartments } = require('../../../controllers/apartmentController');
      await getAllApartments(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('getMarkersInfo', () => {
    it('should return markers info', async () => {
      Apartment.getMarkersInfo.mockResolvedValue([{ id_apt: 1 }]);

      const { getMarkersInfo } = require('../../../controllers/apartmentController');
      await getMarkersInfo(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('getApartmentsFiltered', () => {
    it('should return filtered apartments', async () => {
      req.query = { priceMin: 500, priceMax: 2000 };
      Apartment.getApartmentsWithFilter.mockResolvedValue([{ id_apt: 1 }]);

      const { getApartmentsFiltered } = require('../../../controllers/apartmentController');
      await getApartmentsFiltered(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
  });
});
