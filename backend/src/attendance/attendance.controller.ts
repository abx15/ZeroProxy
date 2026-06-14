import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CheckInDto, CheckOutDto, AttendanceQueryDto } from './attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Attendance')
@ApiBearerAuth('JWT-auth')
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  // POST /api/attendance/checkin
  @Post('checkin')
  @ApiOperation({ summary: 'Check in for the day' })
  @ApiResponse({ status: 201, description: 'Check-in successful' })
  @ApiResponse({ status: 400, description: 'Already checked in' })
  checkIn(@Body() dto: CheckInDto, @CurrentUser() user: any, @Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '0.0.0.0';
    return this.attendanceService.checkIn(user.userId, dto, ip);
  }

  // POST /api/attendance/checkout
  @Post('checkout')
  @ApiOperation({ summary: 'Check out for the day' })
  @ApiResponse({ status: 201, description: 'Check-out successful' })
  @ApiResponse({ status: 400, description: 'No active check-in found' })
  checkOut(@Body() dto: CheckOutDto, @CurrentUser() user: any, @Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '0.0.0.0';
    return this.attendanceService.checkOut(user.userId, dto, ip);
  }

  // GET /api/attendance/today — own today's status
  @Get('today')
  @ApiOperation({ summary: "Get own today's attendance status" })
  @ApiResponse({ status: 200, description: "Returns today's status (e.g. CHECKED_IN, CHECKED_OUT, NOT_CHECKED_IN)" })
  getTodayStatus(@CurrentUser() user: any) {
    return this.attendanceService.getTodayStatus(user.userId);
  }

  // GET /api/attendance/summary — ADMIN/HR daily summary
  @Get('summary')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Get daily attendance summary' })
  @ApiResponse({ status: 200, description: 'Returns counts and list of checked-in, checked-out, and absent users' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires ADMIN/HR role)' })
  getDailySummary(@CurrentUser() user: any, @Query('date') date?: string) {
    return this.attendanceService.getDailySummary(user.companyId, date);
  }

  // GET /api/attendance/report/monthly — monthly report
  @Get('report/monthly')
  @ApiOperation({ summary: 'Get monthly attendance report' })
  @ApiResponse({ status: 200, description: 'Returns structured monthly report data' })
  @ApiResponse({ status: 403, description: 'Forbidden (restricted to own report for employees)' })
  getMonthlyReport(
    @CurrentUser() user: any,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('userId') userId?: string,
  ) {
    // EMPLOYEE can only get own report
    const targetUserId =
      user.role === 'EMPLOYEE' ? user.userId : userId ?? user.userId;

    return this.attendanceService.getMonthlyReport(
      targetUserId,
      parseInt(month) || new Date().getMonth() + 1,
      parseInt(year) || new Date().getFullYear(),
    );
  }

  // GET /api/attendance — all records (paginated)
  @Get()
  @ApiOperation({ summary: 'Get paginated attendance history' })
  @ApiResponse({ status: 200, description: 'Returns a paginated list of attendance records' })
  findAll(@CurrentUser() user: any, @Query() dto: AttendanceQueryDto) {
    return this.attendanceService.findAll(
      user.userId,
      user.role,
      user.companyId,
      dto,
    );
  }
}

