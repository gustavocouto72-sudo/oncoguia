import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutorizacoesController } from './autorizacoes.controller';
import { AutorizacoesService } from './autorizacoes.service';
import { Avaliacao } from '../database/entities';
import { PacientesModule } from '../pacientes/pacientes.module';

@Module({
  // PacientesModule: aprovar uma exceção torna a avaliação o protocolo vigente — e é aí
  // que o reestadiamento passa a fazer sentido (na criação ela era só uma solicitação).
  imports: [TypeOrmModule.forFeature([Avaliacao]), PacientesModule],
  controllers: [AutorizacoesController],
  providers: [AutorizacoesService],
})
export class AutorizacoesModule {}
