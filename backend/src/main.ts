import * as dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); // Override DNS to Google DNS to fix querySrv ECONNREFUSED for MongoDB Atlas

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ZeroProxy API')
    .setDescription(
      'Smart Face Auth + Employee Monitoring System — Complete API Documentation',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Login, logout, refresh token')
    .addTag('Users', 'Employee CRUD and management')
    .addTag('Attendance', 'Check-in, check-out, reports')
    .addTag('Sessions', 'Device tracking and force logout')
    .addTag('Activity', 'Audit logs and analytics')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  console.log('📚 Swagger docs available at http://localhost:3001/api/docs');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 ZeroProxy Backend running on http://localhost:${port}/api`);
}
bootstrap();

