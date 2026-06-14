import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityQueryDto } from './activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  // GET /api/activity — all logs (paginated + filtered)
  @Get()
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
  getFailedLogins(@CurrentUser() user: any) {
    return this.activityService.getFailedLogins(user.companyId);
  }

  // GET /api/activity/user/:userId — full user history (ADMIN/HR)
  @Get('user/:userId')
  @Roles('ADMIN', 'HR')
  getUserHistory(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.activityService.getUserHistory(userId, user.companyId);
  }
}
