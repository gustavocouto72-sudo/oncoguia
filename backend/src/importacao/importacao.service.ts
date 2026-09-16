import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ImportacaoProposta, Paciente, Perfil } from '../database/entities';
import { EvidenciaService } from '../evidencia/evidencia.service';
import { PacientesService } from '../pacientes/pacientes.service';
import { RetornosService } from '../retornos/retornos.service';

// O envelope como chega da secretaria (ou, na entrega 2, da extração). Guardado em
// `payload` sem alteração; a validação lê daqui e escreve o que produziu em `resultado`.
export interface CampoProposto { campo: string; valor: any; trecho?: string | null }
export interface MetaProposta {
  data_inicio?: string | null;             // início do tratamento em curso (YYYY-MM-DD)
  data_evolucao?: string | null;           // evolução de onde os dados foram lidos
  proximo_retorno?: string | null;         // próximo retorno já marcado pela equipe
  medico_assistente_texto?: string | null; // como está no prontuário (texto livre)
  sem_campo?: string[] | null;             // fatos sem campo no sistema, citados na nota
  historico?: string | null;               // resumo livre do histórico
  protocolo_texto?: string | null;         // o protocolo como está escrito no PDF
}
export interface PropostaPayload {
  tumor: string;
  sistema?: string | null;
  subtipo?: string | null;
  regimen_id?: string | null;
  linha_tratamento?: number | null;
  campos: CampoProposto[];
  meta?: MetaProposta | null;
}

