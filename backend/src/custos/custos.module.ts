import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Avaliacao, CustoRegime, Paciente } from '../database/entities';
import { EvidenciaModule } from '../evidencia/evidencia.module';
import { CustosController } from './custos.controller';
import { CustosService } from './custos.service';

// EvidenciaModule entra porque a metade "tempo" da estimativa (expectativa_uso) vem do
// corpus publicado, não do banco: o servidor lê o mesmo JSON que a app recebe.
@Module({
  imports: [TypeOrmModule.forFeature([CustoRegime, Avaliacao, Paciente]), EvidenciaModule],
  controllers: [CustosController],
  providers: [CustosService],
  exports: [CustosService],
})
export class CustosModule {}
