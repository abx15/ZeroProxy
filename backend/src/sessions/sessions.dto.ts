import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForceLogoutDto {
  @ApiProperty({ example: 'session-uuid-12345', description: 'UUID of the session to terminate' })
  @IsUUID()
  sessionId: string;
}

export class ForceLogoutAllDto {
  @ApiProperty({ example: 'user-uuid-12345', description: 'UUID of the user whose sessions will be terminated' })
  @IsUUID()
  userId: string;
}

