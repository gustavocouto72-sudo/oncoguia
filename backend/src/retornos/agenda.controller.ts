import {
  Body, Controller, Param, ParseIntPipe, Patch, Post, Request, UseGuards, ValidationPipe,
} from '@nestjs/common';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AgendaGuard } from '../auth/cadastro.guard';
import { RetornosService } from './retornos.service';
import { MEIOS_CONTATO } from '../database/entities';
import type { MeioContato, Perfil } from '../database/entities';

// Reagendamento: só a DATA e um motivo curto. Não há `proximo_intervalo` aqui de
// propósito — intervalo é a decisão clínica, e ela não passa por esta rota.
class ReagendarRetornoDto {
  @IsISO8601({}, { message: 'proximo_retorno obrigatório, em ISO (YYYY-MM-DD)' }) proximo_retorno: string;
  @IsString() @IsNotEmpty({ message: 'motivo do reagendamento obrigatório' }) @MaxLength(280) motivo: string;
}

class ContatoDto {
  @IsISO8601({}, { message: 'data do contato obrigatória, em ISO (YYYY-MM-DD)' }) data: string;
  @IsIn(MEIOS_CONTATO, { message: `meio deve ser um de: ${MEIOS_CONTATO.join('|')}` }) meio: MeioContato;
  @IsOptional() @IsString() @MaxLength(280) nota?: string;
}

const PIPE = new ValidationPipe({ whitelist: true, transform: true });

// AGENDA ADMINISTRATIVA do paciente — o que a SECRETARIA escreve. Whitelist literal
// ['oncologista','admin','secretaria'] (AgendaGuard): a secretaria e quem trata.
// Fica FORA do RetornosController porque aquele é LeituraClinicaGuard no controller
// inteiro (trilha, retornos, reestadiamento — clínico, secretaria 403), e estas duas
// rotas são justamente as que ela pode usar. Não existe GET aqui: a secretaria lê os
// eventos na ficha administrativa (GET /pacientes/:id) e o médico, na trilha.
// Não existe UPDATE/DELETE: append-only, correção é linha nova.
@UseGuards(JwtAuthGuard, AgendaGuard)
@Controller('pacientes/:pacienteId')
export class AgendaController {
  constructor(private service: RetornosService) {}

  @Patch('agenda-retorno')
  reagendar(
    @Param('pacienteId', ParseIntPipe) pacienteId: number,
    @Body(PIPE) dto: ReagendarRetornoDto,
    @Request() req: { user: { id: number; perfil: Perfil } },
  ) {
    return this.service.reagendarRetorno(pacienteId, dto, req.user.id, req.user.perfil);
  }

  @Post('contatos')
  contato(
    @Param('pacienteId', ParseIntPipe) pacienteId: number,
    @Body(PIPE) dto: ContatoDto,
    @Request() req: { user: { id: number; perfil: Perfil } },
  ) {
    return this.service.registrarContato(pacienteId, dto, req.user.id, req.user.perfil);
  }
}
