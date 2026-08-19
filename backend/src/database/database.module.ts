import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as neon from '@neondatabase/serverless';
import { Usuario, Paciente, SelecaoProtocolo, Avaliacao, Revisao, FonteSugerida } from './entities';
import { InitialSchema1784419200000 } from './migrations/1784419200000-InitialSchema';
import { SeguimentoAvaliacoes1784505600000 } from './migrations/1784505600000-SeguimentoAvaliacoes';
import { RevisaoClinica1784592000000 } from './migrations/1784592000000-RevisaoClinica';
import { UnificaRevisao1784851200000 } from './migrations/1784851200000-UnificaRevisao';
import { FontesSugeridas1785110400000 } from './migrations/1785110400000-FontesSugeridas';
import { FonteArquivoNoBanco1785196800000 } from './migrations/1785196800000-FonteArquivoNoBanco';
import { AcaoRevisao1787356800000 } from './migrations/1787356800000-AcaoRevisao';
import { RefutarExcluir1787616000000 } from './migrations/1787616000000-RefutarExcluir';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL') || '';
        // Neon: WebSocket na porta 443 — funciona em redes que bloqueiam a 5432
        const isNeon = /\.neon\.tech/.test(url);
        return {
          type: 'postgres' as const,
          url,
          driver: isNeon ? neon : undefined,
          entities: [Usuario, Paciente, SelecaoProtocolo, Avaliacao, Revisao, FonteSugerida],
          migrations: [InitialSchema1784419200000, SeguimentoAvaliacoes1784505600000, RevisaoClinica1784592000000, UnificaRevisao1784851200000, FontesSugeridas1785110400000, FonteArquivoNoBanco1785196800000, AcaoRevisao1787356800000, RefutarExcluir1787616000000],
          migrationsRun: true,
          synchronize: false,
          ssl:
            !isNeon && /supabase|vercel|amazonaws/.test(url)
              ? { rejectUnauthorized: false }
              : false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
