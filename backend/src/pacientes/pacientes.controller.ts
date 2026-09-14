import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UseGuards,
} from '@nestjs/common';
import {
  IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min,
  ValidateIf,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { LeituraClinicaGuard } from '../auth/clinico.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { OncologistaOuAdminGuard } from '../auth/oncologista.guard';
import {
  CadastroCriarGuard, CadastroEditarGuard, LeituraCadastroGuard, recusarClinicoDaSecretaria,
} from '../auth/cadastro.guard';
import { PacientesService } from './pacientes.service';
import type { Perfil, Semaforo } from '../database/entities';

class CriarPacienteDto {
  @IsString() @IsNotEmpty({ message: 'Nome obrigatório' }) @MaxLength(160) nome: string;
  @IsOptional() @IsString() nasc?: string;
  @IsOptional() @IsIn(['F', 'M']) sexo?: 'F' | 'M';
  @IsOptional() @IsString() @MaxLength(120) cidade?: string;
  @IsOptional() @IsString() @MaxLength(80) operadora?: string;
  @IsOptional() @IsString() @MaxLength(120) plano?: string;
  @IsOptional() @IsString() @MaxLength(60) carteirinha?: string;
  // Contexto oncológico (o tumor é atributo do paciente).
  @IsOptional() @IsString() @MaxLength(60) identificador?: string;
  @IsOptional() @IsString() @MaxLength(40) sistema?: string;
  @IsOptional() @IsString() @MaxLength(60) tumor?: string;
  @IsOptional() @IsString() @MaxLength(120) subtipo?: string;
  // ---- Medidas (opcionais) ----
  // Refinam a dose calculada no módulo de recursos: mg/m² precisa de superfície corporal
  // (Mosteller, que exige peso E altura) e mg/kg precisa de peso. Aceitam null para
  // APAGAR — medida digitada errada tem de poder ser removida, não só sobrescrita.
  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(400) peso_kg?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(30) @Max(250) altura_cm?: number | null;
  @IsOptional() @IsObject() valores_estaveis?: Record<string, any>;
}

// Correção cadastral: todos os campos opcionais — só o que vier no body é alterado.
class AtualizarPacienteDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Nome não pode ficar vazio' }) @MaxLength(160) nome?: string;
  @IsOptional() @IsString() nasc?: string;
  @IsOptional() @IsIn(['F', 'M']) sexo?: 'F' | 'M';
  @IsOptional() @IsString() @MaxLength(120) cidade?: string;
  @IsOptional() @IsString() @MaxLength(80) operadora?: string;
  @IsOptional() @IsString() @MaxLength(120) plano?: string;
  @IsOptional() @IsString() @MaxLength(60) carteirinha?: string;
  @IsOptional() @IsString() @MaxLength(60) identificador?: string;
  @IsOptional() @IsString() @MaxLength(40) sistema?: string;
  @IsOptional() @IsString() @MaxLength(60) tumor?: string;
  @IsOptional() @IsString() @MaxLength(120) subtipo?: string;
  // ---- Medidas (opcionais) ----
  // Refinam a dose calculada no módulo de recursos: mg/m² precisa de superfície corporal
  // (Mosteller, que exige peso E altura) e mg/kg precisa de peso. Aceitam null para
  // APAGAR — medida digitada errada tem de poder ser removida, não só sobrescrita.
  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(400) peso_kg?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(30) @Max(250) altura_cm?: number | null;
  @IsOptional() @IsObject() valores_estaveis?: Record<string, any>;
}

class CriarAvaliacaoDto {
  @IsString() @IsNotEmpty() @MaxLength(160) regimen_id: string;
  @IsOptional() @IsInt() @Min(1) linha_tratamento?: number;
  @IsObject() snapshot_campos: Record<string, any>;
  @IsIn(['elegivel', 'atencao', 'inelegivel']) semaforo: Semaforo;
  @IsOptional() @IsObject() detalhe_semaforo?: Record<string, any>;
  // Solicitação de exceção: 'pendente' quando o médico seleciona um protocolo Inelegível
  // ou Não incorporado (a justificativa vai em detalhe_semaforo.ressalva). Só estes dois
  // valores entram por aqui — 'aprovada'/'negada' são decisão do auditor, em outra rota.
  // E é só um PEDIDO: o servidor reconfere os dois eixos e pode forçar 'pendente'.
  @IsOptional() @IsIn(['nao_necessaria', 'pendente']) autorizacao_estado?: 'nao_necessaria' | 'pendente';
  // Retorno que motivou a troca de protocolo (conduta = troca_protocolo). Opcional: a
  // primeira seleção e a reavaliação avulsa não nascem de retorno nenhum.
  @IsOptional() @IsInt() retorno_id?: number;
}

