import { Module } from '@nestjs/common';
import { EvidenciaController } from './evidencia.controller';
import { EvidenciaService } from './evidencia.service';

// O service é exportado: PacientesService o usa para decidir, NO SERVIDOR, se o regime
// escolhido é não incorporado (e portanto exige autorização de exceção).
@Module({
  controllers: [EvidenciaController],
  providers: [EvidenciaService],
  exports: [EvidenciaService],
})
export class EvidenciaModule {}
