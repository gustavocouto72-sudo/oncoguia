import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Avaliacao,
  CondutaRetorno,
  Paciente,
  Retorno,
  RespostaRetorno,
  ToxicidadeRegistrada,
} from '../database/entities';

// Payload de um retorno. data_realizada vem do médico (o retorno pode ser lançado depois);
// registrado_por e criado_em são do SERVIDOR — nunca do cliente.
export interface NovoRetorno {
  avaliacao_id?: number;
  data_realizada: string;
  // Escolha do médico sobre o próximo retorno. A DATA é sempre calculada pelo servidor
  // (exceto em 'especifica'): aritmética de calendário no cliente vira divergência.
  proximo_intervalo?: IntervaloRetorno;
  proximo_retorno?: string; // só quando proximo_intervalo === 'especifica'
  com_imagem: boolean;
  resposta?: RespostaRetorno;
  toxicidades?: ToxicidadeRegistrada[];
  conduta: CondutaRetorno;
  fonte_dados?: string;
  observacoes?: string;
}

// Data local do servidor em ISO (YYYY-MM-DD). Não usa toISOString(): ele converte para UTC
// e, em fuso negativo, vira o dia seguinte a partir das 21h — o "vencido desde" apareceria
// um dia adiantado à noite.
export function hojeISO(hoje = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`;
}

// Opções de próximo retorno oferecidas no fim do formulário. A chave é o que fica
// registrado (e o que sugere o intervalo da próxima vez); a data é derivada dela.
//   'especifica' → o médico escolhe a data; 'nenhum' → sem retorno programado.
export const INTERVALOS_RETORNO = {
  '3s': { rotulo: '3 semanas', dias: 21 },
  '1m': { rotulo: '1 mês', meses: 1 },
  '2m': { rotulo: '2 meses', meses: 2 },
  '3m': { rotulo: '3 meses', meses: 3 },
  especifica: { rotulo: 'Data específica' },
  nenhum: { rotulo: 'Sem retorno programado' },
} as const;
export type IntervaloRetorno = keyof typeof INTERVALOS_RETORNO;
export const CHAVES_INTERVALO = Object.keys(INTERVALOS_RETORNO) as IntervaloRetorno[];

// Soma dias a uma data ISO, em UTC (sem horário de verão pelo caminho).
export function somarDias(iso: string, dias: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t + dias * 86400000).toISOString().slice(0, 10);
}

// Data do próximo retorno a partir da escolha. `base` é a data REALIZADA deste retorno —
// o relógio do seguimento conta a partir da consulta que acabou de acontecer, não de hoje
// (um retorno lançado com atraso não deve empurrar o próximo).
export function calcularProximoRetorno(
  base: string,
  escolha: IntervaloRetorno | undefined,
  especifica?: string,
): string | null {
  if (!escolha || escolha === 'nenhum') return null;
  if (escolha === 'especifica') return especifica || null;
  const op = INTERVALOS_RETORNO[escolha] as { dias?: number; meses?: number };
  return op.dias != null ? somarDias(base, op.dias) : somarMeses(base, op.meses);
}

// Soma meses a uma data ISO, prendendo no último dia do mês quando o dia não existe no mês
// de destino (31/01 + 1 mês = 28/02, não 03/03 — que é o que o Date faz sozinho).
export function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  const alvoMes = m - 1 + meses;
  const anoAlvo = y + Math.floor(alvoMes / 12);
  const mesAlvo = ((alvoMes % 12) + 12) % 12;
  const ultimoDia = new Date(anoAlvo, mesAlvo + 1, 0).getDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${anoAlvo}-${p(mesAlvo + 1)}-${p(Math.min(d, ultimoDia))}`;
}

// Dia local (YYYY-MM-DD) de um timestamp. A trilha ordena por DIA, não por instante:
// avaliação é timestamptz e retorno é data (sem hora), e comparar os dois como instante
// jogaria todo retorno do dia para antes de uma avaliação da tarde.
export function diaLocal(d: Date | string): string {
  return hojeISO(d instanceof Date ? d : new Date(d));
}

