import { IsString, IsOptional, IsDateString, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { VerificationMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({ example: 'Chrome/Windows (127.0.0.1)', description: 'Browser/Device info used for checking in' })
  @IsString()
  deviceInfo: string;

  @ApiPropertyOptional({ enum: VerificationMethod, example: VerificationMethod.FACE, default: VerificationMethod.FACE, description: 'Method of attendance verification' })
  @IsEnum(VerificationMethod)
  @IsOptional()
  verificationMethod?: VerificationMethod = 'FACE';
}

export class CheckOutDto {
  @ApiPropertyOptional({ example: 'Chrome/Windows (127.0.0.1)', description: 'Browser/Device info used for checking out' })
  @IsString()
  @IsOptional()
  deviceInfo?: string;
}

export class AttendanceQueryDto {
  @ApiPropertyOptional({ example: 'user-uuid-12345', description: 'Filter by specific user UUID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

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

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Number of items per page' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}

