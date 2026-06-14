import { IsString, IsOptional, IsUUID } from 'class-validator';

export class ForceLogoutDto {
  @IsUUID()
  sessionId: string;
}

export class ForceLogoutAllDto {
  @IsUUID()
  userId: string;
}
