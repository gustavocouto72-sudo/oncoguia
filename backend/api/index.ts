import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';

let app: any;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

    app.use(helmet());

    const origins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o: string) => o.trim())
      .filter(Boolean);
    app.enableCors({
      origin: origins.length ? origins : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  }
  return app;
}

export default async function handler(req: any, res: any) {
  try {
    const nestApp = await bootstrap();
    const server = nestApp.getHttpAdapter().getInstance();
    return server(req, res);
  } catch (err: any) {
    console.error('OncoGuia bootstrap error:', err?.message, err?.stack);
    res.status(500).json({ error: 'Bootstrap failed', detail: err?.message });
  }
}
