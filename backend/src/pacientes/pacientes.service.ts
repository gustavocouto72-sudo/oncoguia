import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AUTORIZACAO_VIGENTE, Avaliacao, AutorizacaoEstado, Paciente, Retorno, SelecaoProtocolo, Semaforo,
} from '../database/entities';
import { EvidenciaService } from '../evidencia/evidencia.service';
import { diaLocal, estadoReestadiamento, estadoRetorno, hojeISO, somarMeses } from '../retornos/retornos.service';

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
    private evidencia: EvidenciaService,
  ) {}

  // Lista: nome, tumor, data da última avaliação e último semáforo (por paciente).
  async listar() {
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
      };
    });
  }

  // Cadastro do paciente. O tumor é atributo do paciente (não escolha por visita);
  // valores_estaveis guarda os campos_primitivos com estavel:true (biologia imutável).
  criar(dados: Partial<Paciente>, usuarioId: number) {
    return this.pacienteRepo.save(
      this.pacienteRepo.create({ ...dados, criado_por: usuarioId }),
    );
  }

  // Correção cadastral: aplica só as chaves presentes no body e devolve o paciente completo.
  async atualizar(id: number, dados: Partial<Paciente>) {
    const p = await this.pacienteOr404(id);
    Object.assign(p, dados);
    await this.pacienteRepo.save(p);
    return this.obter(id);
  }

  // Remoção administrativa. Cascata explícita: avaliações e seleções do paciente saem
  // junto, independentemente do ON DELETE do banco (sem FK órfã).
  async remover(id: number) {
    await this.pacienteOr404(id);
    // retornos antes das avaliações: retornos.avaliacao_id referencia avaliacoes.
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
  async obter(id: number) {
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
  async criarAvaliacao(pacienteId: number, dados: NovaAvaliacao, usuarioId: number) {
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
    const nova = this.avaliacaoRepo.create({
      paciente_id: pacienteId,
      avaliado_por: usuarioId,
      regimen_id: dados.regimen_id,
      linha_tratamento: dados.linha_tratamento ?? null,
      snapshot_campos: dados.snapshot_campos,
      semaforo: dados.semaforo,
      detalhe_semaforo: dados.detalhe_semaforo ?? null,
      autorizacao_estado,
      retorno_id: dados.retorno_id ?? null,
    });
    const salva = await this.avaliacaoRepo.save(nova);
    // Selecionar protocolo agenda o reestadiamento (padrão 3 meses, ajustável por paciente).
    // O relógio conta do dia da seleção; um retorno com imagem depois o reancora.
    // SÓ quando a avaliação já é o protocolo vigente: solicitação de exceção pendente pode
    // ser negada, e agendar antes marcaria o calendário por um tratamento que talvez nunca
    // comece. Aprovada, quem agenda é o AutorizacoesService (é ali que ela vira vigente).
    if (autorizacao_estado === 'nao_necessaria') {
      await this.agendarReestadiamento(pacienteId, paciente.intervalo_reestadiamento_meses);
    }
    const full = await this.avaliacaoRepo.findOne({
      where: { id: salva.id },
      relations: { avaliadoPor: true, autorizacaoAuditor: true },
    });
    return this.mapAvaliacao(full);
  }

  // Agenda o próximo reestadiamento a partir de hoje. Público porque a aprovação de uma
  // exceção (AutorizacoesService) também precisa dele: é lá que a avaliação vira vigente.
  async agendarReestadiamento(pacienteId: number, intervaloMeses?: number) {
    const meses = intervaloMeses
      ?? (await this.pacienteRepo.findOneBy({ id: pacienteId }))?.intervalo_reestadiamento_meses
      ?? 3;
    const proximo = somarMeses(hojeISO(), meses);
    if (proximo) {
      await this.pacienteRepo.update({ id: pacienteId }, { proximo_reestadiamento: proximo });
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
      avaliado_por: a.avaliadoPor
        ? { id: a.avaliadoPor.id, nome: a.avaliadoPor.nome, perfil: a.avaliadoPor.perfil }
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
