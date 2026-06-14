import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityQueryDto } from './activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Activity')
@ApiBearerAuth('JWT-auth')
@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  // GET /api/activity — all logs (paginated + filtered)
  @Get()
  @ApiOperation({ summary: 'Get activity logs with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Returns a list of activity logs' })
  findAll(@CurrentUser() user: any, @Query() dto: ActivityQueryDto) {
    return this.activityService.findAll(
      user.role,
      user.userId,
      user.companyId,
      dto,
    );
  }

  // GET /api/activity/summary — action counts summary (ADMIN/HR)
  @Get('summary')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get summary of activity counts by action type' })
  @ApiResponse({ status: 200, description: 'Returns counts of activity actions' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
  getSummary(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ) {
    return this.activityService.getActionSummary(
      user.companyId,
      parseInt(days ?? '7'),
    );
  }

  // GET /api/activity/chart — daily chart data (ADMIN/HR)
  @Get('chart')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get daily activity chart data' })
  @ApiResponse({ status: 200, description: 'Returns daily activity data for line/bar charts' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
  getDailyChart(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ) {
    return this.activityService.getDailyChart(
      user.companyId,
      parseInt(days ?? '30'),
    );
  }

  // GET /api/activity/failed-logins — security monitor (ADMIN/HR)
  @Get('failed-logins')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get list of failed login attempts' })
  @ApiResponse({ status: 200, description: 'Returns list of failed login logs' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
  getFailedLogins(@CurrentUser() user: any) {
    return this.activityService.getFailedLogins(user.companyId);
  }

  // GET /api/activity/user/:userId — full user history (ADMIN/HR)
  @Get('user/:userId')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get activity history for a specific user' })
  @ApiResponse({ status: 200, description: 'Returns list of activity logs for the target user' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
  getUserHistory(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.activityService.getUserHistory(userId, user.companyId);
  }
}

