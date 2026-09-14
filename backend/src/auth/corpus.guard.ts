import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// CORPUS DE EVIDÊNCIA (GET /evidencia) = whitelist LITERAL dos cinco perfis que o leem.
//
// O corpus é público interno por decisão (2026-09-07): não há dado de paciente nele, e
// o gestor o lê para nomear protocolos na projeção de compra. Até aqui isso estava
// escrito como `JwtAuthGuard` sozinho — "qualquer autenticado" —, que era verdade
// enquanto a lista de perfis era a que era. É a forma das três falhas catalogadas no
// PORTAO-VERIFICACAO.md: a permissão implícita em outra coisa (o conjunto de perfis de
// hoje) em vez de escrita.
//
// Com a lista literal, PERFIL NOVO ENTRA CONSCIENTEMENTE. A secretaria é o primeiro que
// não entra: ela não lê protocolo, não vê semáforo, e o corpus não lhe serve para nada —
// a decisão de deixá-la fora foi tomada, não herdada. (Pendência 3 do BACKLOG, fechada.)
const PERFIS_CORPUS: Perfil[] = ['oncologista', 'revisor', 'auditor', 'gestor', 'admin'];

@Injectable()
export class CorpusGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_CORPUS.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: o corpus de evidência é dos perfis clínicos e do gestor');
    }
    return true;
  }
}