// Estado da agenda de reestadiamento: quando é o próximo, se já venceu e há quantos dias.
// Derivado (não persistido) — o banco guarda só a data; "vencido" depende de hoje.
export function estadoReestadiamento(p: Paciente, hoje = hojeISO()) {
  const proximo = p.proximo_reestadiamento || null;
  const intervalo = p.intervalo_reestadiamento_meses ?? 3;
  if (!proximo) return { proximo: null, intervalo_meses: intervalo, vencido: false, dias_atraso: 0 };
  const vencido = proximo < hoje;
  const dias = vencido
    ? Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${proximo}T00:00:00Z`)) / 86400000)
    : 0;
  return { proximo, intervalo_meses: intervalo, vencido, dias_atraso: dias };
}

// Estado da agenda de RETORNO: quando é o próximo, se já venceu e há quantos dias.
// Derivado (não persistido) — o banco guarda só a data; "vencido" depende de hoje.
//
// "Vencido" já significa "não veio": a agenda é sobrescrita a cada retorno registrado,
// então uma data no passado só sobrevive se ninguém registrou consulta desde então. Não
// existe estado a cruzar — é a mesma coluna respondendo às duas perguntas.
export function estadoRetorno(p: Paciente, hoje = hojeISO()) {
  const proximo = p.proximo_retorno || null;
  if (!proximo) return { proximo: null, vencido: false, dias_atraso: 0 };
  const vencido = proximo < hoje;
  const dias = vencido
    ? Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${proximo}T00:00:00Z`)) / 86400000)
    : 0;
  return { proximo, vencido, dias_atraso: dias };
}

@Injectable()
export class RetornosService {
  constructor(
    @InjectRepository(Retorno) private retornoRepo: Repository<Retorno>,
    @InjectRepository(Paciente) private pacienteRepo: Repository<Paciente>,
    @InjectRepository(Avaliacao) private avaliacaoRepo: Repository<Avaliacao>,
  ) {}

  private async pacienteOr404(id: number) {
    const p = await this.pacienteRepo.findOneBy({ id });
    if (!p) throw new NotFoundException('Paciente não encontrado');
    return p;
  }

  // Cria o retorno: EMPILHA, nunca sobrescreve (não existe rota de UPDATE/DELETE aqui —
  // corrigir um retorno é registrar outro). registrado_por e criado_em são do servidor.
  async criar(pacienteId: number, dados: NovoRetorno, usuarioId: number) {
    const paciente = await this.pacienteOr404(pacienteId);

    // Regra RECIST, segunda trava (a primeira é o DTO, a terceira é o CHECK do banco):
    // sem imagem não há resposta a afirmar.
    const resposta: RespostaRetorno = dados.com_imagem
      ? (dados.resposta || 'nao_avaliada')
      : 'nao_avaliada';
    if (!dados.com_imagem && dados.resposta && dados.resposta !== 'nao_avaliada') {
      throw new BadRequestException(
        'Sem exame de imagem a resposta não pode ser avaliada (RECIST) — envie nao_avaliada ou omita.',
      );
    }

    // Avaliação de referência: a informada (validada como sendo DESTE paciente) ou, por
    // padrão, o protocolo em curso (última avaliação).
    let avaliacao: Avaliacao | null = null;
    if (dados.avaliacao_id != null) {
      avaliacao = await this.avaliacaoRepo.findOneBy({ id: dados.avaliacao_id });
      if (!avaliacao || avaliacao.paciente_id !== pacienteId) {
        throw new BadRequestException('avaliacao_id não pertence a este paciente');
      }
    } else {
      avaliacao = await this.avaliacaoRepo.findOne({
        where: { paciente_id: pacienteId },
        order: { data: 'DESC' },
      });
    }

    // Próximo retorno: a DATA é sempre do servidor. 'especifica' exige a data; qualquer
    // outra escolha é calculada a partir da data realizada. Escolha AUSENTE limpa a
    // agenda — o compromisso que estava marcado acabou de ser cumprido por esta consulta,
    // e deixá-lo de pé faria o paciente aparecer como "não veio" depois de ter vindo.
    if (dados.proximo_intervalo === 'especifica' && !dados.proximo_retorno) {
      throw new BadRequestException('proximo_retorno é obrigatório quando proximo_intervalo é "especifica"');
    }
    const proximoRetorno = calcularProximoRetorno(
      dados.data_realizada, dados.proximo_intervalo, dados.proximo_retorno,
    );

    const novo = this.retornoRepo.create({
      paciente_id: pacienteId,
      avaliacao_id: avaliacao ? avaliacao.id : null,
      regimen_id: avaliacao ? avaliacao.regimen_id : null,
      // Para quando ESTE retorno estava previsto: a agenda vigente agora, não um valor
      // que o cliente mandou.
      data_agendada: paciente.proximo_retorno || null,
      proximo_retorno: proximoRetorno,
      proximo_intervalo: dados.proximo_intervalo || null,
      data_realizada: dados.data_realizada,
      com_imagem: !!dados.com_imagem,
      resposta,
      toxicidades: dados.toxicidades && dados.toxicidades.length ? dados.toxicidades : null,
      conduta: dados.conduta,
      fonte_dados: dados.fonte_dados || null,
      observacoes: dados.observacoes || null,
      registrado_por: usuarioId,
    });
    const salvo = await this.retornoRepo.save(novo);

    // A agenda do paciente passa a apontar para o que foi decidido AGORA (inclusive para
    // null): o retorno que estava previsto foi cumprido por esta consulta.
    const patch: Partial<Paciente> = { proximo_retorno: proximoRetorno };
    // Houve reestadiamento neste retorno → o relógio do reestadiamento reinicia a partir dele.
    if (salvo.com_imagem) {
      const proximo = somarMeses(salvo.data_realizada, paciente.intervalo_reestadiamento_meses ?? 3);
      if (proximo) patch.proximo_reestadiamento = proximo;
    }
    await this.pacienteRepo.update({ id: pacienteId }, patch);

    const full = await this.retornoRepo.findOne({
      where: { id: salvo.id },
      relations: { registradoPor: true },
    });
    return this.map(full);
  }

