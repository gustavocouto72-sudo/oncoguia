import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// DINHEIRO (custo por ciclo, estimativa, insumos, projeção de compra, faturamento,
// margem) = whitelist EXPLÍCITA ['gestor','admin'], sem herança hierárquica — mesmo
// padrão do AuditorOuAdminGuard. Guarda os DOIS controllers do assunto: /recursos e
// /custos.
//
// Este guard já cobria só /recursos, e o AUDITOR lia custo em /custos. Não lê mais: quem
// autoriza uma exceção decide MÉRITO — a evidência sustenta este protocolo para este
// paciente? — e o preço não é insumo dessa pergunta. Deixar o número à vista no momento
// da decisão convida a resposta errada pelo motivo errado, e o convite não deixa rastro
// nenhum no parecer. Financeiro é de gestor e admin, e só na aba Recursos.
//
// E o gestor não entra em nada do outro lado: nem paciente, nem Revisão, nem a fila de
// autorização. Dois eixos que não se cruzam, cada um com a sua lista literal.
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
