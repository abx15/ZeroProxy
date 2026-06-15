import { Injectable, HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService');
  private readonly aiServiceUrl: string;
  private readonly apiKey: string;

  constructor(private config: ConfigService) {
    this.aiServiceUrl = this.config.get('AI_SERVICE_URL') || 'http://localhost:8000';
    this.apiKey = this.config.get('INTERNAL_API_KEY') || 'zeroproxy_internal_key_change_in_production';
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };
  }

  // ─── Health Check ─────────────────────────────────────────
  async checkAiServiceHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.aiServiceUrl}/health`);
      const data = await res.json();
      return data.status === 'ok' && data.models_loaded === true;
    } catch {
      return false;
    }
  }

  // ─── Register Face ────────────────────────────────────────
  async registerFace(userId: string, companyId: string, imageBase64: string) {
    try {
      const res = await fetch(`${this.aiServiceUrl}/face/register`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          user_id: userId,
          company_id: companyId,
          image_base64: imageBase64,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new HttpException(
          err.detail || 'Face registration failed',
          res.status,
        );
      }

      const data = await res.json();

      this.logger.log(`Face registered for user: ${userId}`);
      return data;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('AI Service unavailable. Please try again.', 503);
    }
  }

  // ─── Verify Face ──────────────────────────────────────────
  async verifyFace(userId: string, imageBase64: string) {
    try {
      const res = await fetch(`${this.aiServiceUrl}/face/verify`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          user_id: userId,
          image_base64: imageBase64,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new HttpException(err.detail || 'Face verification failed', res.status);
      }

      return await res.json();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('AI Service unavailable.', 503);
    }
  }

  // ─── Face Login Check (Liveness + Verify combined) ────────
  async faceLoginCheck(
    userId: string,
    imageBase64: string,
    livenessFrames: string[],
  ) {
    try {
      const res = await fetch(`${this.aiServiceUrl}/face/login-check`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          user_id: userId,
          image_base64: imageBase64,
          liveness_frames: livenessFrames,
        }),
      });

      const data = await res.json();
      return data;
    } catch (err) {
      throw new HttpException('AI Service unavailable.', 503);
    }
  }

  // ─── Check Liveness ───────────────────────────────────────
  async checkLiveness(frames: string[]) {
    try {
      const res = await fetch(`${this.aiServiceUrl}/liveness/check`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ frames }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new HttpException(err.detail || 'Liveness check failed', res.status);
      }

      return await res.json();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('AI Service unavailable.', 503);
    }
  }

  // ─── Get Registration Status ──────────────────────────────
  async getFaceRegistrationStatus(userId: string) {
    try {
      const res = await fetch(
        `${this.aiServiceUrl}/face/register/${userId}/status`,
        { headers: this.headers },
      );
      return await res.json();
    } catch {
      throw new HttpException('AI Service unavailable.', 503);
    }
  }

  // ─── Delete Face Registration ─────────────────────────────
  async deleteFaceRegistration(userId: string) {
    try {
      const res = await fetch(
        `${this.aiServiceUrl}/face/register/${userId}`,
        { method: 'DELETE', headers: this.headers },
      );
      return await res.json();
    } catch {
      throw new HttpException('AI Service unavailable.', 503);
    }
  }
}
