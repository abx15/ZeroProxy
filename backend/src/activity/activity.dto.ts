import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityAction } from './schemas/activity-log.schema';

export class ActivityQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

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
