import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import type { Perfil } from '../database/entities';

// CADASTRO ADMINISTRATIVO do paciente — o eixo da SECRETARIA. Três whitelists literais,
// uma por pergunta, no padrão dos irmãos (clinico.guard.ts, gestor.guard.ts): perfil novo
// entra aqui de propósito, ou não entra.
//
// A fronteira que estas listas desenham: administrativo = da secretaria; clínico = nunca.
// Ela lê a LISTA e a FICHA (payload REDUZIDO, cortado no SELECT do servidor — ver
// PacientesService.listar/obter com perfil 'secretaria'), cadastra e corrige os campos
// administrativos (nome/iniciais, registro, nascimento, convênio, carteirinha, medidas),
// move a DATA do próximo retorno e registra contato com faltoso. Não cria retorno do zero
// (o intervalo é decisão clínica do médico), não vê tumor, protocolo, semáforo, trilha,
// evidência nem dinheiro — cada uma dessas rotas tem a própria whitelist, e ela não está
// em nenhuma.

// LEITURA DO CADASTRO: quem abre GET /pacientes e GET /pacientes/:id. Os quatro perfis
// clínicos recebem o payload completo; a secretaria recebe o administrativo. A distinção
// é do SERVICE (corte no SELECT), não deste guard — ele só decide quem entra.
const PERFIS_LEITURA_CADASTRO: Perfil[] = ['oncologista', 'revisor', 'auditor', 'admin', 'secretaria'];

// CADASTRAR paciente (POST /pacientes). Os quatro clínicos já cadastravam (era "leitura
// clínica = pode criar"); o efeito deles fica como está — estreitar é decisão separada, não
// efeito colateral do perfil novo. A secretaria entra. O que ela NÃO pode mandar no body
// (tumor, sistema, subtipo, valores_estaveis) é recusado no controller, com 403.
const PERFIS_CADASTRO_CRIAR: Perfil[] = ['oncologista', 'revisor', 'auditor', 'admin', 'secretaria'];

// CORRIGIR cadastro (PATCH /pacientes/:id). Era `@Roles('oncologista')` no RolesGuard
// hierárquico — na prática oncologista, revisor e admin. Mesma regra: efeito preservado
// em lista literal, secretaria entra, campos clínicos dela recusados no controller.
const PERFIS_CADASTRO_EDITAR: Perfil[] = ['oncologista', 'revisor', 'admin', 'secretaria'];

// AGENDA E CONTATO (PATCH /pacientes/:id/agenda-retorno, POST /pacientes/:id/contatos):
// a secretaria e quem trata o paciente. Revisor e auditor não cuidam de agenda — nem
// antes existia rota para isso.
const PERFIS_AGENDA: Perfil[] = ['oncologista', 'admin', 'secretaria'];

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

export const LeituraCadastroGuard = guardDe(PERFIS_LEITURA_CADASTRO, 'Acesso negado: cadastro de paciente exige perfil clínico ou secretaria');
export const CadastroCriarGuard = guardDe(PERFIS_CADASTRO_CRIAR, 'Acesso negado: cadastrar paciente exige perfil clínico ou secretaria');
export const CadastroEditarGuard = guardDe(PERFIS_CADASTRO_EDITAR, 'Acesso negado: corrigir cadastro exige oncologista, revisor, admin ou secretaria');
export const AgendaGuard = guardDe(PERFIS_AGENDA, 'Acesso negado: agenda e contato exigem oncologista, admin ou secretaria');

// Campos do cadastro que são CLÍNICOS: a secretaria não os manda, nem para criar nem para
// corrigir. Recusa explícita (403), não descarte silencioso — descartar deixaria a tela
// dela "salvar" um tumor que o servidor ignorou, e ninguém saberia.
export const CAMPOS_CLINICOS_CADASTRO = ['sistema', 'tumor', 'subtipo', 'valores_estaveis'] as const;
export function recusarClinicoDaSecretaria(perfil: Perfil, body: Record<string, unknown>) {
  if (perfil !== 'secretaria') return;
  const enviados = CAMPOS_CLINICOS_CADASTRO.filter((k) => body[k] !== undefined);
  if (enviados.length) {
    throw new ForbiddenException(`Perfil secretaria não altera dado clínico do paciente: ${enviados.join(', ')}`);
  }
}
