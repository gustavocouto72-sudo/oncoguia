import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PacientesModule } from './pacientes/pacientes.module';
import { SelecoesModule } from './selecoes/selecoes.module';
import { RevisoesModule } from './revisoes/revisoes.module';
import { AutorizacoesModule } from './autorizacoes/autorizacoes.module';
import { RetornosModule } from './retornos/retornos.module';
import { EvidenciaModule } from './evidencia/evidencia.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Máx 60 requisições por IP a cada 60s (login tem limite menor via @Throttle)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    PacientesModule,
    SelecoesModule,
    RevisoesModule,
    AutorizacoesModule,
    RetornosModule,
    EvidenciaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
