import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@test.com', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@123', description: 'User password (min 6 chars)' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'JWT refresh token' })
  @IsString()
  refreshToken: string;
}

