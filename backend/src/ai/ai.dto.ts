import { IsString, IsArray, IsUUID, MinLength, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterFaceDto {
  @ApiProperty({ description: 'Base64 encoded face image' })
  @IsString()
  imageBase64: string;
}

export class VerifyFaceDto {
  @ApiProperty({ description: 'Base64 encoded face image for verification' })
  @IsString()
  imageBase64: string;
}

export class LivenessCheckDto {
  @ApiProperty({ description: '3-10 base64 frames captured over 2-3 seconds' })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(10)
  frames: string[];
}

export class FaceLoginDto {
  @ApiProperty({ description: 'Single face image base64 for verification' })
  @IsString()
  imageBase64: string;

  @ApiProperty({ description: '3-10 liveness frames base64' })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(10)
  livenessFrames: string[];
}
