import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import type { Perfil } from '../database/entities';

export type { Perfil };

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Perfil[]) => SetMetadata(ROLES_KEY, roles);

// Índice maior = mais permissões (herança acumulativa para cima).
// 'auditor' NÃO está aqui de propósito: é um eixo próprio (autoriza exceção de protocolo),
// não um degrau da escada — quem decide isso é o AuditorOuAdminGuard, por whitelist. Perfil
// fora desta lista não herda nada e cai no bloqueio explícito abaixo.
const HIERARQUIA: Perfil[] = ['oncologista', 'revisor', 'admin'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Perfil[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) return false;

    const nivelUsuario = HIERARQUIA.indexOf(user.perfil as Perfil);
    const nivelMinimo = Math.min(...required.map((r) => HIERARQUIA.indexOf(r)));

    // Perfil fora da hierarquia (auditor): nunca herda por posição — só passa em rota
    // que o autorize por whitelist explícita.
    if (nivelUsuario < 0 || nivelUsuario < nivelMinimo) {
      throw new ForbiddenException('Acesso negado: perfil sem permissão');
    }
    return true;
  }
}
