import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// Tudo que registra o TRATAMENTO do paciente: avaliação (e, com ela, a abertura de uma
// solicitação de exceção, que nasce 'pendente'), retorno de seguimento e agenda de
// reestadiamento. Whitelist EXPLÍCITA ['oncologista','admin'], sem herança hierárquica —
// mesmo padrão do RevisorOuAdminGuard, e por isso mesmo diferente do RolesGuard, que
// derivaria a permissão da posição na escada ['oncologista','revisor','admin'] e deixaria
// o REVISOR passar. O perfil precisa estar literalmente na lista: quem registra o
// tratamento é quem cuida do paciente. O auditor decide sobre a exceção, mas não a cria;
// o revisor clínico revisa protocolo, não trata paciente.
const PERFIS_TRATAMENTO: Perfil[] = ['oncologista', 'admin'];

@Injectable()
export class OncologistaOuAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_TRATAMENTO.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: exige perfil oncologista ou admin');
    }
    return true;
  }
}
