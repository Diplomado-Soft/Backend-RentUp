const jwt = require('jsonwebtoken');
const { verifyToken } = require('../../../utils/auth');

jest.mock('../../../utils/auth', () => ({
  verifyToken: jest.fn().mockReturnValue(null),
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
  hasUserRentedProperty: jest.fn().mockResolvedValue(null),
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

jest.mock('../../../dtos/CreateContractDTO', () => {
  return jest.fn().mockImplementation((data) => ({
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    toDatabaseFormat: jest.fn().mockReturnValue(data),
  }));
});

jest.mock('../../../dtos/UpdateContractDTO', () => {
  return jest.fn().mockImplementation((data) => ({
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    toDatabaseFormat: jest.fn().mockReturnValue(data),
  }));
});

describe('Unit Tests - Contract Controller', () => {
  let req, res;
  const Contract = require('../../../models/ContractModel');
  const { verifyToken } = require('../../../utils/auth');

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 1, rol: 2 },
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('createContract', () => {
    it('should create contract with valid data', async () => {
      req.user = { id: 1, rol: 2 };
      req.body = {
        id_apt: 1,
        tenant_id: 3,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        monthly_rent: 1500000,
      };

      const { createContract } = require('../../../controllers/contractController');
      await createContract(req, res);
      expect(Contract.create).toHaveBeenCalled();
    });
  });

  describe('getContractById', () => {
    it('should return contract by id', async () => {
      req.params.agreement_id = '1';
      Contract.getById.mockResolvedValue({ agreement_id: 1, status: 'active' });

      const { getContractById } = require('../../../controllers/contractController');
      await getContractById(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ agreement_id: 1 }));
    });

    it('should return 404 if contract not found', async () => {
      req.params.agreement_id = '999';
      Contract.getById.mockResolvedValue(null);

      const { getContractById } = require('../../../controllers/contractController');
      await getContractById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getMyContracts', () => {
    it('should return contracts for landlord', async () => {
      req.user = { id: 1, rol: 2 };
      Contract.getByLandlord.mockResolvedValue([{ agreement_id: 1 }]);

      const { getMyContracts } = require('../../../controllers/contractController');
      await getMyContracts(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return contracts for tenant', async () => {
      req.user = { id: 3, rol: 1 };
      Contract.getByTenant.mockResolvedValue([{ agreement_id: 1 }]);

      const { getMyContracts } = require('../../../controllers/contractController');
      await getMyContracts(req, res);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getLandlordContracts', () => {
    it('should return landlord contracts', async () => {
      Contract.getApartmentContracts.mockResolvedValue([{ agreement_id: 1 }]);

      const { getLandlordContracts } = require('../../../controllers/contractController');
      await getLandlordContracts(req, res);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getAvailableApartments', () => {
    it('should return available apartments', async () => {
      Contract.getAvailableApartments.mockResolvedValue([{ id_apt: 1 }]);

      const { getAvailableApartments } = require('../../../controllers/contractController');
      await getAvailableApartments(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('searchTenants', () => {
    it('should return empty array for short query', async () => {
      req.query.q = 'a';

      const { searchTenants } = require('../../../controllers/contractController');
      await searchTenants(req, res);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should search tenants with valid query', async () => {
      req.query.q = 'john';
      Contract.searchTenants.mockResolvedValue([{ user_id: 1, user_name: 'John' }]);

      const { searchTenants } = require('../../../controllers/contractController');
      await searchTenants(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('updateContractStatus', () => {
    it('should update contract status', async () => {
      req.params.agreement_id = '1';
      req.body = { status: 'expired' };
      Contract.updateStatus.mockResolvedValue({ affectedRows: 1 });

      const { updateContractStatus } = require('../../../controllers/contractController');
      await updateContractStatus(req, res);
      expect(Contract.updateStatus).toHaveBeenCalled();
    });
  });

  describe('getMonthlyStats', () => {
    it('should return monthly stats', async () => {
      Contract.getMonthlyStats.mockResolvedValue({ total_contracts: 5, active: 3 });

      const { getMonthlyStats } = require('../../../controllers/contractController');
      await getMonthlyStats(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total_contracts: 5 }));
    });
  });

  describe('expireOldContracts', () => {
    it('should expire old contracts', async () => {
      Contract.expireOldContracts.mockResolvedValue(3);

      const { expireOldContracts } = require('../../../controllers/contractController');
      await expireOldContracts(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ expiredCount: 3 }));
    });
  });
});
