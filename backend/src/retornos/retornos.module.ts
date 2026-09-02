import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetornosController } from './retornos.controller';
import { RetornosService } from './retornos.service';
import { Avaliacao, Paciente, Retorno } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Retorno, Paciente, Avaliacao])],
  controllers: [RetornosController],
  providers: [RetornosService],
  exports: [RetornosService],
})
export class RetornosModule {}
