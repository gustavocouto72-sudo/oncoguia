import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// IMPORTAÇÃO DE PACIENTES — duas alçadas, quatro whitelists literais, uma por pergunta
// (padrão de cadastro.guard.ts). Perfil novo entra aqui de propósito, ou não entra.
//
// A fronteira é a mesma do perfil secretaria (administrativo = dela; clínico = nunca),
// com um envelope no meio: ela ENVIA a proposta (dados transcritos do prontuário, com o
// trecho de evidência), mas o conteúdo clínico não é alçada dela — nem o que ela mesma
// postou. Quem lê o payload, corrige e VALIDA (ou descarta) é quem trata o paciente.

// ENVIAR proposta (POST /pacientes/:id/importacao-proposta) — e, por extensão, pedir a
// EXTRAÇÃO do PDF (POST /importacao/extrair). Secretaria, oncologista e admin.
//
// O oncologista entrou em 2026-09-17 (pedido da direção): até então ele "registrava
// direto" e a proposta era só o envelope da secretaria. Com a leitura do PDF, o caminho
// PDF → extração → proposta é o que poupa a digitação também para ele — e quando é ele
// quem importa, ele mesmo valida em seguida (o validador é quem trata o paciente; não há
// regra de conflito aqui, ao contrário da autorização de exceção, porque as duas pontas
// são a mesma alçada clínica). A proposta continua sendo envelope: nada vira registro
// antes do clique de Validar, seja de quem for.
const PERFIS_PROPOR: Perfil[] = ['secretaria', 'oncologista', 'admin'];

// LER a proposta (GET /pacientes/:id/importacao-proposta). Oncologista e admin recebem
// o payload completo; a secretaria recebe SÓ {estado, criada_em} — é o serviço que
// corta, este guard só decide quem entra.
const PERFIS_LER: Perfil[] = ['oncologista', 'admin', 'secretaria'];

// DECIDIR — validar ou descartar (POST /importacao-propostas/:id/validar|descartar). É o
// ato que grava registro clínico assinado: quem trata o paciente. Mesma lista da escrita
// de avaliação (OncologistaOuAdminGuard), escrita aqui de novo em vez de importada para
// que estreitar uma não estreite a outra por acidente.
const PERFIS_DECIDIR: Perfil[] = ['oncologista', 'admin'];

// VOCABULÁRIO do formulário (GET /importacao/vocabulario): tumores, campos primitivos e
// nomes de protocolo — o dicionário que a secretaria precisa para transcrever, sem o
// corpus (critérios, referências, grade, custo ficam em /evidencia, onde ela é 403).
// Mesma lista de quem propõe: o formulário de importação é desenhado a partir daqui, e o
// oncologista (que já lê o corpus inteiro em /evidencia) não ganha informação nova.
const PERFIS_VOCABULARIO: Perfil[] = ['secretaria', 'oncologista', 'admin'];

function guardDe(lista: Perfil[], msg: string) {
  @Injectable()
  class G implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
      const { user } = ctx.switchToHttp().getRequest();
      if (!user || !lista.includes(user.perfil as Perfil)) throw new ForbiddenException(msg);
      return true;
    }
  }
  return G;
}

export const ImportacaoProporGuard = guardDe(PERFIS_PROPOR, 'Acesso negado: enviar proposta de importação exige perfil secretaria, oncologista ou admin');
export const ImportacaoLerGuard = guardDe(PERFIS_LER, 'Acesso negado: proposta de importação exige oncologista, admin ou secretaria');
export const ImportacaoDecidirGuard = guardDe(PERFIS_DECIDIR, 'Acesso negado: validar ou descartar proposta exige oncologista ou admin');
export const ImportacaoVocabularioGuard = guardDe(PERFIS_VOCABULARIO, 'Acesso negado: vocabulário de importação exige perfil secretaria, oncologista ou admin');
