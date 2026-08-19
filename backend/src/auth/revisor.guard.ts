import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// Revisão clínica (escrita E leitura do workbench) = whitelist EXPLÍCITA de perfis, sem
// herança hierárquica. (Diferente do RolesGuard, que deriva permissão da posição na
// hierarquia.) O perfil precisa estar literalmente em ['revisor','admin'] — nada de
// "quem for >= revisor".
const PERFIS_REVISAO: Perfil[] = ['revisor', 'admin'];

@Injectable()
export class RevisorOuAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_REVISAO.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: exige perfil revisor ou admin');
    }
    return true;
  }
}
