import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Request, UseGuards, ValidationPipe,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsISO8601, IsOptional, IsString,
  Max, MaxLength, Min, Validate, ValidateNested, ValidationArguments, ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { LeituraClinicaGuard } from '../auth/clinico.guard';
import { OncologistaOuAdminGuard } from '../auth/oncologista.guard';
import { CHAVES_INTERVALO, RetornosService } from './retornos.service';
import type { IntervaloRetorno } from './retornos.service';
import type { CondutaRetorno, RespostaRetorno } from '../database/entities';

const RESPOSTAS: RespostaRetorno[] = [
  'resposta_completa', 'resposta_parcial', 'doenca_estavel', 'progressao', 'nao_avaliada',
];

// Regra RECIST no DTO → 400. Não dá para expressá-la empilhando @ValidateIf: as condições
// de um mesmo campo se somam (AND), e aqui os dois ramos são excludentes (com imagem exige
// uma resposta válida; sem imagem PROÍBE qualquer resposta que não seja nao_avaliada).
// Daí um constraint próprio, que enxerga o objeto inteiro.
@ValidatorConstraint({ name: 'respostaRecist', async: false })
export class RespostaRecist implements ValidatorConstraintInterface {
  validate(resposta: unknown, args: ValidationArguments) {
    const { com_imagem } = args.object as CriarRetornoDto;
    if (com_imagem === true) {
      return typeof resposta === 'string' && RESPOSTAS.includes(resposta as RespostaRetorno);
    }
    // Sem imagem (ou com_imagem ausente/inválido — aí quem reclama é o @IsBoolean):
    // só 'nao_avaliada' ou omissão.
    return resposta === undefined || resposta === null || resposta === 'nao_avaliada';
  }

  defaultMessage(args: ValidationArguments) {
    const { com_imagem } = args.object as CriarRetornoDto;
    return com_imagem === true
      ? `resposta obrigatória quando há exame de imagem — uma de: ${RESPOSTAS.join('|')}`
      : 'sem exame de imagem a resposta não pode ser avaliada (RECIST) — envie nao_avaliada ou omita';
  }
}

class ToxicidadeDto {
  @IsString() @IsNotEmpty({ message: 'toxicidade sem nome' }) @MaxLength(160) nome: string;
  // Grau CTCAE. 1–5 fechado: grau 0 não é toxicidade e 6 não existe.
  @IsInt() @Min(1, { message: 'grau da toxicidade deve estar entre 1 e 5' })
  @Max(5, { message: 'grau da toxicidade deve estar entre 1 e 5' })
  grau: number;
}

class CriarRetornoDto {
  // Protocolo em curso sobre o qual o retorno fala. Omitido = a última avaliação do
  // paciente (o service resolve e valida que a avaliação é dele).
  @IsOptional() @IsInt() avaliacao_id?: number;
  // `data_agendada` NÃO entra: para quando este retorno estava previsto é a agenda do
  // paciente, lida pelo servidor. Com forbidNonWhitelisted, mandá-la é 400 — de propósito.
  @IsISO8601({}, { message: 'data_realizada obrigatória, em ISO (YYYY-MM-DD)' }) data_realizada: string;
  // Próximo retorno: a ESCOLHA vem do médico, a DATA sai do servidor (salvo 'especifica').
  @IsOptional() @IsIn(CHAVES_INTERVALO, {
    message: `proximo_intervalo deve ser um de: ${CHAVES_INTERVALO.join('|')}`,
  })
  proximo_intervalo?: IntervaloRetorno;
  @IsOptional() @IsISO8601({}, { message: 'proximo_retorno deve ser uma data ISO (YYYY-MM-DD)' })
  proximo_retorno?: string;
  @IsBoolean({ message: 'com_imagem (houve exame de imagem/reestadiamento?) obrigatório' }) com_imagem: boolean;
  // Sem @IsOptional: ele venceria o constraint e deixaria passar sem a checagem RECIST.
  @Validate(RespostaRecist) resposta?: RespostaRetorno;
  @IsOptional() @IsArray() @ArrayMaxSize(40)
  @ValidateNested({ each: true }) @Type(() => ToxicidadeDto)
  toxicidades?: ToxicidadeDto[];
  @IsIn(['mantem', 'troca_protocolo', 'suspende'], {
    message: 'conduta (mantem|troca_protocolo|suspende) obrigatória',
  })
  conduta: CondutaRetorno;
  @IsOptional() @IsString() @MaxLength(160) fonte_dados?: string;
  @IsOptional() @IsString() @MaxLength(4000) observacoes?: string;
}

// Ajuste da agenda de reestadiamento. Só a agenda é mutável nesta feature.
class ReestadiamentoDto {
  @IsOptional() @IsInt() @Min(1) @Max(24) intervalo_meses?: number;
  @IsOptional() @IsISO8601({}, { message: 'proximo deve ser uma data ISO (YYYY-MM-DD)' }) proximo?: string;
}

// transform:true é necessário para o @Type do array de toxicidades virar ToxicidadeDto —
// sem ele o @ValidateNested não roda sobre nada.
const PIPE = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

// Trilha do paciente. LEITURA = qualquer autenticado (JwtAuthGuard no controller).
// ESCRITA = whitelist EXPLÍCITA ['oncologista','admin'] (OncologistaOuAdminGuard) — o
// revisor NÃO registra seguimento, e a hierarquia do RolesGuard o deixaria passar.
// Não existe rota de UPDATE/DELETE de retorno: o registro é imutável, correção é linha nova.
@UseGuards(JwtAuthGuard, LeituraClinicaGuard)
@Controller('pacientes/:pacienteId')
export class RetornosController {
  constructor(private service: RetornosService) {}

  @Post('retornos')
  @UseGuards(OncologistaOuAdminGuard)
  criar(
    @Param('pacienteId', ParseIntPipe) pacienteId: number,
    @Body(PIPE) dto: CriarRetornoDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.criar(pacienteId, dto, req.user.id);
  }

  @Get('retornos')
  listar(@Param('pacienteId', ParseIntPipe) pacienteId: number) {
    return this.service.listar(pacienteId);
  }

  // Linha do tempo única (avaliações + retornos), cronológica, com o tipo em cada item.
  @Get('trilha')
  trilha(@Param('pacienteId', ParseIntPipe) pacienteId: number) {
    return this.service.trilha(pacienteId);
  }

  @Patch('reestadiamento')
  @UseGuards(OncologistaOuAdminGuard)
  ajustar(
    @Param('pacienteId', ParseIntPipe) pacienteId: number,
    @Body(PIPE) dto: ReestadiamentoDto,
  ) {
    return this.service.ajustarReestadiamento(pacienteId, dto);
  }
}
