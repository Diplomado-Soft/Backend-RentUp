const User = require('../../../models/userModel');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../../../utils/auth');

jest.mock('../../../models/userModel');
jest.mock('bcryptjs');
jest.mock('../../../utils/auth');

describe('Controller - User Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 1 },
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('getUserData', () => {
    const { getUserData } = require('../../../controllers/userController');

    it('should return user data without password', async () => {
      const mockUser = {
        user_id: 1,
        user_name: 'John',
        user_lastname: 'Doe',
        user_email: 'john@test.com',
        user_password: 'hashed123',
        user_phonenumber: null,
        whatsapp: null,
        profile_image: null,
        rol_id: undefined,
        phone_confirmed: false,
      };
      User.getUserData.mockResolvedValue(mockUser);

      await getUserData(req, res);

      expect(User.getUserData).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user_email: 'john@test.com',
          user_name: 'John',
          user_lastname: 'Doe',
        })
      );
    });

    it('should return 404 if user not found', async () => {
      User.getUserData.mockResolvedValue(null);

      await getUserData(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    it('should return 500 on database error', async () => {
      User.getUserData.mockRejectedValue(new Error('DB error'));

      await getUserData(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error en el servidor' });
    });
  });

  describe('signup', () => {
    const { signup } = require('../../../controllers/userController');

    it('should return 400 if required fields are missing', async () => {
      req.body = { nombre: 'John' };

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Datos de registro inválidos',
          errors: expect.any(Array),
        })
      );
    });

    it('should return 400 for invalid email format', async () => {
      req.body = {
        nombre: 'John',
        apellido: 'Doe',
        email: 'invalid-email',
        telefono: '1234567890',
        password: 'Password123',
        rolId: 1,
      };

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Datos de registro inválidos',
          errors: expect.arrayContaining(['Formato de email inválido']),
        })
      );
    });

    it('should return 409 if user already exists', async () => {
      req.body = {
        nombre: 'John',
        apellido: 'Doe',
        email: 'john@test.com',
        telefono: '1234567890',
        password: 'Password123',
        rolId: 1,
      };
      User.findByEmail.mockResolvedValue({ user_id: 1 });

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'El usuario ya está registrado' });
    });

    it('should create user and return token on successful signup', async () => {
      req.body = {
        nombre: 'John',
        apellido: 'Doe',
        email: 'john@test.com',
        telefono: '1234567890',
        password: 'Password123',
        rolId: 1,
      };
      User.findByEmail.mockResolvedValue(null);
      User.signup.mockResolvedValue({
        user_id: 1,
        user_email: 'john@test.com',
        rol_id: 1,
      });
      generateToken.mockReturnValue('mock.jwt.token');

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Usuario registrado exitosamente',
        user: {
          id: 1,
          email: 'john@test.com',
          rol: 1,
        },
        token: 'mock.jwt.token',
      });
    });
  });

  describe('login', () => {
    const { login } = require('../../../controllers/userController');

    it('should return 400 if email or password missing', async () => {
      req.body = { email: 'test@test.com' };

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email y contraseña requeridos' });
    });

    it('should return 401 if user not found', async () => {
      req.body = { email: 'test@test.com', password: 'Password123' };
      User.findByEmail.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    });

    it('should return 403 if user account is deactivated', async () => {
      req.body = { email: 'test@test.com', password: 'Password123' };
      User.findByEmail.mockResolvedValue({ user_id: 1, is_active: false });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado o cuenta eliminada' });
    });

    it('should return 400 if user uses Google OAuth', async () => {
      req.body = { email: 'test@test.com', password: 'Password123' };
      User.findByEmail.mockResolvedValue({
        user_id: 1,
        user_password: null,
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Este usuario usa Google OAuth, inicie sesión con Google',
      });
    });

    it('should return 401 for invalid password', async () => {
      req.body = { email: 'test@test.com', password: 'WrongPassword' };
      User.findByEmail.mockResolvedValue({
        user_id: 1,
        user_name: 'John',
        user_lastname: 'Doe',
        user_email: 'test@test.com',
        user_password: '$2b$10$hashed',
        rol_id: 1,
      });
      bcrypt.compare.mockResolvedValue(false);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
    });

    it('should return user data and token on successful login', async () => {
      req.body = { email: 'test@test.com', password: 'Password123' };
      User.findByEmail.mockResolvedValue({
        user_id: 1,
        user_name: 'John',
        user_lastname: 'Doe',
        user_email: 'test@test.com',
        user_password: '$2b$10$hashed',
        user_phonenumber: '1234567890',
        rol_id: 2,
      });
      bcrypt.compare.mockResolvedValue(true);
      generateToken.mockReturnValue('mock.jwt.token');

      await login(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Autenticación exitosa',
        user: {
          id: 1,
          nombre: 'John',
          apellido: 'Doe',
          email: 'test@test.com',
          telefono: '1234567890',
          rol: 2,
        },
        token: 'mock.jwt.token',
      });
    });
  });
});
