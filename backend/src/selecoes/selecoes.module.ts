import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SelecoesController } from './selecoes.controller';
import { SelecoesService } from './selecoes.service';
import { Paciente, SelecaoProtocolo } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([SelecaoProtocolo, Paciente])],
  controllers: [SelecoesController],
  providers: [SelecoesService],
})
export class SelecoesModule {}
