import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  AUTORIZACAO_VIGENTE, Avaliacao, AutorizacaoEstado, EventoAdministrativo, ImportacaoProposta, ItemListaProblemas,
  LISTAS_PROBLEMAS, ListaProblemas, Paciente, Perfil, Retorno, SelecaoProtocolo, Semaforo,
} from '../database/entities';
import { EvidenciaService } from '../evidencia/evidencia.service';
import { diaLocal, estadoReestadiamento, estadoRetorno, hojeISO, somarMeses } from '../retornos/retornos.service';
import { mapEventoAdministrativo } from '../retornos/eventos-administrativos';

// Payload de uma nova avaliação (reavaliação). data e avaliado_por são do servidor.
export interface NovaAvaliacao {
  regimen_id: string;
  linha_tratamento?: number;
  snapshot_campos: Record<string, any>;
  semaforo: Semaforo;
  detalhe_semaforo?: Record<string, any>;
  // Solicitação de exceção: a app manda 'pendente' ao selecionar um protocolo Inelegível
  // ou Não incorporado. Só estes dois valores são aceitos na criação — 'aprovada'/'negada'
  // são do auditor, nunca de quem registra a avaliação.
  autorizacao_estado?: Extract<AutorizacaoEstado, 'nao_necessaria' | 'pendente'>;
  // Retorno que motivou esta avaliação (conduta = troca_protocolo). Fecha o ciclo
  // retorno → troca: a avaliação nova não fica solta na trilha.
  retorno_id?: number;
}

// Mudança na lista de problemas: itens que entram e itens que saem (por texto), numa das
// três listas. Um PATCH = um evento administrativo na trilha com os +/−.
export interface MudancaListaProblemas {
  lista: ListaProblemas;
  adicionar?: string[];
  remover?: string[];
}
// Comparação de item: sem acento, sem caixa, espaços colapsados — "HAS" e "has" são o
// mesmo problema; "Anlodipino 5 mg" e "anlodipino  5mg" não são tratados como iguais de
// propósito (a dose faz parte do fato).
const normItem = (s: string) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
const ROTULO_LISTA: Record<ListaProblemas, string> = {
  comorbidades: 'comorbidades', medicacoes_uso: 'medicações em uso', alergias: 'alergias',
};
// Nota do evento administrativo: "Lista de problemas atualizada por X: comorbidades +HAS · −DM".
// varchar(280) no banco — corta com marca quando não cabe (a lista em si é a fonte).
const NOTA_EVENTO_MAX = 280;

// Médico assistente do paciente: o profissional do EVENTO MAIS RECENTE — a última
// avaliação (qualquer estado de autorização: registrar já é ato clínico) ou o último
// retorno, o que veio depois. Não há campo "médico responsável" no cadastro, e criar um
// seria uma segunda verdade para manter em dia: quem cuida do paciente é quem registrou
// por último.
//
// "Depois" é exatamente o critério da TRILHA (RetornosService.trilha), e de propósito —
// a lista não pode chamar de "mais recente" um evento que a trilha do paciente mostra no
// meio. São dois níveis: o DIA manda (avaliação é timestamptz, retorno é `date` informado
// pelo médico e lançável depois — comparar como instante jogaria todo retorno do dia para
// antes de uma avaliação da tarde); dentro do mesmo dia desempata o INSTANTE em que o
// registro foi gravado. É isso que faz a troca de protocolo do dia (retorno → avaliação
// nova, minutos depois) ficar com quem assinou a avaliação, e não o contrário.
// Devolve null quando o paciente ainda não tem evento algum (recém-cadastrado) — a lista
// mostra "—" em vez de chutar quem o cadastrou.
export function medicoAssistente(
  avaliacao?: Avaliacao | null,
  retorno?: Retorno | null,
): { id: number; nome: string } | null {
  const ea = avaliacao
    ? { dia: diaLocal(avaliacao.data), inst: new Date(avaliacao.data).getTime(), u: avaliacao.avaliadoPor }
    : null;
  const er = retorno
    ? { dia: retorno.data_realizada, inst: new Date(retorno.criado_em).getTime(), u: retorno.registradoPor }
    : null;
  if (!ea) return er?.u ? { id: er.u.id, nome: er.u.nome } : null;
  if (!er) return ea.u ? { id: ea.u.id, nome: ea.u.nome } : null;
  const u = (er.dia > ea.dia || (er.dia === ea.dia && er.inst > ea.inst)) ? er.u : ea.u;
  return u ? { id: u.id, nome: u.nome } : null;
}

