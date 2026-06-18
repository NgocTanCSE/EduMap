import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

describe('AuthService', () => {
  let service: AuthService;
  let repo: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    repo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return user with token when credentials are valid', async () => {
      const mockUser = {
        id: 'test-uuid',
        email: 'test@example.com',
        password_hash: 'hashed_password',
      };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(service, 'validatePassword').mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBeDefined();
    });

    it('should throw error when user not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow();
    });
  });

  describe('register', () => {
    it('should create new user', async () => {
      const mockUser = {
        id: 'test-uuid',
        email: 'new@example.com',
        full_name: 'Test User',
      };
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      jest.spyOn(repo, 'create').mockReturnValue(mockUser as User);
      jest.spyOn(repo, 'save').mockResolvedValue(mockUser as User);

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
        full_name: 'Test User',
      });

      expect(result).toBeDefined();
    });

    it('should throw error when email already exists', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ id: 'existing' } as User);

      await expect(
        service.register({
          email: 'existing@example.com',
          password: 'password123',
          full_name: 'Test User',
        }),
      ).rejects.toThrow();
    });
  });
});