// Correções do validador: campo a campo (o que vier SUBSTITUI o proposto; `valor: null`
// remove o campo), mais protocolo e linha. Booleano tem de vir explícito — ausente NÃO
// vira false: o snapshot só carrega o que foi informado (regra do piloto #80).
export interface CorrecoesValidacao {
  campos?: CampoProposto[] | Record<string, any>;
  regimen_id?: string | null;
  linha_tratamento?: number | null;
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const fmtBR = (iso?: string | null) => {
  if (!iso || !ISO_DIA.test(iso)) return iso || '—';
  const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`;
};
// Limite pragmático da nota: `observacoes` do retorno é text, mas o DTO do retorno aceita
// 4000 — a nota montada aqui respeita o mesmo teto. `historico` é o único trecho livre e
// é o que se corta, com marca, para nenhum FATO (datas, médico, sem_campo) se perder.
const NOTA_MAX = 4000;

@Injectable()
export class ImportacaoService {
  constructor(
    @InjectRepository(ImportacaoProposta) private propostaRepo: Repository<ImportacaoProposta>,
    @InjectRepository(Paciente) private pacienteRepo: Repository<Paciente>,
    private evidencia: EvidenciaService,
    private pacientes: PacientesService,
    private retornos: RetornosService,
    private dataSource: DataSource,
  ) {}

  private async pacienteOr404(id: number) {
    const p = await this.pacienteRepo.findOneBy({ id });
    if (!p) throw new NotFoundException('Paciente não encontrado');
    return p;
  }

  // ── validação do envelope (na criação E nas correções) ────────────────────
  // O vocabulário do tumor decide o que é campo válido e de que tipo. Campo fora do
  // vocabulário é 400, não descarte silencioso — descartar deixaria a secretaria "enviar"
  // um dado que o servidor ignorou, e ninguém saberia. Valor null é "não informado".
  private validarCampos(tumor: string, campos: CampoProposto[]): CampoProposto[] {
    const specs = this.evidencia.primMap(tumor);
    if (!Object.keys(specs).length) {
      throw new BadRequestException(`Tumor "${tumor}" não tem campos primitivos no corpus — importação sem elegibilidade computável não é suportada`);
    }
    const vistos = new Set<string>();
    const out: CampoProposto[] = [];
    for (const c of campos || []) {
      if (!c || typeof c.campo !== 'string') throw new BadRequestException('Campo da proposta sem nome');
      const s = specs[c.campo];
      if (!s) throw new BadRequestException(`Campo "${c.campo}" não existe no vocabulário de ${tumor}`);
      if (vistos.has(c.campo)) throw new BadRequestException(`Campo "${c.campo}" repetido na proposta`);
      vistos.add(c.campo);
      const v = c.valor;
      if (v === null || v === undefined || v === '') { out.push({ campo: c.campo, valor: null, trecho: c.trecho ?? null }); continue; }
      if (s.tipo === 'boolean' && typeof v !== 'boolean') {
        throw new BadRequestException(`Campo "${c.campo}" é booleano — envie true ou false explícito (recebido: ${JSON.stringify(v)})`);
      }
      if (s.tipo === 'enum') {
        const ops = (s.opcoes || []).map(String);
        if (!ops.includes(String(v))) throw new BadRequestException(`Campo "${c.campo}": valor "${v}" fora das opções (${ops.join('|')})`);
      }
      if (['integer', 'number', 'score'].includes(String(s.tipo)) && (typeof v !== 'number' || !Number.isFinite(v))) {
        throw new BadRequestException(`Campo "${c.campo}" é numérico (recebido: ${JSON.stringify(v)})`);
      }
      out.push({ campo: c.campo, valor: v, trecho: typeof c.trecho === 'string' ? c.trecho.slice(0, 500) : null });
    }
    return out;
  }

  private validarRegime(tumor: string, regimenId?: string | null) {
    if (!regimenId) return null;
    const r = this.evidencia.regime(regimenId);
    if (!r) throw new BadRequestException(`Protocolo "${regimenId}" não existe no corpus`);
    if (String(r.tumor) !== tumor) throw new BadRequestException(`Protocolo "${regimenId}" é de ${r.tumor}, não de ${tumor}`);
    return String(r.regimen_id);
  }

  private validarMeta(meta?: MetaProposta | null): MetaProposta {
    const m = meta || {};
    for (const k of ['data_inicio', 'data_evolucao', 'proximo_retorno'] as const) {
      if (m[k] != null && m[k] !== '' && !ISO_DIA.test(String(m[k]))) {
        throw new BadRequestException(`meta.${k} deve ser uma data ISO (YYYY-MM-DD)`);
      }
    }
    if (m.sem_campo != null && !Array.isArray(m.sem_campo)) throw new BadRequestException('meta.sem_campo deve ser uma lista');
    return {
      data_inicio: m.data_inicio || null,
      data_evolucao: m.data_evolucao || null,
      proximo_retorno: m.proximo_retorno || null,
      medico_assistente_texto: m.medico_assistente_texto ? String(m.medico_assistente_texto).slice(0, 200) : null,
      sem_campo: (m.sem_campo || []).map((x) => String(x).slice(0, 200)).filter(Boolean),
      historico: m.historico ? String(m.historico).slice(0, 4000) : null,
      protocolo_texto: m.protocolo_texto ? String(m.protocolo_texto).slice(0, 200) : null,
    };
  }

  // ── criar (secretaria/admin) ──────────────────────────────────────────────
  // NÃO grava nada clínico no paciente: a proposta é envelope, não registro.
  async criar(pacienteId: number, payload: PropostaPayload, usuarioId: number, perfilAtivo: Perfil) {
    await this.pacienteOr404(pacienteId);
    if (!payload || typeof payload !== 'object') throw new BadRequestException('Proposta vazia');
    const tumor = String(payload.tumor || '').trim();
    if (!tumor) throw new BadRequestException('tumor obrigatório na proposta');
    if (!this.evidencia.vocabulario().tumores.some((t) => t.id === tumor)) {
      throw new BadRequestException(`Tumor "${tumor}" não existe no corpus`);
    }
    const campos = this.validarCampos(tumor, payload.campos || []);
    const regimen_id = this.validarRegime(tumor, payload.regimen_id);
    const meta = this.validarMeta(payload.meta);
    const linha = payload.linha_tratamento != null ? Number(payload.linha_tratamento) : null;
    if (linha != null && (!Number.isInteger(linha) || linha < 1)) throw new BadRequestException('linha_tratamento deve ser inteiro ≥ 1');

    // Uma pendente por paciente — checagem legível aqui, trava de verdade no índice parcial.
    const pendente = await this.propostaRepo.findOneBy({ paciente_id: pacienteId, estado: 'pendente' });
    if (pendente) {
      throw new ConflictException(`Já existe uma proposta de importação pendente para este paciente (#${pendente.id}) — valide ou descarte antes de enviar outra`);
    }
    const nova = this.propostaRepo.create({
      paciente_id: pacienteId,
      payload: {
        tumor,
        sistema: payload.sistema ? String(payload.sistema).slice(0, 40) : null,
        subtipo: payload.subtipo ? String(payload.subtipo).slice(0, 120) : null,
        regimen_id,
        linha_tratamento: linha,
        campos,
        meta,
      },
      estado: 'pendente',
      criada_por: usuarioId,
      perfil_ativo: perfilAtivo,
    });
    const salva = await this.propostaRepo.save(nova);
    // A secretaria recebe de volta o RESUMO — o mesmo que ela lê no GET (o conteúdo
    // clínico não é alçada dela, nem o que ela mesma acabou de enviar).
    return this.lerPorId(salva.id, perfilAtivo);
  }

