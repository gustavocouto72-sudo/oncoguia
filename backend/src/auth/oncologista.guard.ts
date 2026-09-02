import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// Escrita de avaliação — e, com ela, a ABERTURA de uma solicitação de exceção (a avaliação
// fora do padrão nasce 'pendente'). Whitelist EXPLÍCITA ['oncologista','admin'], sem
// hierarquia: quem registra o tratamento é quem cuida do paciente. O auditor decide sobre a
// exceção, mas não a cria; o revisor clínico revisa protocolo, não trata paciente.
const PERFIS_AVALIACAO: Perfil[] = ['oncologista', 'admin'];

@Injectable()
export class OncologistaOuAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_AVALIACAO.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: exige perfil oncologista ou admin');
    }
    return true;
  }
}
