import * as dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('ZeroProxy API (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;
  let adminUserId: string;
  let employeeUserId: string;
  let companyId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Auth E2E ─────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('should login admin successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin@123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.role).toBe('ADMIN');

      adminToken = res.body.data.accessToken;
      adminUserId = res.body.data.user.id;
      companyId = res.body.data.user.companyId;
    });

    it('should login employee successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'emp@test.com', password: 'Employee@123' })
        .expect(200);

      employeeToken = res.body.data.accessToken;
      employeeUserId = res.body.data.user.id;
    });

    it('should return 401 on wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'wrongpass' })
        .expect(401);
    });

    it('should return 400 on invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'Admin@123' })
        .expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.email).toBe('admin@test.com');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });

  // ─── Users E2E ────────────────────────────────────────────
  describe('POST /api/users', () => {
    it('should create new employee (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test User',
          email: `e2e_${Date.now()}@test.com`,
          password: 'Test@12345',
          role: 'EMPLOYEE',
          companyId,
        })
        .expect(201);

      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data.name).toBe('E2E Test User');
    });

    it('should return 403 if employee tries to create user', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          name: 'Hacker',
          email: 'hacker@test.com',
          password: 'Hack@123',
          companyId,
        })
        .expect(403);
    });
  });

  describe('GET /api/users', () => {
    it('should return paginated users for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });

    it('should return 403 for employee', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });
  });

  // ─── Attendance E2E ───────────────────────────────────────
  describe('POST /api/attendance/checkin', () => {
    it('should check in employee successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ deviceInfo: 'E2E Test/Chrome', verificationMethod: 'FACE' })
        .expect(201);

      expect(res.body.data.message).toContain('Check-in successful');
    });

    it('should fail on double check-in', async () => {
      await request(app.getHttpServer())
        .post('/api/attendance/checkin')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ deviceInfo: 'E2E Test/Chrome' })
        .expect(400);
    });
  });

  describe('GET /api/attendance/today', () => {
    it('should return CHECKED_IN status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/attendance/today')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('CHECKED_IN');
    });
  });

  describe('POST /api/attendance/checkout', () => {
    it('should check out employee successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/checkout')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({})
        .expect(201);

      expect(res.body.data.message).toContain('Check-out successful');
      expect(res.body.data.record).toHaveProperty('totalHours');
    });
  });

  // ─── Sessions E2E ─────────────────────────────────────────
  describe('GET /api/sessions/me', () => {
    it('should return own sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sessions/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('sessions');
      expect(Array.isArray(res.body.data.sessions)).toBe(true);
    });
  });

  describe('GET /api/sessions/live', () => {
    it('should return live stats for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sessions/live')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('onlineNow');
      expect(res.body.data).toHaveProperty('activeSessions');
    });
  });

  // ─── Activity E2E ─────────────────────────────────────────
  describe('GET /api/activity', () => {
    it('should return activity logs for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('data');
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });

    it('should return only own logs for employee', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/activity')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const logs = res.body.data.data;
      const allOwnLogs = logs.every((l: any) => l.userId === employeeUserId);
      expect(allOwnLogs).toBe(true);
    });
  });

  // ─── Auth Logout E2E ──────────────────────────────────────
  describe('POST /api/auth/logout', () => {
    it('should logout and invalidate token', async () => {
      // Login fresh
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin@123' })
        .expect(200);

      const freshToken = loginRes.body.data.accessToken;

      // Logout
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      // Token should now be invalid
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(401);
    });
  });
});
