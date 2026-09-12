import 'reflect-metadata';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { ApiResponseInterceptor } from './common/api-response.interceptor.js';
import { ConfigService } from './config/config.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('API_PREFIX', 'api');
  const corsOrigins = config
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.enableCors({
    credentials: true,
    origin: corsOrigins.length ? corsOrigins : true,
  });
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('StoneLab API')
    .setDescription('StoneLab 管理后台与小程序 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = config.get<number>('PORT', 3100);
  const host = config.get<string>('HOST', '0.0.0.0');
  await app.listen(port, host);
  Logger.log(`StoneLab API listening on http://${host}:${port}/${apiPrefix}`, 'Bootstrap');
}

void bootstrap();
