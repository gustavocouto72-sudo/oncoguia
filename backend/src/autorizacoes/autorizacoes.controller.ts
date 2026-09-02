import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Request, UseGuards, ValidationPipe } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AuditorOuAdminGuard } from '../auth/auditor.guard';
import { AutorizacoesService, FiltroAutorizacao } from './autorizacoes.service';

class DecidirDto {
  @IsIn(['aprovada', 'negada'], { message: 'decisao deve ser aprovada ou negada' })
  decisao: 'aprovada' | 'negada';

  // Parecer obrigatório NAS DUAS decisões — aprovar sem justificar é tão cego quanto negar.
  // Só o @IsString aqui: vazio ("   ") e tamanho máximo são checados no service, para que
  // a resposta traga UMA mensagem limpa em vez da pilha de erros do class-validator.
  @IsString({ message: 'parecer obrigatório para aprovar ou negar' })
  parecer: string;
}

// Fila de exceções: whitelist EXPLÍCITA ['auditor','admin'], sem hierarquia. Oncologista
// e revisor levam 403 aqui — inclusive batendo direto na URL (a aba escondida na app é
// conveniência, não é o controle de acesso).
@UseGuards(JwtAuthGuard, AuditorOuAdminGuard)
@Controller('autorizacoes')
export class AutorizacoesController {
  constructor(private service: AutorizacoesService) {}

  // GET /autorizacoes?filtro=pendentes|decididas|todas (default: pendentes)
  @Get()
  listar(@Query('filtro') filtro?: string) {
    const f: FiltroAutorizacao =
      filtro === 'decididas' || filtro === 'todas' ? filtro : 'pendentes';
    return this.service.listar(f);
  }

  @Get('contagem')
  contagem() {
    return this.service.contagem();
  }

  // POST /autorizacoes/:id/decidir — decisão única e imutável sobre a solicitação.
  @Post(':id/decidir')
  decidir(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: DecidirDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.decidir(id, dto, req.user.id);
  }
}
