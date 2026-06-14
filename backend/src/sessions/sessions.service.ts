import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/schemas/activity-log.schema';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private jwtService: JwtService,
    private activityService: ActivityService,
    private eventsGateway: EventsGateway,
  ) {}

  // ─── Get My Active Sessions ───────────────────────────────
  async getMySessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, isActive: true },
      orderBy: { lastActivity: 'desc' },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        lastActivity: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return {
      total: sessions.length,
      sessions,
    };
  }

  // ─── Get All Sessions (Admin) ─────────────────────────────
  async getAllSessions(companyId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        isActive: true,
        user: { companyId },
      },
      orderBy: { lastActivity: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return {
      total: sessions.length,
      sessions: sessions.map((s) => ({
        id: s.id,
        user: s.user,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        lastActivity: s.lastActivity,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      })),
    };
  }

  // ─── Get Sessions by User (Admin) ─────────────────────────
  async getSessionsByUser(targetUserId: string, requesterCompanyId: string) {
    // Verify target user belongs to same company
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, companyId: requesterCompanyId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found in your company.');
    }

    const sessions = await this.prisma.session.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        isActive: true,
        lastActivity: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return {
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
      total: sessions.length,
      active: sessions.filter((s) => s.isActive).length,
      sessions,
    };
  }

  // ─── Force Logout Single Session (Admin) ──────────────────
  async forceLogoutSession(
    sessionId: string,
    requesterRole: string,
    requesterCompanyId: string,
    requesterId?: string,
  ) {
    if (!['ADMIN', 'HR'].includes(requesterRole)) {
      throw new ForbiddenException('Only ADMIN or HR can force logout.');
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        user: { companyId: requesterCompanyId },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    if (!session.isActive) {
      return { message: 'Session is already inactive.' };
    }

    // Blacklist the token in Redis
    const decoded = this.jwtService.decode(session.token) as any;
    const now = Math.floor(Date.now() / 1000);
    const ttl = decoded?.exp ? decoded.exp - now : 900;

    if (ttl > 0) {
      await this.redisService.setEx(`blacklist:${session.token}`, '1', ttl);
    }

    // Mark session inactive in DB
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    if (requesterId) {
      const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
      if (requester) {
        this.activityService.log({
          userId: requester.id,
          companyId: requester.companyId,
          userEmail: requester.email,
          userName: requester.name,
          action: ActivityAction.SESSION_FORCE_LOGOUT,
          status: 'SUCCESS',
          targetUserId: session.userId,
          targetUserEmail: session.user.email,
          metadata: { sessionId },
        }).catch(() => {});

        this.eventsGateway.emitForceLogout(requesterCompanyId, {
          targetUserId: session.userId,
          targetUserName: session.user?.name ?? 'Unknown',
          byAdminEmail: requester.email,
          sessionId,
          allSessions: false,
        });
      }
    }

    return { message: 'Session has been terminated successfully.' };
  }

  // ─── Force Logout All Sessions of a User (Admin) ──────────
  async forceLogoutAllSessions(
    targetUserId: string,
    requesterRole: string,
    requesterCompanyId: string,
    requesterId?: string,
  ) {
    if (!['ADMIN', 'HR'].includes(requesterRole)) {
      throw new ForbiddenException('Only ADMIN or HR can force logout.');
    }

    // Verify target user belongs to same company
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, companyId: requesterCompanyId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found in your company.');
    }

    // Get all active sessions
    const activeSessions = await this.prisma.session.findMany({
      where: { userId: targetUserId, isActive: true },
    });

    // Blacklist all tokens in Redis
    for (const session of activeSessions) {
      const decoded = this.jwtService.decode(session.token) as any;
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded?.exp ? decoded.exp - now : 900;

      if (ttl > 0) {
        await this.redisService.setEx(`blacklist:${session.token}`, '1', ttl);
      }
    }

    // Also delete refresh token from Redis
    await this.redisService.del(`refresh:${targetUserId}`);

    // Mark all sessions inactive in DB
    await this.prisma.session.updateMany({
      where: { userId: targetUserId, isActive: true },
      data: { isActive: false },
    });

    if (requesterId) {
      const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
      if (requester) {
        this.activityService.log({
          userId: requester.id,
          companyId: requester.companyId,
          userEmail: requester.email,
          userName: requester.name,
          action: ActivityAction.ALL_SESSIONS_FORCE_LOGOUT,
          status: 'SUCCESS',
          targetUserId: targetUser.id,
          targetUserEmail: targetUser.email,
        }).catch(() => {});

        this.eventsGateway.emitForceLogout(requesterCompanyId, {
          targetUserId: targetUserId,
          targetUserName: targetUser.name,
          byAdminEmail: requester.email,
          allSessions: true,
        });
      }
    }

    return {
      message: `All ${activeSessions.length} session(s) for "${targetUser.name}" have been terminated.`,
      terminatedCount: activeSessions.length,
    };
  }

  // ─── Update Last Activity (middleware helper) ──────────────
  async updateLastActivity(token: string) {
    await this.prisma.session.updateMany({
      where: { token, isActive: true },
      data: { lastActivity: new Date() },
    });
  }

  // ─── Cleanup Expired Sessions (cron job) ──────────────────
  async cleanupExpiredSessions() {
    const result = await this.prisma.session.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        isActive: true,
      },
      data: { isActive: false },
    });

    this.activityService.log({
      userId: '00000000-0000-0000-0000-000000000000',
      companyId: '00000000-0000-0000-0000-000000000000',
      userEmail: 'system@zeroproxy.local',
      userName: 'System',
      action: ActivityAction.SESSIONS_CLEANUP,
      status: 'SUCCESS',
      metadata: { count: result.count },
    }).catch(() => {});

    return {
      message: `Cleaned up ${result.count} expired session(s).`,
      count: result.count,
    };
  }

  // ─── Get Live Online Users Count (Admin Dashboard) ────────
  async getLiveStats(companyId: string) {
    const onlineCount = await this.prisma.session.count({
      where: {
        isActive: true,
        user: { companyId },
        lastActivity: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // active in last 5 min
        },
      },
    });

    const totalActive = await this.prisma.session.count({
      where: {
        isActive: true,
        user: { companyId },
      },
    });

    return {
      onlineNow: onlineCount,
      activeSessions: totalActive,
    };
  }
}
