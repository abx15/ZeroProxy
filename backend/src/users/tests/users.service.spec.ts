import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { ActivityService } from '../../activity/activity.service';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEventsGateway = { emitUserCreated: jest.fn(), emitUserDeactivated: jest.fn() };
const mockActivityService = { log: jest.fn().mockResolvedValue({}) };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: ActivityService, useValue: mockActivityService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create user and return without password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        name: 'Ravi Kumar',
        email: 'ravi@test.com',
        password: 'hashed',
        role: 'EMPLOYEE',
        companyId: 'comp-123',
        isActive: true,
        faceRegistered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        company: { name: 'Test Company', slug: 'test-company' },
      });

      const result = await service.create({
        name: 'Ravi Kumar',
        email: 'ravi@test.com',
        password: 'Ravi@12345',
        companyId: 'comp-123',
      });

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('ravi@test.com');
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({
          name: 'Test',
          email: 'exists@test.com',
          password: 'Pass@123',
          companyId: 'comp-123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne()', () => {
    it('should throw ForbiddenException if employee tries to view others', async () => {
      await expect(
        service.findOne('other-user-id', 'my-user-id', 'EMPLOYEE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id', 'admin-id', 'ADMIN'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete()', () => {
    it('should throw ForbiddenException if non-admin tries to delete', async () => {
      await expect(
        service.softDelete('user-id', 'HR'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