  async listar(pacienteId: number) {
    await this.pacienteOr404(pacienteId);
    const rows = await this.retornoRepo.find({
      where: { paciente_id: pacienteId },
      relations: { registradoPor: true },
      order: { data_realizada: 'ASC', id: 'ASC' },
    });
    return rows.map((r) => this.map(r));
  }

  // Ajuste da agenda de reestadiamento (intervalo e/ou próxima data). É o único ponto
  // mutável desta feature — e de propósito: agenda é lembrete, não registro clínico.
  async ajustarReestadiamento(
    pacienteId: number,
    dados: { intervalo_meses?: number; proximo?: string | null },
  ) {
    const p = await this.pacienteOr404(pacienteId);
    const patch: Partial<Paciente> = {};
    if (dados.intervalo_meses != null) patch.intervalo_reestadiamento_meses = dados.intervalo_meses;
    if (dados.proximo !== undefined) patch.proximo_reestadiamento = dados.proximo || null;
    // Só o intervalo mudou e já havia agenda: reancora a partir da data em que ela foi
    // marcada — o intervalo novo vale a partir do último reestadiamento, não de hoje.
    if (dados.proximo === undefined && dados.intervalo_meses != null && p.proximo_reestadiamento) {
      const ancora = somarMeses(p.proximo_reestadiamento, -(p.intervalo_reestadiamento_meses ?? 3));
      patch.proximo_reestadiamento = ancora ? somarMeses(ancora, dados.intervalo_meses) : p.proximo_reestadiamento;
    }
    if (Object.keys(patch).length) await this.pacienteRepo.update({ id: pacienteId }, patch);
    const atualizado = await this.pacienteOr404(pacienteId);
    return estadoReestadiamento(atualizado);
  }

