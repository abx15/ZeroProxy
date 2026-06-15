import * as dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/redis/redis.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AI Integration E2E Tests', () => {
  jest.setTimeout(25000);
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;
  let employeeUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue({
        set: jest.fn(),
        setEx: jest.fn(),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn(),
        exists: jest.fn().mockResolvedValue(false),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    const swaggerConfig = new DocumentBuilder()
      .setTitle('ZeroProxy API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();

    // Login to get tokens
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin@123' });
    console.log('adminRes status:', adminRes.status);
    console.log('adminRes body:', JSON.stringify(adminRes.body));
    adminToken = adminRes.body?.data?.accessToken;

    const empRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'emp@test.com', password: 'Employee@123' });
    console.log('empRes status:', empRes.status);
    console.log('empRes body:', JSON.stringify(empRes.body));
    employeeToken = empRes.body?.data?.accessToken;
    employeeUserId = empRes.body?.data?.user?.id;

    // Clean up pre-existing check-in records for testing employee
    const prisma = app.get(PrismaService);
    await prisma.attendanceRecord.deleteMany({
      where: { userId: employeeUserId },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // TEST 1 — AI Service Health via NestJS
  it('GET /api/ai/health — should return AI service status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ai/health')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveProperty('aiService');
    console.log('AI Service status:', res.body.data.aiService);
  });

  // TEST 2 — Check face status (not registered yet)
  it('GET /api/ai/face/status — should return not registered', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ai/face/status')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    console.log('Face status:', res.body.data);
  });

  // TEST 3 — Liveness check via NestJS
  it('POST /api/ai/liveness — should check liveness', async () => {
    // Using placeholder base64 — in real test use actual face photos
    const dummyFrame = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await request(app.getHttpServer())
      .post('/api/ai/liveness')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ frames: [dummyFrame, dummyFrame, dummyFrame] });

    // Will likely fail liveness (dummy image) but should not 500
    expect([200, 400]).toContain(res.status);
    console.log('Liveness result:', res.body);
  });

  // TEST 4 — Face login without registration (should fail gracefully)
  it('POST /api/ai/face/login — should fail if face not registered', async () => {
    const dummyImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await request(app.getHttpServer())
      .post('/api/ai/face/login')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        imageBase64: dummyImage,
        livenessFrames: [dummyImage, dummyImage, dummyImage],
      });



    expect(res.body.data.verified).toBe(false);
    console.log('Face login result:', res.body.data.message);
  });

  // TEST 5 — Check-in without face (should work — face is optional)
  it('POST /api/attendance/checkin — should work without face data', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/attendance/checkin')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ deviceInfo: 'Integration Test' })
      .expect(201);

    expect(res.body.data.message).toContain('Check-in successful');

    // Checkout after
    await request(app.getHttpServer())
      .post('/api/attendance/checkout')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({});
  });

  // TEST 6 — Admin checks face status of employee
  it('GET /api/ai/face/status/:userId — admin can check employee status', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/ai/face/status/${employeeUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    console.log('Employee face status (from admin):', res.body.data);
  });

  // TEST 7 — Swagger docs accessible
  it('GET /api/docs — Swagger should be accessible', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200);

    expect(res.text).toContain('swagger');
  });
});
