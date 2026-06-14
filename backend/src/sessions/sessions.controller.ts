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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Sessions')
@ApiBearerAuth('JWT-auth')
@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  // GET /api/sessions/me — own active sessions
  @Get('me')
  @ApiOperation({ summary: 'Get all active sessions for current user' })
  @ApiResponse({ status: 200, description: 'Returns own sessions list' })
  getMySessions(@CurrentUser() user: any) {
    return this.sessionsService.getMySessions(user.userId);
  }

  // GET /api/sessions/live — real-time online count (ADMIN/HR)
  @Get('live')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get live stats of online users' })
  @ApiResponse({ status: 200, description: 'Returns counts of online users and active sessions' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
  getLiveStats(@CurrentUser() user: any) {
    return this.sessionsService.getLiveStats(user.companyId);
  }

  // GET /api/sessions — all active sessions in company (ADMIN/HR)
  @Get()
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get all active sessions for company' })
  @ApiResponse({ status: 200, description: 'Returns list of all active sessions' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
  getAllSessions(@CurrentUser() user: any) {
    return this.sessionsService.getAllSessions(user.companyId);
  }

  // GET /api/sessions/user/:userId — sessions of specific user (ADMIN/HR)
  @Get('user/:userId')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get all sessions for a specific user' })
  @ApiResponse({ status: 200, description: 'Returns list of sessions for the target user' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
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
  @ApiOperation({ summary: 'Force logout a specific session' })
  @ApiResponse({ status: 200, description: 'Session terminated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
  @ApiResponse({ status: 404, description: 'Session not found' })
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
  @ApiOperation({ summary: 'Force logout all sessions for a specific user' })
  @ApiResponse({ status: 200, description: 'All user sessions terminated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
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
  @ApiOperation({ summary: 'Clean up expired sessions from database' })
  @ApiResponse({ status: 200, description: 'Cleanup complete' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN role)' })
  cleanup() {
    return this.sessionsService.cleanupExpiredSessions();
  }
}

