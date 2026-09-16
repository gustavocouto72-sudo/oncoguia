import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetornosController } from './retornos.controller';
import { AgendaController } from './agenda.controller';
import { RetornosService } from './retornos.service';
import { Avaliacao, EventoAdministrativo, ImportacaoProposta, Paciente, Retorno } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Retorno, Paciente, Avaliacao, EventoAdministrativo, ImportacaoProposta])],
  controllers: [RetornosController, AgendaController],
  providers: [RetornosService],
  exports: [RetornosService],
})
export class RetornosModule {}
