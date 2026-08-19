import { Module } from '@nestjs/common';
import { EvidenciaController } from './evidencia.controller';

@Module({ controllers: [EvidenciaController] })
export class EvidenciaModule {}