  // ── TRILHA ────────────────────────────────────────────────────────────────
  // Linha do tempo ÚNICA do paciente: avaliações (seleção de protocolo) + retornos, em
  // ordem cronológica, cada item com o `tipo` visível. É uma mescla de fontes, não uma
  // tabela nova: cada registro continua imutável na sua tabela.
  //
  // Três tipos: 'avaliacao' (seleção de protocolo), 'retorno' e 'autorizacao'. A
  // autorização NÃO é tabela própria: é a decisão do auditor sobre uma avaliação, e por
  // isso entra como um item PRÓPRIO no dia em que foi decidida — que quase nunca é o dia
  // da seleção. Ver a avaliação pendente em março e a autorização em abril, cada uma no
  // seu lugar, é justamente o que a trilha existe para mostrar. A solicitação em si
  // (⏳ pendente) viaja no item da avaliação, que é onde ela nasceu.
  async trilha(pacienteId: number) {
    const p = await this.pacienteOr404(pacienteId);
    const [avaliacoes, retornos] = await Promise.all([
      this.avaliacaoRepo.find({
        where: { paciente_id: pacienteId },
        relations: { avaliadoPor: true, autorizacaoAuditor: true },
        order: { data: 'ASC' },
      }),
      this.retornoRepo.find({
        where: { paciente_id: pacienteId },
        relations: { registradoPor: true },
        order: { data_realizada: 'ASC' },
      }),
    ]);

    const itens: any[] = [];
    for (const a of avaliacoes) {
      itens.push({
        tipo: 'avaliacao',
        id: a.id,
        data: a.data,
        // Chave de ordenação em dois níveis: o DIA manda; dentro do mesmo dia desempata o
        // instante em que o registro foi feito (aqui, a própria data da avaliação).
        _dia: diaLocal(a.data),
        _instante: new Date(a.data).getTime(),
        linha_tratamento: a.linha_tratamento,
        regimen_id: a.regimen_id,
        semaforo: a.semaforo,
        detalhe_semaforo: a.detalhe_semaforo,
        snapshot_campos: a.snapshot_campos,
        retorno_id: a.retorno_id ?? null, // ≠ null: nasceu de um retorno (troca de protocolo)
        // Estado da solicitação de exceção desta seleção (⏳ pendente aparece aqui; a
        // decisão vira item próprio, abaixo).
        autorizacao_estado: a.autorizacao_estado,
        por: a.avaliadoPor
          ? { id: a.avaliadoPor.id, nome: a.avaliadoPor.nome, perfil: a.avaliadoPor.perfil }
          : null,
      });
      // Decisão do auditor: item próprio, no dia em que foi decidida.
      if (a.autorizacao_decidida_em) {
        itens.push({
          tipo: 'autorizacao',
          id: a.id, // é a mesma avaliação: a decisão não tem id próprio
          avaliacao_id: a.id,
          data: a.autorizacao_decidida_em,
          _dia: diaLocal(a.autorizacao_decidida_em),
          _instante: new Date(a.autorizacao_decidida_em).getTime(),
          estado: a.autorizacao_estado, // aprovada | negada
          regimen_id: a.regimen_id,
          parecer: a.autorizacao_parecer,
          por: a.autorizacaoAuditor
            ? { id: a.autorizacaoAuditor.id, nome: a.autorizacaoAuditor.nome, perfil: a.autorizacaoAuditor.perfil }
            : null,
        });
      }
    }
    for (const r of retornos) {
      itens.push({
        tipo: 'retorno',
        id: r.id,
        data: r.data_realizada,
        // O retorno tem data (o médico a informa; pode ser lançado depois), mas não tem
        // hora — dentro do dia, quem desempata é o momento em que foi REGISTRADO.
        _dia: r.data_realizada,
        _instante: new Date(r.criado_em).getTime(),
        data_agendada: r.data_agendada,
        proximo_retorno: r.proximo_retorno,
        proximo_intervalo: r.proximo_intervalo,
        avaliacao_id: r.avaliacao_id,
        regimen_id: r.regimen_id,
        com_imagem: r.com_imagem,
        resposta: r.resposta,
        toxicidades: r.toxicidades || [],
        conduta: r.conduta,
        fonte_dados: r.fonte_dados,
        observacoes: r.observacoes,
        por: r.registradoPor
          ? { id: r.registradoPor.id, nome: r.registradoPor.nome, perfil: r.registradoPor.perfil }
          : null,
      });
    }
    // Cronológica: dia, depois o instante do registro, depois o id (ordem de gravação).
    const ordemTipo = { avaliacao: 0, retorno: 1, autorizacao: 2 };
    itens.sort((x, y) =>
      (x._dia < y._dia ? -1 : x._dia > y._dia ? 1 : 0) || x._instante - y._instante
      || x.id - y.id || ordemTipo[x.tipo] - ordemTipo[y.tipo]);
    itens.forEach((i) => { delete i._dia; delete i._instante; });

    return {
      paciente_id: pacienteId,
      reestadiamento: estadoReestadiamento(p),
      retorno: estadoRetorno(p),
      itens,
    };
  }

  private map(r: Retorno) {
    return {
      id: r.id,
      paciente_id: r.paciente_id,
      avaliacao_id: r.avaliacao_id,
      regimen_id: r.regimen_id,
      data_agendada: r.data_agendada,
      data_realizada: r.data_realizada,
      proximo_retorno: r.proximo_retorno,
      proximo_intervalo: r.proximo_intervalo,
      com_imagem: r.com_imagem,
      resposta: r.resposta,
      toxicidades: r.toxicidades || [],
      conduta: r.conduta,
      fonte_dados: r.fonte_dados,
      observacoes: r.observacoes,
      registrado_por: r.registradoPor
        ? { id: r.registradoPor.id, nome: r.registradoPor.nome, perfil: r.registradoPor.perfil }
        : null,
      criado_em: r.criado_em,
    };
  }
}
