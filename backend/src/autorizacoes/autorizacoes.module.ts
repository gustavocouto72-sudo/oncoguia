import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutorizacoesController } from './autorizacoes.controller';
import { AutorizacoesService } from './autorizacoes.service';
import { Avaliacao } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Avaliacao])],
  controllers: [AutorizacoesController],
  providers: [AutorizacoesService],
})
export class AutorizacoesModule {}
