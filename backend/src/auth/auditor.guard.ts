import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// Autorização de exceção (fila + decisão) = whitelist EXPLÍCITA de perfis, sem herança
// hierárquica — mesmo padrão do RevisorOuAdminGuard. O perfil precisa estar literalmente
// em ['auditor','admin']: 'auditor' não é degrau de escada, é eixo próprio. Oncologista e
// revisor recebem 403 aqui, inclusive batendo direto na URL.
const PERFIS_AUTORIZACAO: Perfil[] = ['auditor', 'admin'];

@Injectable()
export class AuditorOuAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_AUTORIZACAO.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: exige perfil auditor ou admin');
    }
    return true;
  }
}
