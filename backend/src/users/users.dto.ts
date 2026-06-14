import { IsEmail, IsString, IsEnum, IsBoolean, IsUUID, IsOptional, MinLength, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Ravi Kumar', description: 'Name of the user' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'ravi@test.com', description: 'Unique email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password@123', description: 'Password (min 8 characters)' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: Role, example: Role.EMPLOYEE, description: 'Role of the user' })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', description: 'UUID of the company' })
  @IsUUID()
  companyId: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Ravi Kumar updated', description: 'Updated name of the user' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: true, description: 'Status of the user (active/inactive)' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: Role, example: Role.EMPLOYEE, description: 'Updated role of the user' })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'Current@123', description: 'Current password' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword@123', description: 'New password (min 8 characters)' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class PaginationDto {
  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page number for pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Number of items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'Ravi', description: 'Search query for filtering by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: Role, example: Role.EMPLOYEE, description: 'Filter by role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: true, description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