@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(Paciente) private pacienteRepo: Repository<Paciente>,
    @InjectRepository(SelecaoProtocolo) private selecaoRepo: Repository<SelecaoProtocolo>,
    @InjectRepository(Avaliacao) private avaliacaoRepo: Repository<Avaliacao>,
    @InjectRepository(Retorno) private retornoRepo: Repository<Retorno>,
    @InjectRepository(EventoAdministrativo) private eventoAdmRepo: Repository<EventoAdministrativo>,
    @InjectRepository(ImportacaoProposta) private propostaRepo: Repository<ImportacaoProposta>,
    private evidencia: EvidenciaService,
  ) {}

  // Pacientes com proposta de importação PENDENTE — o selo "⏳ aguardando validação
  // clínica" da lista. Estado administrativo (existe/não existe), não conteúdo clínico:
  // entra nos dois payloads, o clínico e o da secretaria (que quer saber se o que enviou
  // já foi validado).
  private async comImportacaoPendente(): Promise<Set<number>> {
    const rows = await this.propostaRepo.createQueryBuilder('p')
      .select('p.paciente_id', 'paciente_id')
      .where('p.estado = :e', { e: 'pendente' })
      .getRawMany<{ paciente_id: number }>();
    return new Set(rows.map((r) => Number(r.paciente_id)));
  }

  // Lista: nome, tumor, data da última avaliação e último semáforo (por paciente).
  // Para a SECRETARIA, a lista administrativa — outro caminho de código, outro SELECT.
  async listar(perfil: Perfil) {
    if (perfil === 'secretaria') return this.listarAdministrativo();
    const pacientes = await this.pacienteRepo.find({ order: { id: 'ASC' } });
    if (!pacientes.length) return [];
    // Última avaliação VIGENTE por paciente (via data máxima). Solicitação de exceção
    // pendente — ou negada — não é o protocolo do paciente: não entra aqui.
    const ultimas = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .distinctOn(['a.paciente_id'])
      .where('a.autorizacao_estado IN (:...vigentes)', { vigentes: AUTORIZACAO_VIGENTE })
      .orderBy('a.paciente_id', 'ASC')
      .addOrderBy('a.data', 'DESC')
      .getMany();
    // Exceções aguardando auditor, por paciente (selo ⏳ na lista).
    const pendentes = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .select('a.paciente_id', 'paciente_id')
      .addSelect('COUNT(*)', 'total')
      .where('a.autorizacao_estado = :e', { e: 'pendente' })
      .groupBy('a.paciente_id')
      .getRawMany<{ paciente_id: number; total: string }>();
    const pendentePorPac = new Map(pendentes.map((t) => [Number(t.paciente_id), Number(t.total)]));
    const totais = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .select('a.paciente_id', 'paciente_id')
      .addSelect('COUNT(*)', 'total')
      .groupBy('a.paciente_id')
      .getRawMany<{ paciente_id: number; total: string }>();
    // Última avaliação por paciente SEM filtro de vigência — é dela que sai o selo
    // "⏳ aguardando autorização" da lista. A pergunta aqui é outra: não "qual é o
    // protocolo do paciente?" (isso é `ultimas`, só vigentes), e sim "a última coisa que
    // o médico registrou está esperando o auditor?". Uma exceção pendente sobre um
    // protocolo vigente antigo deixa as duas colunas discordando de propósito: mostra o
    // vigente E avisa que há decisão parada.
    const ultimasQuaisquer = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .distinctOn(['a.paciente_id'])
      .leftJoinAndSelect('a.avaliadoPor', 'ua')
      .orderBy('a.paciente_id', 'ASC')
      .addOrderBy('a.data', 'DESC')
      .getMany();
    // Último retorno por paciente — o outro candidato a "evento mais recente".
    const ultimosRetornos = await this.retornoRepo
      .createQueryBuilder('r')
      .distinctOn(['r.paciente_id'])
      .leftJoinAndSelect('r.registradoPor', 'ur')
      .orderBy('r.paciente_id', 'ASC')
      .addOrderBy('r.data_realizada', 'DESC')
      .addOrderBy('r.criado_em', 'DESC')
      .getMany();
    const ultimaQualquerPorPac = new Map(ultimasQuaisquer.map((a) => [a.paciente_id, a]));
    const ultimoRetornoPorPac = new Map(ultimosRetornos.map((r) => [r.paciente_id, r]));
    const ultimaPorPac = new Map(ultimas.map((a) => [a.paciente_id, a]));
    const totalPorPac = new Map(totais.map((t) => [Number(t.paciente_id), Number(t.total)]));
    const importPend = await this.comImportacaoPendente();
    return pacientes.map((p) => {
      const u = ultimaPorPac.get(p.id);
      const uq = ultimaQualquerPorPac.get(p.id);
      const ur = ultimoRetornoPorPac.get(p.id);
      return {
        id: p.id,
        nome: p.nome,
        identificador: p.identificador,
        nasc: p.nasc,
        sexo: p.sexo,
        cidade: p.cidade,
        operadora: p.operadora,
        plano: p.plano,
        sistema: p.sistema,
        tumor: p.tumor,
        subtipo: p.subtipo,
        avaliacoes_total: totalPorPac.get(p.id) || 0,
        autorizacoes_pendentes: pendentePorPac.get(p.id) || 0,
        // "Quem não veio": a lista precisa disto por paciente para o badge e o filtro de
        // retornos atrasados. Derivado de uma coluna só — ver estadoRetorno().
        retorno: estadoRetorno(p),
        // Médico assistente DERIVADO, não cadastrado: é quem assinou o evento mais recente
        // do paciente (avaliação ou retorno). Não existe campo "médico responsável" no
        // cadastro, e inventar um criaria uma segunda verdade para manter em dia — quem
        // está cuidando do paciente é quem registrou por último.
        medico_assistente: medicoAssistente(uq, ur),
        ultima_avaliacao: u ? u.data : null,
        // A última avaliação está parada no auditor? Vem da avaliação mais recente
        // qualquer que seja o estado — não do total de pendências do paciente.
        ultima_avaliacao_pendente: !!uq && uq.autorizacao_estado === 'pendente',
        ultimo_semaforo: u ? u.semaforo : null,
        ultimo_regimen_id: u ? u.regimen_id : null,
        ultima_linha: u ? u.linha_tratamento : null,
        // Proposta de importação aguardando validação clínica (selo ⏳ na lista).
        importacao_pendente: importPend.has(p.id),
      };
    });
  }

  // ── SECRETARIA: payload REDUZIDO, cortado no SELECT ──────────────────────────
  // Mesmo desenho da pseudonimização do gestor (custos/recursos): para a secretaria as
  // colunas clínicas do paciente (tumor, sistema, subtipo, valores_estaveis) NEM SÃO
  // SELECIONADAS, e as tabelas de avaliação/retorno são consultadas SÓ pelas colunas que
  // resolvem o médico assistente (quem assinou o evento mais recente) — nunca regimen_id,
  // semáforo, resposta ou conduta. Não é um filtro sobre o payload completo: é um caminho
  // que não passa pelo dado. O teste afirmativo do portão é "a resposta dela não contém o
  // tumor do paciente de teste".
  //
  // Colunas administrativas do cadastro — a lista, num lugar só.
  private static readonly SELECT_ADMINISTRATIVO = {
    id: true, nome: true, identificador: true, nasc: true, sexo: true, cidade: true,
    operadora: true, plano: true, carteirinha: true, peso_kg: true, altura_cm: true,
    proximo_retorno: true, criado_em: true, criado_por: true,
  } as const;

  // Último evento de cada paciente, SÓ com o que o médico assistente precisa: a data e o
  // autor. `getMany` com select explícito devolve entidades parciais — regimen_id e
  // semaforo vêm undefined porque não foram pedidos ao banco.
  private async medicosAssistentes(): Promise<Map<number, { id: number; nome: string } | null>> {
    const avals = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .select(['a.id', 'a.paciente_id', 'a.data', 'ua.id', 'ua.nome'])
      .distinctOn(['a.paciente_id'])
      .leftJoin('a.avaliadoPor', 'ua')
      .orderBy('a.paciente_id', 'ASC')
      .addOrderBy('a.data', 'DESC')
      .getMany();
    const rets = await this.retornoRepo
      .createQueryBuilder('r')
      .select(['r.id', 'r.paciente_id', 'r.data_realizada', 'r.criado_em', 'ur.id', 'ur.nome'])
      .distinctOn(['r.paciente_id'])
      .leftJoin('r.registradoPor', 'ur')
      .orderBy('r.paciente_id', 'ASC')
      .addOrderBy('r.data_realizada', 'DESC')
      .addOrderBy('r.criado_em', 'DESC')
      .getMany();
    const aPorPac = new Map(avals.map((a) => [a.paciente_id, a]));
    const rPorPac = new Map(rets.map((r) => [r.paciente_id, r]));
    const out = new Map<number, { id: number; nome: string } | null>();
    new Set([...aPorPac.keys(), ...rPorPac.keys()]).forEach((pid) => {
      out.set(pid, medicoAssistente(aPorPac.get(pid), rPorPac.get(pid)));
    });
    return out;
  }

  private mapAdministrativo(p: Paciente, medico: { id: number; nome: string } | null, importPend?: Set<number>) {
    return {
      id: p.id,
      nome: p.nome,
      identificador: p.identificador,
      nasc: p.nasc,
      sexo: p.sexo,
      cidade: p.cidade,
      operadora: p.operadora,
      plano: p.plano,
      carteirinha: p.carteirinha,
      peso_kg: p.peso_kg ?? null,
      altura_cm: p.altura_cm ?? null,
      retorno: estadoRetorno(p),
      medico_assistente: medico,
      // Proposta de importação enviada e ainda não validada (existe/não existe — nada do
      // conteúdo). É como a secretaria vê, na lista, o que ainda espera o médico.
      importacao_pendente: importPend ? importPend.has(p.id) : false,
      // Marca explícita: a tela sabe que este é o payload administrativo, e o portão
      // confere que ele vem SEM as chaves clínicas — não só com esta flag.
      administrativo: true,
    };
  }

  async listarAdministrativo() {
    const pacientes = await this.pacienteRepo.find({
      select: PacientesService.SELECT_ADMINISTRATIVO,
      order: { id: 'ASC' },
    });
    if (!pacientes.length) return [];
    const medicos = await this.medicosAssistentes();
    const importPend = await this.comImportacaoPendente();
    return pacientes.map((p) => this.mapAdministrativo(p, medicos.get(p.id) || null, importPend));
  }

  // Ficha administrativa: cadastro + agenda + os eventos administrativos (reagendamentos e
  // contatos), do mais recente para o mais antigo. Nada de avaliação, trilha ou reestadiamento.
  async obterAdministrativo(id: number) {
    const p = await this.pacienteRepo.findOne({
      select: PacientesService.SELECT_ADMINISTRATIVO,
      where: { id },
    });
    if (!p) throw new NotFoundException('Paciente não encontrado');
    const medicos = await this.medicosAssistentes();
    const importPend = await this.comImportacaoPendente();
    return {
      ...this.mapAdministrativo(p, medicos.get(p.id) || null, importPend),
      // SÓ os eventos de agenda (reagendamento, contato). O evento 'lista_problemas'
      // carrega texto clínico na nota ("comorbidades +HAS") — fica fora do payload dela,
      // cortado no WHERE, não escondido depois.
      eventos_administrativos: await this.eventosAdministrativos(id, true),
    };
  }

  // Eventos administrativos de um paciente, mapeados para a resposta. Compartilhado com a
  // trilha do médico (RetornosService.trilha), que os mescla na linha do tempo.
  // `somenteAgenda`: a ficha da secretaria — sem o evento de lista de problemas (clínico).
  async eventosAdministrativos(pacienteId: number, somenteAgenda = false) {
    const rows = await this.eventoAdmRepo.find({
      where: somenteAgenda
        ? { paciente_id: pacienteId, tipo: In(['reagendamento', 'contato']) }
        : { paciente_id: pacienteId },
      relations: { registradoPor: true },
      order: { criado_em: 'DESC', id: 'DESC' },
    });
    return rows.map((e) => mapEventoAdministrativo(e));
  }

  // REGISTRO ÚNICO: o nº de atendimento/registro identifica o doente. Cadastrar de novo
  // um registro existente não cria outro paciente — devolve 409 NOMEANDO quem já está lá,
  // para a tela poder oferecer "abrir a ficha do existente". Vale para o cadastro manual e
  // para a importação (a proposta nasce sobre o paciente, e o paciente nasce por aqui).
  // Nulo/vazio segue livre (n vezes): a trava é sobre o registro, não sobre a ausência dele.
  // A trava que vale é o índice único parcial UQ_pacientes_identificador; esta checagem
  // existe para a mensagem — e a violação do índice (corrida) também vira 409 abaixo.
  private async exigirRegistroLivre(identificador: string | null | undefined, excetoId?: number) {
    const reg = String(identificador ?? '').trim();
    if (!reg) return null;
    const existente = await this.pacienteRepo.findOne({ where: { identificador: reg }, select: { id: true, nome: true } });
    if (existente && existente.id !== excetoId) {
      throw new ConflictException(`Registro ${reg} já cadastrado: ${existente.nome} (#${existente.id})`);
    }
    return reg;
  }

  private static ehViolacaoRegistro(e: any): boolean {
    return e && e.code === '23505' && /UQ_pacientes_identificador/.test(String(e.constraint || e.message || ''));
  }

  // Cadastro do paciente. O tumor é atributo do paciente (não escolha por visita);
  // valores_estaveis guarda os campos_primitivos com estavel:true (biologia imutável).
  async criar(dados: Partial<Paciente>, usuarioId: number) {
    const reg = await this.exigirRegistroLivre(dados.identificador);
    try {
      return await this.pacienteRepo.save(
        this.pacienteRepo.create({ ...dados, identificador: reg, criado_por: usuarioId }),
      );
    } catch (e) {
      if (PacientesService.ehViolacaoRegistro(e)) throw new ConflictException(`Registro ${reg} já cadastrado`);
      throw e;
    }
  }

  // Correção cadastral: aplica só as chaves presentes no body e devolve o paciente — no
  // formato do perfil que corrigiu (a secretaria recebe de volta a ficha administrativa).
  // Trocar o registro para um que já é de outro paciente é o mesmo 409 do cadastro.
  async atualizar(id: number, dados: Partial<Paciente>, perfil: Perfil) {
    const p = await this.pacienteOr404(id);
    if (dados.identificador !== undefined) dados.identificador = await this.exigirRegistroLivre(dados.identificador, id);
    Object.assign(p, dados);
    try {
      await this.pacienteRepo.save(p);
    } catch (e) {
      if (PacientesService.ehViolacaoRegistro(e)) throw new ConflictException(`Registro ${dados.identificador} já cadastrado`);
      throw e;
    }
    return this.obter(id, perfil);
  }

  // Remoção administrativa. Cascata explícita: avaliações e seleções do paciente saem
  // junto, independentemente do ON DELETE do banco (sem FK órfã).
  async remover(id: number) {
    await this.pacienteOr404(id);
    // retornos antes das avaliações: retornos.avaliacao_id referencia avaliacoes.
    await this.eventoAdmRepo.delete({ paciente_id: id });
    await this.propostaRepo.delete({ paciente_id: id });
    await this.retornoRepo.delete({ paciente_id: id });
    await this.avaliacaoRepo.delete({ paciente_id: id });
    await this.selecaoRepo.delete({ paciente_id: id });
    await this.pacienteRepo.delete({ id });
    return { ok: true, id };
  }

  private async pacienteOr404(id: number) {
    const p = await this.pacienteRepo.findOne({
      where: { id },
      relations: { criadoPor: true },
    });
    if (!p) throw new NotFoundException('Paciente não encontrado');
    return p;
  }

  // Paciente + última avaliação (o "protocolo que ele estava") + linha do tempo resumida.
  // Para a SECRETARIA, a ficha administrativa — outro caminho de código, outro SELECT.
  async obter(id: number, perfil: Perfil) {
    if (perfil === 'secretaria') return this.obterAdministrativo(id);
    const p = await this.pacienteOr404(id);
    const avaliacoes = await this.avaliacaoRepo.find({
      where: { paciente_id: id },
      relations: { avaliadoPor: true, autorizacaoAuditor: true },
      order: { data: 'DESC' },
    });
    // Protocolo vigente = última avaliação que NÃO depende de autorização pendente e não
    // foi negada. A pendente/negada continua na linha do tempo, com o seu estado.
    const ultima = avaliacoes.find((a) => AUTORIZACAO_VIGENTE.includes(a.autorizacao_estado)) || null;
    return {
      id: p.id,
      nome: p.nome,
      identificador: p.identificador,
      nasc: p.nasc,
      sexo: p.sexo,
      cidade: p.cidade,
      operadora: p.operadora,
      plano: p.plano,
      carteirinha: p.carteirinha,
      sistema: p.sistema,
      tumor: p.tumor,
      subtipo: p.subtipo,
      // Medidas: a tela de edição precisa delas para pré-preencher. Sem isso, um PATCH
      // vindo daquela tela mandaria null e APAGARIA o peso e a altura do paciente.
      peso_kg: p.peso_kg ?? null,
      altura_cm: p.altura_cm ?? null,
      valores_estaveis: p.valores_estaveis || {},
      // Lista de problemas — de relance na ficha. Sempre as três chaves, sempre lista (a
      // tela não distingue "sem lista" de "vazia": vazia mostra "— nenhuma registrada —").
      comorbidades: p.comorbidades || [],
      medicacoes_uso: p.medicacoes_uso || [],
      alergias: p.alergias || [],
      // Agenda de reestadiamento com "vencido" já derivado do relógio do SERVIDOR — a app
      // não decide o que está vencido a partir da data da máquina do usuário.
      reestadiamento: estadoReestadiamento(p),
      retorno: estadoRetorno(p),
      criado_em: p.criado_em,
      criado_por: p.criadoPor
        ? { id: p.criadoPor.id, nome: p.criadoPor.nome, perfil: p.criadoPor.perfil }
        : null,
      ultima_avaliacao: ultima ? this.mapAvaliacao(ultima) : null,
      // Linha do tempo resumida das avaliações anteriores (sem o snapshot completo).
      linha_do_tempo: avaliacoes.map((a) => ({
        id: a.id,
        data: a.data,
        linha_tratamento: a.linha_tratamento,
        regimen_id: a.regimen_id,
        semaforo: a.semaforo,
        avaliado_por: a.avaliadoPor ? a.avaliadoPor.nome : null,
        autorizacao_estado: a.autorizacao_estado,
        autorizacao_parecer: a.autorizacao_parecer,
        autorizacao_auditor: a.autorizacaoAuditor ? a.autorizacaoAuditor.nome : null,
        autorizacao_decidida_em: a.autorizacao_decidida_em,
      })),
    };
  }

  // ── LISTA DE PROBLEMAS (comorbidades · medicações em uso · alergias) ──────────
  // Escrita direta pela ficha (whitelist literal oncologista/admin, no guard). Adição e
  // remoção por texto; o item nasce com origem "registro manual", autor e instante do
  // servidor. Duplicata (mesmo texto, sem acento/caixa) = 409; remover o que não está = 404.
  // A mudança vira EVENTO administrativo append-only na trilha ("Lista de problemas
  // atualizada por X: comorbidades +HAS · −DM") — as listas são estado mutável, o rastro
  // não. Devolve as três listas e o evento.
  async atualizarListaProblemas(
    pacienteId: number,
    mudanca: MudancaListaProblemas,
    autor: { id: number; nome: string },
    perfilAtivo: Perfil,
  ) {
    await this.pacienteOr404(pacienteId);
    const r = await this.aplicarListaProblemas(pacienteId, [{ ...mudanca, origem: 'registro manual' }], autor, perfilAtivo);
    return {
      comorbidades: r.paciente.comorbidades, medicacoes_uso: r.paciente.medicacoes_uso, alergias: r.paciente.alergias,
      evento: r.evento ? mapEventoAdministrativo(r.evento) : null,
    };
  }

  // Núcleo compartilhado: a validação de uma proposta de importação chama o MESMO caminho
  // (com origem "importação (evolução de …)" e o EntityManager da transação) — um jeito só
  // de escrever nas listas, um jeito só de deixar rastro. Várias listas numa chamada = um
  // evento só, com os +/− de todas. Sem mudança efetiva (tudo já estava lá) = sem evento.
  async aplicarListaProblemas(
    pacienteId: number,
    mudancas: (MudancaListaProblemas & { origem: string })[],
    autor: { id: number; nome: string },
    perfilAtivo: Perfil,
    em?: EntityManager,
    opcoes: { ignorarDuplicata?: boolean } = {},
  ): Promise<{ paciente: Paciente; evento: EventoAdministrativo | null; entraram: number; sairam: number }> {
    const pacienteRepo = em ? em.getRepository(Paciente) : this.pacienteRepo;
    const eventoRepo = em ? em.getRepository(EventoAdministrativo) : this.eventoAdmRepo;
    const p = await pacienteRepo.findOne({ where: { id: pacienteId }, select: { id: true, comorbidades: true, medicacoes_uso: true, alergias: true } });
    if (!p) throw new NotFoundException('Paciente não encontrado');
    const agora = new Date().toISOString();
    const partes: string[] = [];
    const patch: Partial<Paciente> = {};
    let entraram = 0, sairam = 0;
    for (const m of mudancas) {
      if (!LISTAS_PROBLEMAS.includes(m.lista)) throw new BadRequestException(`Lista "${m.lista}" não existe (comorbidades | medicacoes_uso | alergias)`);
      const atual: ItemListaProblemas[] = [...((patch[m.lista] as ItemListaProblemas[]) || p[m.lista] || [])];
      const mais: string[] = [], menos: string[] = [];
      for (const raw of m.remover || []) {
        const idx = atual.findIndex((i) => normItem(i.texto) === normItem(raw));
        if (idx < 0) throw new NotFoundException(`"${raw}" não está em ${ROTULO_LISTA[m.lista]}`);
        menos.push(atual[idx].texto);
        atual.splice(idx, 1);
      }
      for (const raw of m.adicionar || []) {
        const texto = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (!texto) throw new BadRequestException('Item vazio');
        if (atual.some((i) => normItem(i.texto) === normItem(texto))) {
          if (opcoes.ignorarDuplicata) continue;
          throw new ConflictException(`"${texto}" já está em ${ROTULO_LISTA[m.lista]}`);
        }
        atual.push({ texto, origem: m.origem, registrado_por: { id: autor.id, nome: autor.nome }, em: agora });
        mais.push(texto);
      }
      if (!mais.length && !menos.length) continue;
      entraram += mais.length; sairam += menos.length;
      (patch as any)[m.lista] = atual;
      partes.push(`${ROTULO_LISTA[m.lista]} ${[...mais.map((t) => `+${t}`), ...menos.map((t) => `−${t}`)].join(' · ')}`);
    }
    if (!partes.length) return { paciente: p, evento: null, entraram, sairam };
    await pacienteRepo.update({ id: pacienteId }, patch);
    let nota = `Lista de problemas atualizada por ${autor.nome}: ${partes.join('; ')}`;
    if (nota.length > NOTA_EVENTO_MAX) nota = nota.slice(0, NOTA_EVENTO_MAX - 2) + ' …';
    const evento = await eventoRepo.save(eventoRepo.create({
      paciente_id: pacienteId,
      tipo: 'lista_problemas',
      data: hojeISO(),
      data_anterior: null,
      meio: null,
      nota,
      registrado_por: autor.id,
      perfil_ativo: perfilAtivo,
    }));
    const full = await eventoRepo.findOne({ where: { id: evento.id }, relations: { registradoPor: true } });
    const depois = await pacienteRepo.findOne({ where: { id: pacienteId }, select: { id: true, comorbidades: true, medicacoes_uso: true, alergias: true } });
    return { paciente: depois || p, evento: full, entraram, sairam };
  }

  // Histórico completo, ordem cronológica (mais antiga → mais recente).
  async avaliacoes(pacienteId: number) {
    await this.pacienteOr404(pacienteId);
    const rows = await this.avaliacaoRepo.find({
      where: { paciente_id: pacienteId },
      relations: { avaliadoPor: true, autorizacaoAuditor: true },
      order: { data: 'ASC' },
    });
    return rows.map((a) => this.mapAvaliacao(a));
  }

  // Cria uma nova avaliação: EMPILHA, nunca sobrescreve. data e avaliado_por do servidor.
  // `em` opcional: quem chama de dentro de uma TRANSAÇÃO (a validação de uma proposta de
  // importação, que grava primitivos + avaliação + retorno + proposta num ato só) passa o
  // EntityManager dela, e as escritas daqui entram no mesmo commit — ou no mesmo rollback.
  async criarAvaliacao(pacienteId: number, dados: NovaAvaliacao, usuarioId: number, perfilAtivo: Perfil, em?: EntityManager) {
    const avaliacaoRepo = em ? em.getRepository(Avaliacao) : this.avaliacaoRepo;
    const paciente = await this.pacienteOr404(pacienteId);
    // Solicitação de exceção — decidida NO SERVIDOR, não pela app. A app manda
    // 'pendente' (é o que pinta o botão "Selecionar mesmo assim"), mas os dois eixos que
    // exigem exceção são reconferidos aqui, cada um na sua fonte:
    //   Inelegível     → o semáforo do próprio payload;
    //   Não incorporado→ o corpus do squad, lido do disco pelo EvidenciaService.
    // Sem esta segunda checagem, um POST direto sem `autorizacao_estado` faria um
    // protocolo não incorporado nascer VIGENTE, pulando o auditor: a trava seria de
    // tela, não de sistema. O cliente só consegue ser mais restritivo, nunca menos.
    const exigeAutorizacao =
      dados.autorizacao_estado === 'pendente' ||
      dados.semaforo === 'inelegivel' ||
      this.evidencia.naoIncorporado(dados.regimen_id);
    const autorizacao_estado: AutorizacaoEstado = exigeAutorizacao ? 'pendente' : 'nao_necessaria';
    const nova = avaliacaoRepo.create({
      paciente_id: pacienteId,
      avaliado_por: usuarioId,
      // Com que chapéu esta avaliação foi feita — do JWT, nunca do cliente. Ver
      // Avaliacao.perfil_ativo: `avaliadoPor.perfil` responde o que a pessoa é HOJE.
      perfil_ativo: perfilAtivo,
      regimen_id: dados.regimen_id,
      linha_tratamento: dados.linha_tratamento ?? null,
      snapshot_campos: dados.snapshot_campos,
      semaforo: dados.semaforo,
      detalhe_semaforo: dados.detalhe_semaforo ?? null,
      autorizacao_estado,
      retorno_id: dados.retorno_id ?? null,
    });
    const salva = await avaliacaoRepo.save(nova);
    // Selecionar protocolo agenda o reestadiamento (padrão 3 meses, ajustável por paciente).
    // O relógio conta do dia da seleção; um retorno com imagem depois o reancora.
    // SÓ quando a avaliação já é o protocolo vigente: solicitação de exceção pendente pode
    // ser negada, e agendar antes marcaria o calendário por um tratamento que talvez nunca
    // comece. Aprovada, quem agenda é o AutorizacoesService (é ali que ela vira vigente).
    if (autorizacao_estado === 'nao_necessaria') {
      await this.agendarReestadiamento(pacienteId, paciente.intervalo_reestadiamento_meses, em);
    }
    const full = await avaliacaoRepo.findOne({
      where: { id: salva.id },
      relations: { avaliadoPor: true, autorizacaoAuditor: true },
    });
    return this.mapAvaliacao(full);
  }

  // Agenda o próximo reestadiamento a partir de hoje. Público porque a aprovação de uma
  // exceção (AutorizacoesService) também precisa dele: é lá que a avaliação vira vigente.
  async agendarReestadiamento(pacienteId: number, intervaloMeses?: number, em?: EntityManager) {
    const pacienteRepo = em ? em.getRepository(Paciente) : this.pacienteRepo;
    const meses = intervaloMeses
      ?? (await pacienteRepo.findOneBy({ id: pacienteId }))?.intervalo_reestadiamento_meses
      ?? 3;
    const proximo = somarMeses(hojeISO(), meses);
    if (proximo) {
      await pacienteRepo.update({ id: pacienteId }, { proximo_reestadiamento: proximo });
    }
    return proximo;
  }

  private mapAvaliacao(a: Avaliacao) {
    return {
      id: a.id,
      paciente_id: a.paciente_id,
      data: a.data,
      linha_tratamento: a.linha_tratamento,
      regimen_id: a.regimen_id,
      snapshot_campos: a.snapshot_campos,
      semaforo: a.semaforo,
      detalhe_semaforo: a.detalhe_semaforo,
      // Estado da solicitação de exceção (⏳ pendente · ✅ aprovada · ⛔ negada) + parecer.
      autorizacao_estado: a.autorizacao_estado,
      autorizacao_parecer: a.autorizacao_parecer,
      autorizacao_decidida_em: a.autorizacao_decidida_em,
      autorizacao_auditor: a.autorizacaoAuditor
        ? { id: a.autorizacaoAuditor.id, nome: a.autorizacaoAuditor.nome }
        : null,
      retorno_id: a.retorno_id ?? null,
      // Perfil do MOMENTO da avaliação (a.perfil_ativo), com fallback no perfil atual da
      // conta para registros anteriores à coluna.
      avaliado_por: a.avaliadoPor
        ? { id: a.avaliadoPor.id, nome: a.avaliadoPor.nome, perfil: a.perfil_ativo || a.avaliadoPor.perfil }
        : null,
    };
  }

  // ---- Seleções de protocolo (feature existente, mantida) ----
  async selecoes(pacienteId: number) {
    await this.pacienteOr404(pacienteId);
    const rows = await this.selecaoRepo.find({
      where: { paciente_id: pacienteId },
      relations: { selecionadoPor: true },
      order: { criado_em: 'DESC' },
    });
    return rows.map((s) => ({
      id: s.id,
      regimen_id: s.regimen_id,
      protocolo_nome: s.protocolo_nome,
      tumor: s.tumor,
      dados_clinicos: s.dados_clinicos,
      justificativa: s.justificativa,
      selecionado_por: s.selecionadoPor
        ? { id: s.selecionadoPor.id, nome: s.selecionadoPor.nome, perfil: s.selecionadoPor.perfil }
        : null,
      criado_em: s.criado_em,
    }));
  }
}
