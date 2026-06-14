import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import { EventsGateway } from '../../events/events.gateway';
import { ActivityService } from '../../activity/activity.service';
import { UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock all dependencies
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  session: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock_token'),
  decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 900 }),
  verify: jest.fn(),
};

const mockRedisService = {
  setEx: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
  exists: jest.fn(),
};

const mockEventsGateway = {
  emitUserLogin: jest.fn(),
  emitUserLogout: jest.fn(),
};

const mockActivityService = {
  log: jest.fn().mockResolvedValue({}),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: ActivityService, useValue: mockActivityService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login()', () => {
    const mockUser = {
      id: 'user-uuid-123',
      name: 'Admin User',
      email: 'admin@test.com',
      password: bcrypt.hashSync('Admin@123', 10),
      role: 'ADMIN',
      companyId: 'company-uuid-123',
      isActive: true,
      faceRegistered: false,
      company: { name: 'Test Company' },
    };

    it('should return tokens on successful login', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockRedisService.setEx.mockResolvedValue(undefined);
      mockPrismaService.session.create.mockResolvedValue({});

      const result = await service.login(
        { email: 'admin@test.com', password: 'Admin@123' },
        '127.0.0.1',
        'Chrome/Windows',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'notfound@test.com', password: 'pass' }, '127.0.0.1', 'Chrome'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is inactive', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.login({ email: 'admin@test.com', password: 'Admin@123' }, '127.0.0.1', 'Chrome'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'admin@test.com', password: 'wrongpass' }, '127.0.0.1', 'Chrome'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should save refresh token in Redis on login', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.session.create.mockResolvedValue({});

      await service.login(
        { email: 'admin@test.com', password: 'Admin@123' },
        '127.0.0.1',
        'Chrome',
      );

      expect(mockRedisService.setEx).toHaveBeenCalledWith(
        `refresh:${mockUser.id}`,
        expect.any(String),
        604800,
      );
    });
  });

  describe('logout()', () => {
    it('should blacklist token and delete refresh token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        name: 'Admin',
        email: 'admin@test.com',
        companyId: 'company-123',
      });
      mockPrismaService.session.updateMany.mockResolvedValue({});

      const result = await service.logout('user-123', 'mock_access_token');

      expect(mockRedisService.setEx).toHaveBeenCalledWith(
        'blacklist:mock_access_token',
        '1',
        expect.any(Number),
      );
      expect(mockRedisService.del).toHaveBeenCalledWith('refresh:user-123');
      expect(result.message).toBe('Logged out successfully.');
    });
  });
});
