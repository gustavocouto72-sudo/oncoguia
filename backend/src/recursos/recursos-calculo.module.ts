import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apresentacao, CustoRegime, Insumo, PremissasRecursos } from '../database/entities';
import { EvidenciaModule } from '../evidencia/evidencia.module';
import { RecursosCalculoService } from './recursos-calculo.service';

// Módulo do CÁLCULO, importável por quem precisar da decomposição por insumo sem
// arrastar a projeção junto — hoje, o módulo de CUSTOS (a ficha do paciente mostra a
// decomposição para auditor e admin). Não importa CustosModule: é essa ausência que
// mantém o grafo sem ciclo.
@Module({
  imports: [
    TypeOrmModule.forFeature([Insumo, Apresentacao, PremissasRecursos, CustoRegime]),
    EvidenciaModule,
  ],
  providers: [RecursosCalculoService],
  exports: [RecursosCalculoService],
})
export class RecursosCalculoModule {}
