import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevisaoExportController, RevisoesController } from './revisoes.controller';
import { RevisoesService } from './revisoes.service';
import { FonteSugerida, Revisao } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Revisao, FonteSugerida])],
  controllers: [RevisoesController, RevisaoExportController],
  providers: [RevisoesService],
})
export class RevisoesModule {}
