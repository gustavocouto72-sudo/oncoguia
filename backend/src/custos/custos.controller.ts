import {
  Body, Controller, Get, Param, ParseIntPipe, Put, Query, Request, UseGuards, ValidationPipe,
} from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GestorOuAdminGuard } from '../auth/gestor.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CustosService } from './custos.service';

class SalvarCustoDto {
  // Teto de 10 milhões por ciclo: acima disso é quase certamente centavos digitados como
  // reais, ou um zero a mais. Erro de digitação em preço vira total de carteira absurdo.
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'custo_ciclo_tabela deve ser número com até 2 casas' })
  @Min(0) @Max(10_000_000)
  custo_ciclo_tabela: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'custo_ciclo_negociado deve ser número com até 2 casas' })
  @Min(0) @Max(10_000_000)
  custo_ciclo_negociado: number;

  @IsString() @MaxLength(200)
  fonte_tabela: string;

  @IsString() @MaxLength(200)
  fonte_negociado: string;

  // "O preço cobre quantos dias?" — dado ADMINISTRATIVO, declarado por quem cadastra.
  // Só é usado quando o esquema não dá o intervalo (oral diário contínuo). Opcional e
  // nullable: ausente significa "preço por ciclo, intervalo vem do esquema", nunca 30.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt({ message: 'periodo_dias deve ser um número inteiro de dias' })
  @Min(1) @Max(365)
  periodo_dias?: number | null;
}

// EXPECTATIVA DE CUSTO — visibilidade gestor + admin, por whitelist EXPLÍCITA no
// SERVIDOR. A app esconder o bloco é cortesia; o controle é aqui. Oncologista, revisor e
// AUDITOR levam 403 em TODAS as rotas deste controller, inclusive batendo direto na URL.
//
// O AUDITOR SAIU DAQUI (era ['auditor','admin']). Decisão de papel, não de tela: quem
// autoriza uma exceção decide MÉRITO — a evidência sustenta este protocolo para este
// paciente? —, e o preço não é insumo dessa pergunta. Ter o número à vista no momento da
// decisão convida a resposta errada pelo motivo errado, e o convite não deixa rastro no
// parecer. Dinheiro é assunto de gestor e admin, e só na aba Recursos.
//
// A rota de decidir exceção (/autorizacoes) NÃO mudou: o auditor segue decidindo. O que
// mudou é o que ele consegue ver enquanto decide.
//
// Duas camadas, de propósito:
//   • classe    → JwtAuthGuard + GestorOuAdminGuard   (ler custo/estimativa)
//   • escrita   → + AdminGuard                        (cadastrar preço)
// Guard de método SOMA ao da classe no Nest, então PUT roda os três: gestor lê, mas
// não cadastra.
@UseGuards(JwtAuthGuard, GestorOuAdminGuard)
@Controller('custos')
export class CustosController {
  constructor(private service: CustosService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Get('cobertura')
  cobertura() {
    return this.service.cobertura();
  }

  // Recebe o perfil porque a carteira lista PACIENTES: para o gestor a resposta sai sem
  // nome, como já acontece em /recursos/projecao. Abrir a rota para o gestor sem isso
  // teria entregado nome de paciente ao único perfil que nunca deve ver nenhum.
  @Get('carteira')
  carteira(@Request() req: { user: { perfil: string } }) {
    return this.service.carteira(req.user.perfil);
  }

  // GET /custos/estimativas?ids=a,b,c — lote, para a app pintar uma lista sem N chamadas.
  @Get('estimativas')
  estimativas(@Query('ids') ids?: string) {
    const lista = String(ids || '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.service.estimativas(lista);
  }

  @Get('paciente/:id')
  porPaciente(@Param('id', ParseIntPipe) id: number) {
    return this.service.porPaciente(id);
  }

  // Fica DEPOIS das rotas literais: sem isso, 'cobertura' e 'carteira' cairiam aqui como
  // regimen_id.
  @Get('estimativa/:regimenId')
  estimativa(@Param('regimenId') regimenId: string) {
    return this.service.estimativa(regimenId);
  }

  // Cadastro de preço — ADMIN. Upsert por regimen_id.
  @UseGuards(AdminGuard)
  @Put(':regimenId')
  salvar(
    @Param('regimenId') regimenId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: SalvarCustoDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.salvar(regimenId, dto, req.user.id);
  }
}
