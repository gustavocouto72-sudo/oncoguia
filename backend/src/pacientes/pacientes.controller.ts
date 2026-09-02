import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UseGuards,
} from '@nestjs/common';
import {
  IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PacientesService } from './pacientes.service';
import type { Semaforo } from '../database/entities';

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
  @IsOptional() @IsObject() valores_estaveis?: Record<string, any>;
}

class CriarAvaliacaoDto {
  @IsString() @IsNotEmpty() @MaxLength(160) regimen_id: string;
  @IsOptional() @IsInt() @Min(1) linha_tratamento?: number;
  @IsObject() snapshot_campos: Record<string, any>;
  @IsIn(['elegivel', 'atencao', 'inelegivel']) semaforo: Semaforo;
  @IsOptional() @IsObject() detalhe_semaforo?: Record<string, any>;
  // Retorno que motivou a troca de protocolo (conduta = troca_protocolo). Opcional: a
  // primeira seleção e a reavaliação avulsa não nascem de retorno nenhum.
  @IsOptional() @IsInt() retorno_id?: number;
}

// Leitura = qualquer autenticado. Escrita de avaliação = oncologista (e acima, pela
// hierarquia acumulativa do RolesGuard — idêntico ao HelmCare Nurse).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pacientes')
export class PacientesController {
  constructor(private pacientesService: PacientesService) {}

  @Get()
  listar() {
    return this.pacientesService.listar();
  }

  @Post()
  criar(@Body() dto: CriarPacienteDto, @Request() req: { user: { id: number } }) {
    return this.pacientesService.criar({ ...dto, nasc: dto.nasc || null }, req.user.id);
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.pacientesService.obter(id);
  }

  // Correção de dados cadastrais (nome, identificador, contexto tumoral, valores_estaveis).
  // Perfil oncologista e acima (hierarquia acumulativa do RolesGuard).
  @Roles('oncologista')
  @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarPacienteDto) {
    return this.pacientesService.atualizar(id, dto);
  }

  // Remoção administrativa (limpeza de cadastros de teste) — perfil admin apenas.
  // Apaga em cascata as avaliações/seleções do paciente (sem FK órfã).
  @Roles('admin')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.pacientesService.remover(id);
  }

  // Nova avaliação (reavaliação): empilha, não sobrescreve. avaliado_por/data do servidor.
  @Roles('oncologista')
  @Post(':id/avaliacoes')
  criarAvaliacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CriarAvaliacaoDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.pacientesService.criarAvaliacao(id, dto, req.user.id);
  }

  @Get(':id/avaliacoes')
  avaliacoes(@Param('id', ParseIntPipe) id: number) {
    return this.pacientesService.avaliacoes(id);
  }

  @Get(':id/selecoes')
  selecoes(@Param('id', ParseIntPipe) id: number) {
    return this.pacientesService.selecoes(id);
  }
}