// Cada rota tem a SUA whitelist literal — o controller só exige JWT. Duas famílias:
//
//  • CADASTRO (lista, ficha, criar, corrigir) = perfis clínicos + SECRETARIA
//    (cadastro.guard.ts). Para a secretaria o service devolve o payload REDUZIDO — nome,
//    registro, nascimento, convênio, médico assistente, agenda — cortado no SELECT: tumor,
//    protocolo e semáforo NÃO SÃO LIDOS do banco para ela, não "escondidos depois". E o que
//    ela manda de clínico no body (tumor, sistema, subtipo, valores_estaveis) é 403.
//  • CLÍNICO (avaliações, seleções) = LeituraClinicaGuard na leitura — era o guard do
//    controller inteiro, quando nasceu o gestor e "leitura = qualquer autenticado" deixou
//    de bastar. Escrita de avaliação — e, com ela, a abertura de uma solicitação de
//    exceção — = ['oncologista','admin'] (OncologistaOuAdminGuard), sem hierarquia: quem
//    trata o paciente é quem registra.
@UseGuards(JwtAuthGuard)
@Controller('pacientes')
export class PacientesController {
  constructor(private pacientesService: PacientesService) {}

  @UseGuards(LeituraCadastroGuard)
  @Get()
  listar(@Request() req: { user: { perfil: Perfil } }) {
    return this.pacientesService.listar(req.user.perfil);
  }

  @UseGuards(CadastroCriarGuard)
  @Post()
  criar(@Body() dto: CriarPacienteDto, @Request() req: { user: { id: number; perfil: Perfil } }) {
    recusarClinicoDaSecretaria(req.user.perfil, dto as unknown as Record<string, unknown>);
    return this.pacientesService.criar({ ...dto, nasc: dto.nasc || null }, req.user.id);
  }

  @UseGuards(LeituraCadastroGuard)
  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number, @Request() req: { user: { perfil: Perfil } }) {
    return this.pacientesService.obter(id, req.user.perfil);
  }

  // Correção de dados cadastrais (nome, identificador, contexto tumoral, valores_estaveis).
  // Whitelist literal (CadastroEditarGuard); a secretaria corrige só o administrativo.
  @UseGuards(CadastroEditarGuard)
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarPacienteDto,
    @Request() req: { user: { perfil: Perfil } },
  ) {
    recusarClinicoDaSecretaria(req.user.perfil, dto as unknown as Record<string, unknown>);
    return this.pacientesService.atualizar(id, dto, req.user.perfil);
  }

  // Remoção administrativa (limpeza de cadastros de teste) — perfil admin apenas.
  // Apaga em cascata as avaliações/seleções do paciente (sem FK órfã).
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.pacientesService.remover(id);
  }

  // Nova avaliação (reavaliação): empilha, não sobrescreve. avaliado_por/data do servidor.
  // Protocolo Inelegível/Não incorporado nasce com autorizacao_estado='pendente' — é a
  // solicitação de exceção; não conta como protocolo vigente até um auditor aprovar.
  @UseGuards(LeituraClinicaGuard, OncologistaOuAdminGuard)
  @Post(':id/avaliacoes')
  criarAvaliacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CriarAvaliacaoDto,
    @Request() req: { user: { id: number; perfil: Perfil } },
  ) {
    return this.pacientesService.criarAvaliacao(id, dto, req.user.id, req.user.perfil);
  }

  @UseGuards(LeituraClinicaGuard)
  @Get(':id/avaliacoes')
  avaliacoes(@Param('id', ParseIntPipe) id: number) {
    return this.pacientesService.avaliacoes(id);
  }

  @UseGuards(LeituraClinicaGuard)
  @Get(':id/selecoes')
  selecoes(@Param('id', ParseIntPipe) id: number) {
    return this.pacientesService.selecoes(id);
  }
}
