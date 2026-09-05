import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Avaliacao, Paciente } from '../database/entities';
import { EvidenciaModule } from '../evidencia/evidencia.module';
import { CustosModule } from '../custos/custos.module';
import { RecursosCalculoModule } from './recursos-calculo.module';
import { RecursosController } from './recursos.controller';
import { RecursosService } from './recursos.service';

// CustosModule entra porque o TEMPO (ciclos esperados e periodicidade) já é resolvido lá,
// e a projeção por horizonte precisa exatamente disso. Reusar em vez de reimplementar
// mantém uma resposta só para "quantos ciclos este paciente ainda tem".
@Module({
  imports: [
    TypeOrmModule.forFeature([Avaliacao, Paciente]),
    EvidenciaModule,
    CustosModule,
    RecursosCalculoModule,
  ],
  controllers: [RecursosController],
  providers: [RecursosService],
  exports: [RecursosService],
})
export class RecursosModule {}
