import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// RECURSOS (insumos, projeção de compra, faturamento, margem) = whitelist EXPLÍCITA
// ['gestor','admin'], sem herança hierárquica — mesmo padrão do AuditorOuAdminGuard.
//
// A assimetria com o módulo de custo é deliberada e vale registrar: o AUDITOR lê custo
// no fluxo de autorização (é a informação de que ele precisa para decidir uma exceção),
// mas NÃO entra em recursos — projeção de compra e margem não são insumo de decisão
// clínica nem de autorização. E o gestor não entra em nada do outro lado. Dois eixos que
// não se cruzam, cada um com a sua lista literal.
const PERFIS_RECURSOS: Perfil[] = ['gestor', 'admin'];

@Injectable()
export class GestorOuAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_RECURSOS.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: exige perfil gestor ou admin');
    }
    return true;
  }
}
