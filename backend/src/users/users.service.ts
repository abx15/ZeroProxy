import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, PaginationDto } from './users.dto';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/schemas/activity-log.schema';
import { EventsGateway } from '../events/events.gateway';

// Helper to strip password from user object
const excludePassword = (user: any) => {
  const { password, ...rest } = user;
  return rest;
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService,
    private eventsGateway: EventsGateway,
  ) { }

  // ─── Create User ──────────────────────────────────────────
  async create(dto: CreateUserDto, requesterId?: string) {
    // Check email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role ?? 'EMPLOYEE',
        companyId: dto.companyId,
      },
      include: { company: { select: { name: true, slug: true } } },
    });

    if (requesterId) {
      const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
      if (requester) {
        this.activityService.log({
          userId: requester.id,
          companyId: requester.companyId,
          userEmail: requester.email,
          userName: requester.name,
          action: ActivityAction.USER_CREATED,
          status: 'SUCCESS',
          targetUserId: user.id,
          targetUserEmail: user.email,
          metadata: { createdUserEmail: dto.email },
        }).catch(() => { });
      }
    }

    this.eventsGateway.emitUserCreated(dto.companyId, {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
    });

    return excludePassword(user);
  }

  // ─── Get All Users (paginated) ────────────────────────────
  async findAll(requesterCompanyId: string, dto: PaginationDto) {
    const { page = 1, limit = 10, search, role, isActive } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId: requesterCompanyId, // always filter by same company
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          faceRegistered: true,
          createdAt: true,
          updatedAt: true,
          company: { select: { name: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get One User ─────────────────────────────────────────
  async findOne(id: string, requesterId: string, requesterRole: string) {
    // EMPLOYEE can only view themselves
    if (requesterRole === 'EMPLOYEE' && id !== requesterId) {
      throw new ForbiddenException('You can only view your own profile.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        company: { select: { name: true, slug: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    return excludePassword(user);
  }

  // ─── Update User ──────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateUserDto,
    requesterId: string,
    requesterRole: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');

    let updateData: any = {};

    if (requesterRole === 'EMPLOYEE') {
      // Employee can only update their own name
      if (id !== requesterId) {
        throw new ForbiddenException('You can only update your own profile.');
      }
      if (dto.name) updateData.name = dto.name;
      // Ignore isActive and role changes from employee
    } else {
      // ADMIN or HR can update name, isActive, role
      if (dto.name) updateData.name = dto.name;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
      if (dto.role) updateData.role = dto.role;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        faceRegistered: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  // ─── Change Password ──────────────────────────────────────
  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');

    // Verify current password
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    // Hash and update new password
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    this.activityService.log({
      userId: user.id,
      companyId: user.companyId,
      userEmail: user.email,
      userName: user.name,
      action: ActivityAction.PASSWORD_CHANGED,
      status: 'SUCCESS',
    }).catch(() => { });

    return { message: 'Password changed successfully.' };
  }

  // ─── Soft Delete ──────────────────────────────────────────
  async softDelete(id: string, requesterRole: string, requesterId?: string) {
    if (requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN can deactivate users.');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');

    await this.prisma.user.update({
      where: { id },
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
          action: ActivityAction.USER_DEACTIVATED,
          status: 'SUCCESS',
          targetUserId: user.id,
          targetUserEmail: user.email,
        }).catch(() => { });
      }
    }

    this.eventsGateway.emitUserDeactivated(user.companyId, {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    });

    return { message: `User "${user.name}" has been deactivated.` };
  }

  // ─── Get User Stats (for admin dashboard) ─────────────────
  async getStats(companyId: string) {
    const [total, active, admins, employees, faceRegistered] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { companyId } }),
      this.prisma.user.count({ where: { companyId, isActive: true } }),
      this.prisma.user.count({ where: { companyId, role: 'ADMIN' } }),
      this.prisma.user.count({ where: { companyId, role: 'EMPLOYEE' } }),
      this.prisma.user.count({ where: { companyId, faceRegistered: true } }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      admins,
      employees,
      faceRegistered,
      faceNotRegistered: total - faceRegistered,
    };
  }
}
