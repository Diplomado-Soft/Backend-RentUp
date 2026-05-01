process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.JWT_EXPIRES = '1h';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.FRONTEND_URL = 'http://localhost:3000';

jest.setTimeout(30000);

beforeAll(() => {
  console.log('🚀 Starting tests...');
});

afterAll(() => {
  console.log('✅ Tests completed');
});
