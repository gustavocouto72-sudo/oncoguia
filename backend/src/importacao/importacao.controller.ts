import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Request, UseGuards, ValidationPipe,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  Allow, ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import {
  ImportacaoDecidirGuard, ImportacaoLerGuard, ImportacaoProporGuard, ImportacaoVocabularioGuard,
} from '../auth/importacao.guard';
import { EvidenciaService } from '../evidencia/evidencia.service';
import { ImportacaoService } from './importacao.service';
import { ExtracaoService } from './extracao.service';
import type { CampoProposto } from './importacao.service';
import type { Perfil } from '../database/entities';

// Um campo proposto: nome, valor (booleano/número/texto — o TIPO é conferido no serviço
// contra o vocabulário do tumor) e o trecho do prontuário que o sustenta.
// Classe com @Type de propósito: a ValidationPipe global roda com enableImplicitConversion,
// e um array de interface (sem classe) vira um array de arrays vazios no caminho — o
// serviço recebia `campos: [[]]` e recusava "campo sem nome".
class CampoPropostoDto {
  @IsString() @IsNotEmpty({ message: 'campo sem nome' }) @MaxLength(80) campo: string;
  @Allow() valor: any;
  @IsOptional() @IsString() @MaxLength(500) trecho?: string | null;
}

class MetaPropostaDto {
  @IsOptional() @IsString() @MaxLength(10) data_inicio?: string | null;
  @IsOptional() @IsString() @MaxLength(10) data_evolucao?: string | null;
  @IsOptional() @IsString() @MaxLength(10) proximo_retorno?: string | null;
  @IsOptional() @IsString() @MaxLength(200) medico_assistente_texto?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(200, { each: true }) sem_campo?: string[] | null;
  @IsOptional() @IsString() @MaxLength(4000) historico?: string | null;
  @IsOptional() @IsString() @MaxLength(200) protocolo_texto?: string | null;
}

// O envelope. `campos` e `meta` são validados campo a campo no SERVIÇO contra o
// vocabulário do tumor (tipo, opções, datas) — aqui só a forma.
class CriarPropostaDto {
  @IsString() @IsNotEmpty({ message: 'tumor obrigatório' }) @MaxLength(60) tumor: string;
  @IsOptional() @IsString() @MaxLength(40) sistema?: string;
  @IsOptional() @IsString() @MaxLength(120) subtipo?: string;
  @IsOptional() @IsString() @MaxLength(160) regimen_id?: string;
  @IsOptional() @IsInt() @Min(1) linha_tratamento?: number;
  @IsArray() @ArrayMaxSize(80) @ValidateNested({ each: true }) @Type(() => CampoPropostoDto) campos: CampoPropostoDto[];
  @IsOptional() @ValidateNested() @Type(() => MetaPropostaDto) meta?: MetaPropostaDto;
}

// Correções do validador. Booleano ausente NÃO vira false (o serviço só substitui o que
// vier). `campos` aceita lista [{campo, valor}] ou objeto {campo: valor}.
class ValidarPropostaDto {
  // Objeto {campo: valor} — lista [{campo, valor}] também é aceita pelo serviço, mas o
  // objeto é o que a tela manda (e o que escapa da conversão implícita da pipe).
  @Allow() campos?: CampoProposto[] | Record<string, any>;
  @IsOptional() @IsString() @MaxLength(160) regimen_id?: string | null;
  @IsOptional() @IsInt() @Min(1) linha_tratamento?: number;
}

// Extração: o tumor escolhido e o texto JÁ RASPADO no navegador (sem nome, atendimento,
// prontuário, nascimento). O servidor processa e descarta — nada disto é gravado.
class ExtrairDto {
  @IsString() @IsNotEmpty({ message: 'tumor obrigatório' }) @MaxLength(60) tumor: string;
  @IsString() @IsNotEmpty({ message: 'texto_raspado obrigatório' }) @MaxLength(60000) texto_raspado: string;
}

class DescartarPropostaDto {
  @IsString() @IsNotEmpty({ message: 'motivo do descarte obrigatório' }) @MaxLength(1000) motivo: string;
}

const PIPE = new ValidationPipe({ whitelist: true, transform: true });

// Cada rota com a SUA whitelist literal (importacao.guard.ts); o controller só exige JWT.
@UseGuards(JwtAuthGuard)
@Controller()
export class ImportacaoController {
  constructor(private service: ImportacaoService, private evidencia: EvidenciaService, private extracao: ExtracaoService) {}

  // Dicionário do formulário da secretaria — tumores, campos, nomes de protocolo. Não é
  // o corpus: sem critério, referência, grade ou custo.
  @UseGuards(ImportacaoVocabularioGuard)
  @Get('importacao/vocabulario')
  vocabulario() {
    return this.evidencia.vocabulario();
  }

  // Texto raspado → proposta (formato do "colar JSON"). Mesma whitelist de quem propõe:
  // a extração é o passo anterior à proposta, não uma leitura clínica. 503 sem chave.
  @UseGuards(ImportacaoProporGuard)
  @Post('importacao/extrair')
  extrair(@Body(PIPE) dto: ExtrairDto) {
    return this.extracao.extrair(dto.tumor, dto.texto_raspado);
  }

  @UseGuards(ImportacaoProporGuard)
  @Post('pacientes/:id/importacao-proposta')
  criar(
    @Param('id', ParseIntPipe) id: number,
    @Body(PIPE) dto: CriarPropostaDto,
    @Request() req: { user: { id: number; perfil: Perfil } },
  ) {
    return this.service.criar(id, dto, req.user.id, req.user.perfil);
  }

  @UseGuards(ImportacaoLerGuard)
  @Get('pacientes/:id/importacao-proposta')
  ler(@Param('id', ParseIntPipe) id: number, @Request() req: { user: { perfil: Perfil } }) {
    return this.service.lerDoPaciente(id, req.user.perfil);
  }

  @UseGuards(ImportacaoDecidirGuard)
  @Post('importacao-propostas/:id/validar')
  validar(
    @Param('id', ParseIntPipe) id: number,
    @Body(PIPE) dto: ValidarPropostaDto,
    @Request() req: { user: { id: number; perfil: Perfil } },
  ) {
    return this.service.validar(id, dto || {}, req.user.id, req.user.perfil);
  }

  @UseGuards(ImportacaoDecidirGuard)
  @Post('importacao-propostas/:id/descartar')
  descartar(
    @Param('id', ParseIntPipe) id: number,
    @Body(PIPE) dto: DescartarPropostaDto,
    @Request() req: { user: { id: number; perfil: Perfil } },
  ) {
    return this.service.descartar(id, dto.motivo, req.user.id, req.user.perfil);
  }
}
