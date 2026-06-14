import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityLog, ActivityLogDocument, ActivityAction } from './schemas/activity-log.schema';
import { CreateActivityLogDto, ActivityQueryDto } from './activity.dto';

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(ActivityLog.name)
    private activityModel: Model<ActivityLogDocument>,
  ) {}

  // ─── Create Log (called internally from other services) ───
  async log(dto: CreateActivityLogDto): Promise<void> {
    try {
      await this.activityModel.create({
        ...dto,
        status: dto.status ?? 'SUCCESS',
        metadata: dto.metadata ?? {},
        ipAddress: dto.ipAddress ?? '0.0.0.0',
        deviceInfo: dto.deviceInfo ?? 'Unknown',
      });
    } catch (err) {
      // Never let logging failure break main flow
      console.error('Activity log failed:', err.message);
    }
  }

  // ─── Get Logs (paginated + filtered) ─────────────────────
  async findAll(
    requesterRole: string,
    requesterUserId: string,
    requesterCompanyId: string,
    dto: ActivityQueryDto,
  ) {
    const { page = 1, limit = 20, userId, action, status, startDate, endDate } = dto;
    const skip = (page - 1) * limit;

    const filter: any = {
      companyId: requesterCompanyId,
    };

    // EMPLOYEE can only see own logs
    if (requesterRole === 'EMPLOYEE') {
      filter.userId = requesterUserId;
    } else if (userId) {
      filter.userId = userId;
    }

    if (action) filter.action = action;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      this.activityModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.activityModel.countDocuments(filter),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get Action Summary (Admin Dashboard) ─────────────────
  async getActionSummary(companyId: string, days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const summary = await this.activityModel.aggregate([
      {
        $match: {
          companyId,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] },
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return {
      period: `Last ${days} days`,
      since: since.toISOString(),
      actions: summary.map((s) => ({
        action: s._id,
        total: s.count,
        success: s.successCount,
        failed: s.failedCount,
      })),
    };
  }

  // ─── Get Daily Activity Chart (Admin) ─────────────────────
  async getDailyChart(companyId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const chart = await this.activityModel.aggregate([
      {
        $match: {
          companyId,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
          logins: {
            $sum: { $cond: [{ $eq: ['$action', 'LOGIN'] }, 1, 0] },
          },
          checkIns: {
            $sum: { $cond: [{ $eq: ['$action', 'CHECK_IN'] }, 1, 0] },
          },
          failedLogins: {
            $sum: {
              $cond: [{ $eq: ['$action', 'LOGIN_FAILED'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      period: `Last ${days} days`,
      chart: chart.map((d) => ({
        date: d._id,
        totalActions: d.count,
        logins: d.logins,
        checkIns: d.checkIns,
        failedLogins: d.failedLogins,
      })),
    };
  }

  // ─── Get Recent Failed Logins (Security) ──────────────────
  async getFailedLogins(companyId: string, limit: number = 20) {
    const logs = await this.activityModel
      .find({
        companyId,
        action: ActivityAction.LOGIN_FAILED,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      total: logs.length,
      logs: logs.map((l) => ({
        userEmail: l.userEmail,
        ipAddress: l.ipAddress,
        deviceInfo: l.deviceInfo,
        timestamp: (l as any).createdAt,
        metadata: l.metadata,
      })),
    };
  }

  // ─── Get Single User Full History ─────────────────────────
  async getUserHistory(
    targetUserId: string,
    requesterCompanyId: string,
    limit: number = 50,
  ) {
    const logs = await this.activityModel
      .find({ userId: targetUserId, companyId: requesterCompanyId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      userId: targetUserId,
      total: logs.length,
      history: logs,
    };
  }
}
