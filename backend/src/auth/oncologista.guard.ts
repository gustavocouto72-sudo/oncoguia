import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// Escrita da trilha do paciente (retorno, agenda de reestadiamento) = whitelist EXPLÍCITA
// de perfis, sem herança hierárquica — mesmo padrão do RevisorOuAdminGuard, e por isso
// mesmo diferente do RolesGuard, que derivaria a permissão da posição na escada
// ['oncologista','revisor','admin'] e deixaria o REVISOR passar. O perfil precisa estar
// literalmente em ['oncologista','admin']: quem registra o seguimento é quem cuida do
// paciente; o revisor clínico revisa protocolo, não trata paciente.
const PERFIS_SEGUIMENTO: Perfil[] = ['oncologista', 'admin'];

@Injectable()
export class OncologistaOuAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_SEGUIMENTO.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: exige perfil oncologista ou admin');
    }
    return true;
  }
}
