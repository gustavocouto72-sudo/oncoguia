import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// Escrita de PREÇO = whitelist EXPLÍCITA ['admin'], sem herança hierárquica.
//
// Poderia ser @Roles('admin') + RolesGuard (admin é o topo da escada, então o efeito
// prático hoje é o mesmo). Não é: quem lê preço é ['auditor','admin'] por whitelist, e
// misturar os dois mecanismos no mesmo controller deixa a matriz de permissão dependendo
// de onde cada perfil está na HIERARQUIA — exatamente o acoplamento que o resto do
// módulo evita. Aqui a pergunta é literal: o perfil é 'admin'?
const PERFIS_ESCRITA_CUSTO: Perfil[] = ['admin'];

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_ESCRITA_CUSTO.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: cadastro de custo exige perfil admin');
    }
    return true;
  }
}
