import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Avaliacao, CustoRegime, Paciente } from '../database/entities';
import { EvidenciaModule } from '../evidencia/evidencia.module';
import { RecursosCalculoModule } from '../recursos/recursos-calculo.module';
import { CustosController } from './custos.controller';
import { CustosService } from './custos.service';

// EvidenciaModule entra porque a metade "tempo" da estimativa (expectativa_uso) vem do
// corpus publicado, não do banco: o servidor lê o mesmo JSON que a app recebe.
// RecursosCalculoModule entra porque a ficha do paciente (auditor + admin) mostra a
// decomposição por insumo ao lado da estimativa por protocolo. É o módulo do CÁLCULO, não
// o de recursos inteiro — aquele importa este, e importá-lo de volta fecharia um ciclo.
@Module({
  imports: [TypeOrmModule.forFeature([CustoRegime, Avaliacao, Paciente]), EvidenciaModule, RecursosCalculoModule],
  controllers: [CustosController],
  providers: [CustosService],
  exports: [CustosService],
})
export class CustosModule {}
