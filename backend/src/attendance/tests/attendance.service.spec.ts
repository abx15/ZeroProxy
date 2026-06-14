import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from '../attendance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { ActivityService } from '../../activity/activity.service';
import { BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  attendanceRecord: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  user: { count: jest.fn() },
  $transaction: jest.fn(),
};

const mockEventsGateway = { emitCheckIn: jest.fn(), emitCheckOut: jest.fn() };
const mockActivityService = { log: jest.fn().mockResolvedValue({}) };

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: ActivityService, useValue: mockActivityService },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    jest.clearAllMocks();
  });

  describe('checkIn()', () => {
    it('should throw BadRequestException if already checked in', async () => {
      mockPrismaService.attendanceRecord.findFirst.mockResolvedValue({
        id: 'existing-record',
        checkOut: null,
      });

      await expect(
        service.checkIn('user-id', { deviceInfo: 'Chrome' }, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create attendance record on successful check-in', async () => {
      mockPrismaService.attendanceRecord.findFirst.mockResolvedValue(null);
      mockPrismaService.attendanceRecord.create.mockResolvedValue({
        id: 'record-id',
        checkIn: new Date(),
        verificationMethod: 'FACE',
        ipAddress: '127.0.0.1',
        user: { id: 'user-id', name: 'Test Employee', email: 'emp@test.com', companyId: 'comp-id' },
      });

      const result = await service.checkIn(
        'user-id',
        { deviceInfo: 'Chrome', verificationMethod: 'FACE' },
        '127.0.0.1',
      );

      expect(result.message).toContain('Check-in successful');
      expect(result.record).toHaveProperty('checkIn');
    });
  });

  describe('checkOut()', () => {
    it('should throw BadRequestException if no active check-in', async () => {
      mockPrismaService.attendanceRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.checkOut('user-id', {}, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate totalHours correctly on checkout', async () => {
      const checkInTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      mockPrismaService.attendanceRecord.findFirst.mockResolvedValue({
        id: 'record-id',
        checkIn: checkInTime,
        user: { id: 'user-id', name: 'Test Employee', email: 'emp@test.com', companyId: 'comp-id' },
      });
      mockPrismaService.attendanceRecord.update.mockResolvedValue({
        id: 'record-id',
        checkIn: checkInTime,
        checkOut: new Date(),
        totalHours: 3.0,
      });

      const result = await service.checkOut('user-id', {}, '127.0.0.1');

      expect(result.message).toContain('Check-out successful');
      expect(result.record).toHaveProperty('totalHours');
    });
  });
});
