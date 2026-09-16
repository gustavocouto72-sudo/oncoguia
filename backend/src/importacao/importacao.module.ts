import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportacaoController } from './importacao.controller';
import { ImportacaoService } from './importacao.service';
import { ExtracaoService } from './extracao.service';
import { ImportacaoProposta, Paciente } from '../database/entities';
import { EvidenciaModule } from '../evidencia/evidencia.module';
import { PacientesModule } from '../pacientes/pacientes.module';
import { RetornosModule } from '../retornos/retornos.module';

// Importação de pacientes em duas alçadas: a proposta (secretaria) e a validação
// (oncologista). A validação REUSA os serviços de sempre — avaliação pelo
// PacientesService, retorno pelo RetornosService — para que o registro criado seja
// indistinguível de um feito à mão: mesmas assinaturas, mesmos efeitos (reestadiamento,
// agenda), mesma trilha.
@Module({
  imports: [
    TypeOrmModule.forFeature([ImportacaoProposta, Paciente]),
    EvidenciaModule,
    PacientesModule,
    RetornosModule,
  ],
  controllers: [ImportacaoController],
  providers: [ImportacaoService, ExtracaoService],
  exports: [ImportacaoService],
})
export class ImportacaoModule {}
