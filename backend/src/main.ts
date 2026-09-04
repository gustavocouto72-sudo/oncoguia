import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { BancoErrado, exigirBancoDeDev, resumoAlvo } from './database/alvo-banco';

async function bootstrap() {
  // Trava anti-engano: em dev, só sobe apontado para o branch de DEV do banco.
  // Fica AQUI, no entrypoint local, e não em api/index.ts — a Vercel entra por lá e
  // não passa por esta checagem. Antes de qualquer coisa do Nest: se o alvo está
  // errado, subir e depois avisar já teria aberto conexão com o banco errado.
  let alvo;
  try {
    alvo = exigirBancoDeDev(
      process.env.DATABASE_URL,
      process.env.ONCOGUIA_DB_DEV_ENDPOINT,
      process.env.NODE_ENV,
    );
  } catch (e) {
    if (e instanceof BancoErrado) {
      console.error('\n' + e.message + '\n');
      process.exit(1);
    }
    throw e;
  }

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
  // Primeira linha útil do log diz sobre QUE BANCO tudo aqui vale — mesmo espírito do
  // "Corpus:" do portão de dados.
  if (alvo) console.log(`Banco (dev): ${resumoAlvo(alvo)}`);
}
bootstrap();
