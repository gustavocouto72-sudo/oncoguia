import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const origins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // Sem CORS_ORIGINS definido (dev local, app aberta via file:// ou http.server),
  // reflete qualquer origem — auth é por Bearer token, não cookie.
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
  // 3005 é a porta reservada do OncoGuia (3001 pertence ao Hospital Virtual) — ver ~/Antigravity/PORTS.md.
  const port = process.env.PORT || 3005;
  await app.listen(port);
  console.log(`OncoGuia API rodando em http://localhost:${port}/api`);
}
bootstrap();
