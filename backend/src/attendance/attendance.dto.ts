import { IsString, IsOptional, IsDateString, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { VerificationMethod } from '@prisma/client';

export class CheckInDto {
  @IsString()
  deviceInfo: string;

  @IsEnum(VerificationMethod)
  @IsOptional()
  verificationMethod?: VerificationMethod = 'FACE';
}

export class CheckOutDto {
  @IsString()
  @IsOptional()
  deviceInfo?: string;
}

export class AttendanceQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

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
  limit?: number = 10;
}
