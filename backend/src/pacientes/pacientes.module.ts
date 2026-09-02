import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PacientesController } from './pacientes.controller';
import { PacientesService } from './pacientes.service';
import { Avaliacao, Paciente, SelecaoProtocolo } from '../database/entities';
import { EvidenciaModule } from '../evidencia/evidencia.module';

@Module({
  imports: [TypeOrmModule.forFeature([Paciente, SelecaoProtocolo, Avaliacao]), EvidenciaModule],
  controllers: [PacientesController],
  providers: [PacientesService],
  exports: [PacientesService],
})
export class PacientesModule {}