  // ── ler (por perfil) ──────────────────────────────────────────────────────
  // A proposta mais recente do paciente (qualquer estado), ou null. Oncologista/admin
  // recebem o payload; a secretaria recebe SÓ {id, estado, criada_em, decidida_em}.
  async lerDoPaciente(pacienteId: number, perfil: Perfil) {
    await this.pacienteOr404(pacienteId);
    const p = await this.propostaRepo.findOne({
      where: { paciente_id: pacienteId },
      relations: { criadaPor: true, validadaPor: true },
      order: { criada_em: 'DESC', id: 'DESC' },
    });
    return { proposta: p ? this.map(p, perfil) : null };
  }

  private async lerPorId(id: number, perfil: Perfil) {
    const p = await this.propostaRepo.findOne({ where: { id }, relations: { criadaPor: true, validadaPor: true } });
    return this.map(p, perfil);
  }

  private map(p: ImportacaoProposta, perfil: Perfil) {
    const resumo = {
      id: p.id,
      paciente_id: p.paciente_id,
      estado: p.estado,
      criada_em: p.criada_em,
      criada_por: p.criadaPor ? { id: p.criadaPor.id, nome: p.criadaPor.nome, perfil: p.perfil_ativo || p.criadaPor.perfil } : null,
      decidida_em: p.validada_em,
    };
    if (perfil === 'secretaria') return resumo;
    return {
      ...resumo,
      payload: p.payload,
      validada_por: p.validadaPor ? { id: p.validadaPor.id, nome: p.validadaPor.nome } : null,
      motivo_descarte: p.motivo_descarte,
      resultado: p.resultado,
    };
  }

  // Resumo por paciente para a LISTA (selo "⏳ aguardando validação clínica").
  async pendentesPorPaciente(): Promise<Set<number>> {
    const rows = await this.propostaRepo.createQueryBuilder('p')
      .select('p.paciente_id', 'paciente_id')
      .where('p.estado = :e', { e: 'pendente' })
      .getRawMany<{ paciente_id: number }>();
    return new Set(rows.map((r) => Number(r.paciente_id)));
  }

  // ── nota de importação (template do servidor) ─────────────────────────────
  static montarNota(meta: MetaProposta, dataInicioFallback?: string | null): string {
    const inicio = meta.data_inicio || dataInicioFallback || null;
    const partes: string[] = [];
    partes.push(`Importação retroativa — tratamento em curso${inicio ? ` desde ${fmtBR(inicio)}` : ''}, decisão original da equipe assistente${meta.data_evolucao ? ` (evolução de ${fmtBR(meta.data_evolucao)})` : ''}; registro criado na importação.`);
    if (meta.medico_assistente_texto) partes.push(`Médico(a) assistente: ${meta.medico_assistente_texto.replace(/[.\s]+$/, '')}.`);
    if (meta.sem_campo && meta.sem_campo.length) partes.push(`Sem campo no sistema: ${meta.sem_campo.join('; ')}.`);
    let nota = partes.join(' ');
    if (meta.historico) {
      const sobra = NOTA_MAX - nota.length - 1;
      const h = meta.historico.length > sobra ? meta.historico.slice(0, Math.max(0, sobra - 12)).trimEnd() + ' […cortado]' : meta.historico;
      nota = `${nota} ${h}`;
    }
    return nota.slice(0, NOTA_MAX);
  }

