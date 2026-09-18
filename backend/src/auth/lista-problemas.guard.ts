import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// LISTA DE PROBLEMAS (comorbidades · medicações em uso · alergias) — escrita direta na
// ficha (PATCH /pacientes/:id/lista-problemas). É dado CLÍNICO, alçada médica: whitelist
// literal ['oncologista','admin'], escrita aqui de novo em vez de importada do
// OncologistaOuAdminGuard para que estreitar uma não estreite a outra por acidente (mesmo
// padrão de importacao.guard.ts). A SECRETARIA não escreve direto — ela transporta esses
// fatos pela proposta de importação, e é a VALIDAÇÃO do oncologista que os grava, com a
// origem "importação (evolução de …)". O revisor lê a ficha, mas não trata o paciente.
const PERFIS_LISTA_PROBLEMAS: Perfil[] = ['oncologista', 'admin'];

@Injectable()
export class ListaProblemasEditarGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_LISTA_PROBLEMAS.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: a lista de problemas é registro clínico — exige perfil oncologista ou admin');
    }
    return true;
  }
}

// CABEÇALHO ONCOLÓGICO (título · linhas tipadas · marcadores · status) — a outra metade da
// lista de problemas, PATCH /pacientes/:id/cabecalho. Mesma alçada, whitelist PRÓPRIA e
// literal: estreitar uma não pode estreitar a outra por acidente. A leitura fica com o
// payload clínico da ficha (o da secretaria nem seleciona a coluna).
const PERFIS_CABECALHO: Perfil[] = ['oncologista', 'admin'];

@Injectable()
export class CabecalhoEditarGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !PERFIS_CABECALHO.includes(user.perfil as Perfil)) {
      throw new ForbiddenException('Acesso negado: o cabeçalho oncológico é registro clínico — exige perfil oncologista ou admin');
    }
    return true;
  }
}
