import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityAction } from './schemas/activity-log.schema';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityQueryDto {
  @ApiPropertyOptional({ example: 'user-uuid-12345', description: 'Filter activity logs by specific user UUID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: ActivityAction, example: ActivityAction.LOGIN, description: 'Filter activity logs by action type' })
  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;

  @ApiPropertyOptional({ example: 'SUCCESS', description: 'Filter by log status (e.g. SUCCESS, FAILED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z', description: 'Start date range filter' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.999Z', description: 'End date range filter' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page number for pagination' })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, description: 'Number of logs per page' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}


export class CreateActivityLogDto {
  userId: string;
  companyId: string;
  userEmail: string;
  userName: string;
  action: ActivityAction;
  status?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  deviceInfo?: string;
  targetUserId?: string;
  targetUserEmail?: string;
}