  // ── validar (oncologista/admin) ───────────────────────────────────────────
  // Na ordem: grava primitivos → semáforo NO SERVIDOR → verde? cria avaliação vigente com
  // a nota (senão não seleciona e devolve o motivo; nunca exceção automática) → retorno se
  // a meta trouxer data_evolucao → proposta marcada validada. Tudo assinado pelo VALIDADOR.
  async validar(id: number, correcoes: CorrecoesValidacao, usuarioId: number, perfilAtivo: Perfil) {
    const prop = await this.propostaRepo.findOne({ where: { id }, relations: { criadaPor: true } });
    if (!prop) throw new NotFoundException('Proposta não encontrada');
    if (prop.estado !== 'pendente') throw new ConflictException(`Proposta #${id} já foi ${prop.estado} — nada a validar`);
    const paciente = await this.pacienteOr404(prop.paciente_id);
    const payload = prop.payload as PropostaPayload;
    const tumor = String(payload.tumor);
    if (paciente.tumor && paciente.tumor !== tumor) {
      throw new ConflictException(`O paciente já tem tumor "${paciente.tumor}" no cadastro e a proposta é de "${tumor}" — corrija o cadastro antes de validar`);
    }

    // Mescla: proposto + correções (substituem). Valor null nas correções REMOVE o campo.
    const porCampo = new Map<string, CampoProposto>();
    for (const c of payload.campos || []) porCampo.set(c.campo, { ...c });
    const listaCorr: CampoProposto[] = Array.isArray(correcoes?.campos)
      ? correcoes.campos
      : Object.entries(correcoes?.campos || {}).map(([campo, valor]) => ({ campo, valor }));
    const corrigidos = this.validarCampos(tumor, listaCorr);
    const correcoesAplicadas: { campo: string; de: any; para: any }[] = [];
    for (const c of corrigidos) {
      const antes = porCampo.get(c.campo);
      correcoesAplicadas.push({ campo: c.campo, de: antes ? antes.valor : undefined, para: c.valor });
      if (c.valor === null) porCampo.delete(c.campo);
      else porCampo.set(c.campo, { campo: c.campo, valor: c.valor, trecho: c.trecho ?? (antes ? antes.trecho : null) });
    }
    // Só o INFORMADO entra no snapshot — nada de default por tipo (booleano ausente não
    // vira false). É o que a app mostra na ficha e o que o motor avalia.
    const valores: Record<string, any> = {};
    for (const [k, c] of porCampo) if (c.valor !== null && c.valor !== undefined) valores[k] = c.valor;

    const regimen_id = correcoes?.regimen_id !== undefined
      ? this.validarRegime(tumor, correcoes.regimen_id)
      : (payload.regimen_id || null);
    const linha = correcoes?.linha_tratamento != null ? Number(correcoes.linha_tratamento) : (payload.linha_tratamento ?? 1);
    if (!Number.isInteger(linha) || linha < 1) throw new BadRequestException('linha_tratamento deve ser inteiro ≥ 1');
    const meta = this.validarMeta(payload.meta);

    // O semáforo é calculado ANTES de qualquer escrita (só lê o corpus e os valores).
    const nota = ImportacaoService.montarNota(meta);
    let semaforo: any = null;
    let motivo: string | null = null;
    if (!regimen_id) {
      motivo = 'Proposta sem protocolo indicado — primitivos gravados; selecione o protocolo pela reavaliação.';
    } else {
      semaforo = this.evidencia.classificar(regimen_id, valores);
      if (!semaforo) {
        motivo = `Protocolo "${regimen_id}" não está no corpus.`;
      } else if (semaforo.semaforo !== 'elegivel') {
        const faltam = semaforo.faltando.length ? ` Não informado: ${semaforo.faltando.join(', ')}.` : '';
        motivo = semaforo.semaforo === 'inelegivel'
          ? `Protocolo INELEGÍVEL para os dados informados — não selecionado; se for o caso, abra solicitação de exceção pela reavaliação.${faltam}`
          : `Semáforo em ATENÇÃO (indeterminado) — não selecionado automaticamente.${faltam} Preencha os campos e valide de novo, ou selecione pela reavaliação.`;
      } else if (semaforo.nao_incorporado) {
        motivo = 'Protocolo elegível mas NÃO INCORPORADO pela instituição — não selecionado; a seleção exige solicitação de exceção pela reavaliação.';
      }
    }
    const verde = !!regimen_id && !!semaforo && !motivo;

    // Daqui em diante, TUDO ou NADA: primitivos, avaliação, retorno e o carimbo da
    // proposta entram num commit só. Sem isto, uma conexão derrubada no meio (o driver
    // WebSocket do Neon faz isso de vez em quando — aconteceu na primeira suíte) deixaria
    // o paciente com tumor gravado e avaliação criada mas a proposta ainda pendente, e a
    // revalidação duplicaria a avaliação. Os serviços de avaliação e retorno recebem o
    // EntityManager da transação para escreverem no mesmo commit.
    const estaveis: Record<string, any> = {};
    for (const s of this.evidencia.primitivos(tumor) || []) {
      if (s.estavel && valores[s.campo] !== undefined) estaveis[s.campo] = valores[s.campo];
    }
    const resultado: Record<string, any> = {
      correcoes: correcoesAplicadas,
      regimen_id,
      linha_tratamento: linha,
      snapshot: valores,
      semaforo: semaforo ? { semaforo: semaforo.semaforo, crits: semaforo.crits, faltando: semaforo.faltando, nao_incorporado: semaforo.nao_incorporado } : null,
      vigente: false,
      avaliacao_id: null,
      retorno_id: null,
      motivo,
      nota,
    };
    let avaliacao: any = null;
    let retorno: any = null;
    await this.dataSource.transaction(async (em) => {
      // 1) primitivos no paciente: tumor/sistema/subtipo + valores ESTÁVEIS informados.
      await em.getRepository(Paciente).update({ id: paciente.id }, {
        tumor,
        sistema: payload.sistema || paciente.sistema || null,
        subtipo: payload.subtipo || paciente.subtipo || null,
        valores_estaveis: { ...(paciente.valores_estaveis || {}), ...estaveis },
      });
      // 2) VERDE → avaliação vigente, assinada pelo validador, com a nota ⚠️.
      if (verde) {
        avaliacao = await this.pacientes.criarAvaliacao(paciente.id, {
          regimen_id,
          linha_tratamento: linha,
          snapshot_campos: valores,
          semaforo: 'elegivel',
          detalhe_semaforo: {
            status: 'ok',
            crits: semaforo.crits,
            ressalva: nota,
            importacao: { proposta_id: prop.id, por: prop.criadaPor ? prop.criadaPor.nome : null },
          },
          autorizacao_estado: 'nao_necessaria',
        }, usuarioId, perfilAtivo, em);
        if (avaliacao.autorizacao_estado !== 'nao_necessaria') {
          // O serviço de avaliação reconfere os eixos; se discordar, é bug de sincronia entre
          // os dois motores — não pode virar exceção silenciosa: aborta o commit inteiro.
          throw new ConflictException(`O servidor não tratou a avaliação como vigente (${avaliacao.autorizacao_estado}) — semáforo e avaliação em desacordo`);
        }
        resultado.vigente = true;
        resultado.avaliacao_id = avaliacao.id;
      }
      // 3) retorno retroativo, se a meta trouxer a evolução (mesmo padrão do #80): a data
      // realizada é a da evolução; o próximo retorno, o que a equipe já marcou.
      if (meta.data_evolucao) {
        retorno = await this.retornos.criar(paciente.id, {
          data_realizada: meta.data_evolucao,
          com_imagem: false,
          resposta: 'nao_avaliada',
          conduta: 'mantem',
          proximo_intervalo: meta.proximo_retorno ? 'especifica' : undefined,
          proximo_retorno: meta.proximo_retorno || undefined,
          fonte_dados: `importação retroativa (evolução de ${fmtBR(meta.data_evolucao)})`.slice(0, 160),
          observacoes: nota,
        }, usuarioId, perfilAtivo, em);
        resultado.retorno_id = retorno.id;
      }
      // 4) proposta validada — quem e quando, e o que a validação produziu.
      await em.getRepository(ImportacaoProposta).update({ id: prop.id }, {
        estado: 'validada', validada_por: usuarioId, validada_em: new Date(), resultado,
      });
    });
    return { proposta: await this.lerPorId(prop.id, perfilAtivo), ...resultado, avaliacao, retorno };
  }

  // ── descartar (oncologista/admin) ─────────────────────────────────────────
  async descartar(id: number, motivo: string, usuarioId: number, perfilAtivo: Perfil) {
    const prop = await this.propostaRepo.findOneBy({ id });
    if (!prop) throw new NotFoundException('Proposta não encontrada');
    if (prop.estado !== 'pendente') throw new ConflictException(`Proposta #${id} já foi ${prop.estado} — nada a descartar`);
    await this.propostaRepo.update({ id }, {
      estado: 'descartada', validada_por: usuarioId, validada_em: new Date(), motivo_descarte: motivo,
    });
    return { proposta: await this.lerPorId(id, perfilAtivo) };
  }
}
