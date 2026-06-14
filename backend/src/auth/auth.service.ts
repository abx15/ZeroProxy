import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './auth.dto';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/schemas/activity-log.schema';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private activityService: ActivityService,
  ) {}

  // ─── Login ───────────────────────────────────────────────
  async login(dto: LoginDto, ipAddress: string = '0.0.0.0', deviceInfo: string = 'Unknown') {
    // 1. Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { company: true },
    });

    if (!user) {
      throw new NotFoundException('No account found with this email.');
    }

    // 2. Check if user is active
    if (!user.isActive) {
      throw new ForbiddenException('Your account has been deactivated. Contact admin.');
    }

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      this.activityService.log({
        userId: user.id,
        companyId: user.companyId,
        userEmail: user.email,
        userName: user.name,
        action: ActivityAction.LOGIN_FAILED,
        status: 'FAILED',
        metadata: { email: dto.email },
        ipAddress,
        deviceInfo,
      }).catch(() => {});
      throw new UnauthorizedException('Incorrect password.');
    }

    // 4. Generate tokens
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    // Save session record in PostgreSQL
    const decoded = this.jwtService.decode(accessToken) as any;
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    // 5. Save refresh token in Redis (TTL = 7 days = 604800 seconds)
    await this.redisService.setEx(`refresh:${user.id}`, refreshToken, 604800);

    this.activityService.log({
      userId: user.id,
      companyId: user.companyId,
      userEmail: user.email,
      userName: user.name,
      action: ActivityAction.LOGIN,
      status: 'SUCCESS',
      ipAddress,
      deviceInfo,
    }).catch(() => {});

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        faceRegistered: user.faceRegistered,
      },
    };
  }

  // ─── Refresh Token ────────────────────────────────────────
  async refresh(userId: string, oldRefreshToken: string) {
    // Get user details for new token payload
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    // Generate new tokens
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    // Rotate — delete old, save new
    await this.redisService.setEx(`refresh:${user.id}`, refreshToken, 604800);

    return { accessToken, refreshToken };
  }

  // ─── Logout ───────────────────────────────────────────────
  async logout(userId: string, accessToken: string) {
    // Decode token to get remaining TTL
    const decoded = this.jwtService.decode(accessToken) as any;
    const now = Math.floor(Date.now() / 1000);
    const ttl = decoded?.exp ? decoded.exp - now : 900; // fallback 15 min

    if (ttl > 0) {
      // Blacklist the access token in Redis
      await this.redisService.setEx(`blacklist:${accessToken}`, '1', ttl);
    }

    // Mark session as inactive in DB
    await this.prisma.session.updateMany({
      where: { token: accessToken },
      data: { isActive: false },
    });

    // Delete refresh token from Redis
    await this.redisService.del(`refresh:${userId}`);

    // Log logout activity
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      this.activityService.log({
        userId: user.id,
        companyId: user.companyId,
        userEmail: user.email,
        userName: user.name,
        action: ActivityAction.LOGOUT,
        status: 'SUCCESS',
      }).catch(() => {});
    }

    return { message: 'Logged out successfully.' };
  }
}
