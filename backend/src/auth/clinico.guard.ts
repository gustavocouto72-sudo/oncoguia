import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// LEITURA CLÍNICA (paciente, trilha, retorno, seleção, revisão) = whitelist EXPLÍCITA.
//
// Este guard nasceu de uma falha encontrada testando a matriz do GESTOR por API direta:
// os controllers de paciente, seleção, retorno e revisão diziam "leitura = qualquer
// autenticado", o que era verdade enquanto todo perfil autenticado era clínico. Com o
// gestor deixou de ser: ele levava 200 em GET /pacientes — com nome, carteirinha e tumor
// de todo mundo — e em GET /revisoes/resumo.
//
// A correção não é uma lista de quem NÃO pode (blacklist envelhece mal: o próximo perfil
// novo nasce com acesso a tudo de novo). É a lista literal de quem PODE. Perfil novo
// entra aqui de propósito, ou não entra.
const PERFIS_LEITURA_CLINICA: Perfil[] = ['oncologista', 'revisor', 'auditor', 'admin'];

@Injectable()
export class LeituraClinicaGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_LEITURA_CLINICA.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: dado clínico exige perfil clínico');
    }
    return true;
  }
}
