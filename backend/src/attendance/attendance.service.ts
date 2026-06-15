import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto, CheckOutDto, AttendanceQueryDto } from './attendance.dto';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/schemas/activity-log.schema';
import { EventsGateway } from '../events/events.gateway';
import { AiService } from '../ai/ai.service';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
    private eventsGateway: EventsGateway,
    private aiService: AiService,
  ) {}

  // ─── Check In ─────────────────────────────────────────────
  async checkIn(userId: string, dto: CheckInDto, ipAddress: string) {
    // If face verification data provided, verify before check-in
    if (dto.imageBase64 && dto.livenessFrames) {
      const faceResult = await this.aiService.faceLoginCheck(
        userId,
        dto.imageBase64,
        dto.livenessFrames,
      );

      if (!faceResult.verified || !faceResult.is_live) {
        throw new UnauthorizedException(
          faceResult.message || 'Face verification failed. Cannot check in.'
        );
      }
    }

    // Check already checked in today (no checkout yet)
    const activeSession = await this.prisma.attendanceRecord.findFirst({
      where: {
        userId,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
    });

    if (activeSession) {
      throw new BadRequestException(
        'You are already checked in. Please check out first.',
      );
    }

    const record = await this.prisma.attendanceRecord.create({
      data: {
        userId,
        checkIn: new Date(),
        ipAddress,
        deviceInfo: dto.deviceInfo,
        verificationMethod: dto.verificationMethod ?? 'FACE',
      },
      include: {
        user: { select: { id: true, name: true, email: true, companyId: true } },
      },
    });

    this.activityService.log({
      userId,
      companyId: record.user.companyId,
      userEmail: record.user.email,
      userName: record.user.name,
      action: ActivityAction.CHECK_IN,
      status: 'SUCCESS',
      ipAddress,
      deviceInfo: dto.deviceInfo,
      metadata: { deviceInfo: dto.deviceInfo, ipAddress },
    }).catch(() => {});

    this.eventsGateway.emitCheckIn(record.user.companyId, {
      userId: record.user.id,
      userName: record.user.name,
      userEmail: record.user.email,
      checkIn: record.checkIn,
      deviceInfo: dto.deviceInfo,
      ipAddress,
    });

    return {
      message: `Welcome ${record.user.name}! Check-in successful.`,
      record: {
        id: record.id,
        checkIn: record.checkIn,
        verificationMethod: record.verificationMethod,
        ipAddress: record.ipAddress,
      },
    };
  }

  // ─── Check Out ────────────────────────────────────────────
  async checkOut(userId: string, dto: CheckOutDto, ipAddress: string) {
    // Find active (no checkout) session
    const activeRecord = await this.prisma.attendanceRecord.findFirst({
      where: {
        userId,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, companyId: true } },
      },
    });

    if (!activeRecord) {
      throw new BadRequestException(
        'No active check-in found. Please check in first.',
      );
    }

    const checkOutTime = new Date();
    const checkInTime = new Date(activeRecord.checkIn);

    // Calculate total hours worked
    const diffMs = checkOutTime.getTime() - checkInTime.getTime();
    const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    const updated = await this.prisma.attendanceRecord.update({
      where: { id: activeRecord.id },
      data: {
        checkOut: checkOutTime,
        totalHours,
      },
    });

    this.activityService.log({
      userId,
      companyId: activeRecord.user.companyId,
      userEmail: activeRecord.user.email,
      userName: activeRecord.user.name,
      action: ActivityAction.CHECK_OUT,
      status: 'SUCCESS',
      ipAddress,
      deviceInfo: activeRecord.deviceInfo,
      metadata: { totalHours },
    }).catch(() => {});

    this.eventsGateway.emitCheckOut(activeRecord.user.companyId, {
      userId: activeRecord.user.id,
      userName: activeRecord.user.name,
      userEmail: activeRecord.user.email,
      checkOut: checkOutTime,
      totalHours,
    });

    return {
      message: `Goodbye ${activeRecord.user.name}! Check-out successful.`,
      record: {
        id: updated.id,
        checkIn: updated.checkIn,
        checkOut: updated.checkOut,
        totalHours: `${totalHours} hours`,
        ipAddress,
      },
    };
  }

  // ─── Get Today's Status ───────────────────────────────────
  async getTodayStatus(userId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const record = await this.prisma.attendanceRecord.findFirst({
      where: {
        userId,
        checkIn: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { checkIn: 'desc' },
    });

    if (!record) {
      return { status: 'NOT_CHECKED_IN', record: null };
    }

    if (record.checkOut === null) {
      // Calculate live working hours
      const now = new Date();
      const diffMs = now.getTime() - new Date(record.checkIn).getTime();
      const liveHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      return {
        status: 'CHECKED_IN',
        record: {
          id: record.id,
          checkIn: record.checkIn,
          checkOut: null,
          liveHours: `${liveHours} hours`,
        },
      };
    }

    return {
      status: 'CHECKED_OUT',
      record: {
        id: record.id,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        totalHours: `${record.totalHours} hours`,
      },
    };
  }

  // ─── Get Attendance Records (paginated) ───────────────────
  async findAll(
    requesterUserId: string,
    requesterRole: string,
    requesterCompanyId: string,
    dto: AttendanceQueryDto,
  ) {
    const { page = 1, limit = 10, userId, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    // EMPLOYEE can only see own records
    if (requesterRole === 'EMPLOYEE') {
      dto.userId = requesterUserId;
    }

    const where: any = {};

    // Filter by userId
    if (dto.userId) {
      where.userId = dto.userId;
    } else {
      // ADMIN/HR: filter by company users only
      where.user = { companyId: requesterCompanyId };
    }

    // Date range filter
    if (startDate || endDate) {
      where.checkIn = {};
      if (startDate) where.checkIn.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.checkIn.lte = end;
      }
    }

    const [records, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { checkIn: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return {
      data: records,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get Summary (Admin Dashboard) ────────────────────────
  async getDailySummary(companyId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Get all company users
    const totalEmployees = await this.prisma.user.count({
      where: { companyId, isActive: true },
    });

    // Get checked-in records for the day
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        checkIn: { gte: dayStart, lte: dayEnd },
        user: { companyId },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { checkIn: 'asc' },
    });

    const checkedIn = records.filter((r) => r.checkOut === null).length;
    const checkedOut = records.filter((r) => r.checkOut !== null).length;
    const absent = totalEmployees - records.length;

    // Calculate average hours for completed sessions
    const completedRecords = records.filter((r) => r.totalHours !== null);
    const avgHours =
      completedRecords.length > 0
        ? parseFloat(
            (
              completedRecords.reduce((sum, r) => sum + (r.totalHours ?? 0), 0) /
              completedRecords.length
            ).toFixed(2),
          )
        : 0;

    return {
      date: targetDate.toISOString().split('T')[0],
      summary: {
        totalEmployees,
        present: records.length,
        absent,
        currentlyCheckedIn: checkedIn,
        checkedOut,
        averageHours: avgHours,
      },
      records: records.map((r) => ({
        userId: r.user.id,
        name: r.user.name,
        email: r.user.email,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        totalHours: r.totalHours,
        status: r.checkOut ? 'CHECKED_OUT' : 'CHECKED_IN',
      })),
    };
  }

  // ─── Get Monthly Report (per user) ────────────────────────
  async getMonthlyReport(userId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        userId,
        checkIn: { gte: startDate, lte: endDate },
      },
      orderBy: { checkIn: 'asc' },
    });

    const workingDays = records.length;
    const totalHours = records.reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
    const avgHoursPerDay = workingDays > 0
      ? parseFloat((totalHours / workingDays).toFixed(2))
      : 0;

    return {
      month,
      year,
      summary: {
        workingDays,
        totalHours: parseFloat(totalHours.toFixed(2)),
        avgHoursPerDay,
      },
      records: records.map((r) => ({
        date: r.checkIn.toISOString().split('T')[0],
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        totalHours: r.totalHours,
        verificationMethod: r.verificationMethod,
      })),
    };
  }
}
