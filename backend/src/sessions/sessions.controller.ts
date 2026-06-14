import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { ForceLogoutDto, ForceLogoutAllDto } from './sessions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  // GET /api/sessions/me — own active sessions
  @Get('me')
  getMySessions(@CurrentUser() user: any) {
    return this.sessionsService.getMySessions(user.userId);
  }

  // GET /api/sessions/live — real-time online count (ADMIN/HR)
  @Get('live')
  @Roles('ADMIN', 'HR')
  getLiveStats(@CurrentUser() user: any) {
    return this.sessionsService.getLiveStats(user.companyId);
  }

  // GET /api/sessions — all active sessions in company (ADMIN/HR)
  @Get()
  @Roles('ADMIN', 'HR')
  getAllSessions(@CurrentUser() user: any) {
    return this.sessionsService.getAllSessions(user.companyId);
  }

  // GET /api/sessions/user/:userId — sessions of specific user (ADMIN/HR)
  @Get('user/:userId')
  @Roles('ADMIN', 'HR')
  getSessionsByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: any,
  ) {
    return this.sessionsService.getSessionsByUser(userId, user.companyId);
  }

  // DELETE /api/sessions/:sessionId — force logout one session (ADMIN/HR)
  @Delete(':sessionId')
  @Roles('ADMIN', 'HR')
  @HttpCode(HttpStatus.OK)
  forceLogoutSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: any,
  ) {
    return this.sessionsService.forceLogoutSession(
      sessionId,
      user.role,
      user.companyId,
      user.userId,
    );
  }

  // POST /api/sessions/force-logout-all — force logout all sessions of a user
  @Post('force-logout-all')
  @Roles('ADMIN', 'HR')
  @HttpCode(HttpStatus.OK)
  forceLogoutAll(@Body() dto: ForceLogoutAllDto, @CurrentUser() user: any) {
    return this.sessionsService.forceLogoutAllSessions(
      dto.userId,
      user.role,
      user.companyId,
      user.userId,
    );
  }

  // POST /api/sessions/cleanup — cleanup expired sessions (ADMIN only)
  @Post('cleanup')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  cleanup() {
    return this.sessionsService.cleanupExpiredSessions();
  }
}
