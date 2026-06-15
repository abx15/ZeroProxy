import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { RegisterFaceDto, VerifyFaceDto, LivenessCheckDto, FaceLoginDto } from './ai.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('AI Face')
@ApiBearerAuth('JWT-auth')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  // GET /api/ai/health — check AI service status
  @Get('health')
  @ApiOperation({ summary: 'Check AI service health' })
  async getAiHealth() {
    const isHealthy = await this.aiService.checkAiServiceHealth();
    return {
      aiService: isHealthy ? 'online' : 'offline',
      message: isHealthy
        ? 'AI service is running and models are loaded.'
        : 'AI service is unavailable.',
    };
  }

  // POST /api/ai/face/register — register own face
  @Post('face/register')
  @ApiOperation({ summary: 'Register employee face' })
  @HttpCode(HttpStatus.OK)
  async registerFace(
    @Body() dto: RegisterFaceDto,
    @CurrentUser() user: any,
  ) {
    return this.aiService.registerFace(
      user.userId,
      user.companyId,
      dto.imageBase64,
    );
  }

  // POST /api/ai/face/register/:userId — admin registers face for specific user
  @Post('face/register/:userId')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Admin registers face for a specific employee' })
  @HttpCode(HttpStatus.OK)
  async registerFaceForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: RegisterFaceDto,
    @CurrentUser() user: any,
  ) {
    return this.aiService.registerFace(userId, user.companyId, dto.imageBase64);
  }

  // GET /api/ai/face/status — check own face registration status
  @Get('face/status')
  @ApiOperation({ summary: 'Check own face registration status' })
  async getFaceStatus(@CurrentUser() user: any) {
    return this.aiService.getFaceRegistrationStatus(user.userId);
  }

  // GET /api/ai/face/status/:userId — admin checks specific user
  @Get('face/status/:userId')
  @Roles('ADMIN', 'HR')
  @ApiOperation({ summary: 'Check face registration status for specific user' })
  async getFaceStatusForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.aiService.getFaceRegistrationStatus(userId);
  }

  // DELETE /api/ai/face/register — delete own face registration
  @Delete('face/register')
  @ApiOperation({ summary: 'Delete own face registration' })
  async deleteFaceRegistration(@CurrentUser() user: any) {
    return this.aiService.deleteFaceRegistration(user.userId);
  }

  // POST /api/ai/liveness — check liveness
  @Post('liveness')
  @ApiOperation({ summary: 'Check liveness from multiple frames' })
  @HttpCode(HttpStatus.OK)
  async checkLiveness(@Body() dto: LivenessCheckDto) {
    return this.aiService.checkLiveness(dto.frames);
  }

  // POST /api/ai/face/login — face login (liveness + verify combined)
  @Post('face/login')
  @ApiOperation({ summary: 'Face login — liveness + verification combined' })
  @HttpCode(HttpStatus.OK)
  async faceLogin(
    @Body() dto: FaceLoginDto,
    @CurrentUser() user: any,
  ) {
    return this.aiService.faceLoginCheck(
      user.userId,
      dto.imageBase64,
      dto.livenessFrames,
    );
  }
}
