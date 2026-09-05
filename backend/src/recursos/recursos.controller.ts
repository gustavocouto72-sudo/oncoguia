import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Request, UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GestorOuAdminGuard } from '../auth/gestor.guard';
import { AdminGuard } from '../auth/admin.guard';
import { RecursosService, Horizonte } from './recursos.service';
import { RecursosCalculoService } from './recursos-calculo.service';
import type { UnidadeApresentacao } from '../database/entities';

const UNIDADES: UnidadeApresentacao[] = ['mg', 'g', 'mcg', 'UI', 'GBq'];

class ApresentacaoDto {
  @IsInt() @Min(1) insumo_id: number;

  @IsString() @MaxLength(120) conteudo: string;

  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(1_000_000)
  conteudo_valor: number;

  @IsIn(UNIDADES, { message: `conteudo_unidade deve ser um de ${UNIDADES.join(', ')}` })
  conteudo_unidade: UnidadeApresentacao;

  @IsOptional() @IsBoolean() padrao?: boolean;

  // Teto de 10 milhões por frasco, como em custos_regime: acima disso é quase certamente
  // centavos digitados como reais, ou um zero a mais — e o erro se multiplica por
  // frascos, por ciclos e por pacientes antes de chegar na tela.
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) preco_compra_tabela: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) preco_compra_negociado: number;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000)
  preco_faturamento?: number | null;

  @IsString() @MaxLength(200) fonte_compra_tabela: string;
  @IsString() @MaxLength(200) fonte_compra_negociado: string;

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsString() @MaxLength(200) fonte_faturamento?: string | null;
}

class InsumoDto {
  @IsString() @MaxLength(120) farmaco: string;
}

class PremissasDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(3) sc_m2: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(400) peso_kg: number;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(1) @Max(200) clearance_ml_min: number;
}

const valida = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });

// GESTÃO DE RECURSOS — visibilidade gestor + admin, por whitelist EXPLÍCITA no SERVIDOR.
//
// Duas camadas, como no controller de custos:
//   • classe  → JwtAuthGuard + GestorOuAdminGuard   (ler projeção, margem, cobertura)
//   • escrita → + AdminGuard                        (cadastrar insumo, preço, premissas)
// Guard de método SOMA ao da classe no Nest: o gestor lê, mas não cadastra.
//
// Oncologista, revisor e AUDITOR levam 403 em todas as rotas daqui — inclusive batendo
// direto na URL. O auditor continua vendo custo no fluxo de autorização (/custos), que é
// outro controller com outra whitelist; projeção de compra e margem não são insumo de
// decisão clínica.
//
// PSEUDONIMIZAÇÃO: as rotas que devolvem carteira recebem o perfil do JWT e montam a
// resposta do gestor SEM nome de paciente — o campo não é apagado depois, é nunca lido.
@UseGuards(JwtAuthGuard, GestorOuAdminGuard)
@Controller('recursos')
export class RecursosController {
  constructor(
    private service: RecursosService,
    private calculo: RecursosCalculoService,
  ) {}

  @Get('premissas')
  premissas() { return this.calculo.premissas(); }

  @Get('insumos')
  insumos() { return this.calculo.listarInsumos(); }

  // Fila do cadastro: os fármacos que o corpus pede, com e sem insumo cadastrado.
  @Get('insumos/corpus')
  farmacosDoCorpus() { return this.calculo.farmacosDoCorpus(); }

  @Get('cobertura')
  cobertura() { return this.calculo.cobertura(); }

  @Get('projecao')
  projecao(
    @Query('horizonte') horizonte: string,
    @Request() req: { user: { perfil: string } },
  ) {
    return this.service.projecao(Number(horizonte || 6) as Horizonte, req.user.perfil);
  }

  // Fica DEPOIS das rotas literais: sem isso, 'premissas' e 'cobertura' cairiam aqui
  // como regimen_id.
  @Get('regime/:regimenId')
  porRegime(@Param('regimenId') regimenId: string) { return this.calculo.porRegime(regimenId); }

  // ---- cadastro (admin) ----------------------------------------------------
  @UseGuards(AdminGuard)
  @Put('premissas')
  salvarPremissas(@Body(valida) dto: PremissasDto, @Request() req: { user: { id: number } }) {
    return this.calculo.salvarPremissas(dto, req.user.id);
  }

  @UseGuards(AdminGuard)
  @Post('insumos')
  criarInsumo(@Body(valida) dto: InsumoDto, @Request() req: { user: { id: number } }) {
    return this.calculo.salvarInsumo(dto.farmaco, req.user.id);
  }

  @UseGuards(AdminGuard)
  @Post('apresentacoes')
  criarApresentacao(@Body(valida) dto: ApresentacaoDto, @Request() req: { user: { id: number } }) {
    return this.calculo.salvarApresentacao(null, dto, req.user.id);
  }

  @UseGuards(AdminGuard)
  @Put('apresentacoes/:id')
  atualizarApresentacao(
    @Param('id', ParseIntPipe) id: number,
    @Body(valida) dto: ApresentacaoDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.calculo.salvarApresentacao(id, dto, req.user.id);
  }

  @UseGuards(AdminGuard)
  @Delete('insumos/:id')
  removerInsumo(@Param('id', ParseIntPipe) id: number) {
    return this.calculo.removerInsumo(id);
  }

  @UseGuards(AdminGuard)
  @Delete('apresentacoes/:id')
  removerApresentacao(@Param('id', ParseIntPipe) id: number) {
    return this.calculo.removerApresentacao(id);
  }
}
