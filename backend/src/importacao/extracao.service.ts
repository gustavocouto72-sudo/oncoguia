import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { EvidenciaService } from '../evidencia/evidencia.service';
import { CampoPrimitivo } from '../evidencia/semaforo';
import { ProvedorNaoConfigurado, provedorDoAmbiente } from './provedor-llm';

// EXTRAÇÃO DE PRONTUÁRIO — texto raspado → proposta de importação (formato da entrega 1).
//
// O que entra: o tumor (escolhido pela secretaria) e o texto JÁ RASPADO no navegador
// (nome, atendimento, prontuário e nascimento removidos antes de sair da máquina dela).
// O que sai: `{tumor, regimen_id, campos:[{campo, valor, trecho}], meta}` — o mesmo
// envelope que o "colar JSON" carrega no formulário. NUNCA vira proposta sozinho: a
// secretaria confere e envia; o oncologista valida como na entrega 1.
//
// Duas travas que não dependem do modelo:
//  1. o PROMPT é montado do vocabulário do tumor (campos, tipos, opções, regimes) — o
//     modelo só vê nomes que existem; e a saída é JSON ESTRITO por schema (structured
//     outputs), então não há campo fora do vocabulário nem valor fora das opções;
//  2. TODO valor tem de vir com o TRECHO LITERAL que o sustenta, e o serviço confere
//     que o trecho ESTÁ no texto (comparação insensível a espaços/acentos). Sem trecho,
//     ou trecho que não está lá → o campo é DESCARTADO e listado em `descartados`.
//     "Não inferir" vira mecânica, não pedido.
// Processa e descarta: nem o texto nem a resposta são gravados ou logados — o log só
// registra modelo, contagem de tokens e quantos campos saíram.
export interface ItemListaExtraido { texto: string; trecho: string }
export interface ResultadoExtracao {
  proposta: {
    tumor: string;
    regimen_id: string | null;
    campos: { campo: string; valor: any; trecho: string }[];
    meta: Record<string, any>;
    // Lista de problemas categorizada — cada item com o trecho que o sustenta (a mesma
    // trava dos campos: sem trecho literal no texto, fora). Vai na proposta e, na
    // validação, para as listas do paciente com origem "importação (evolução de …)".
    lista_problemas: { comorbidades: ItemListaExtraido[]; medicacoes_uso: ItemListaExtraido[]; alergias: ItemListaExtraido[] };
  };
  descartados: { campo: string; motivo: string; valor?: any; trecho?: string }[];
  modelo: string;
  uso: { entrada: number; saida: number } | null;
}

// Comparação de trecho: sem acento, sem caixa e SEM espaço nenhum — o texto de um PDF chega
// com quebras de linha e ligaduras separadas ("fi sicamente"), e o trecho do modelo vem
// com o espaçamento normal; as LETRAS e a ORDEM continuam tendo de ser idênticas.
const norm = (s: string) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, '');

@Injectable()
export class ExtracaoService {
  private readonly log = new Logger(ExtracaoService.name);
  constructor(private evidencia: EvidenciaService) {}

  // ── prompt e schema, do vocabulário do tumor ─────────────────────────────
  private vocab(tumor: string) {
    const t = this.evidencia.vocabulario().tumores.find((x) => x.id === tumor);
    if (!t) throw new BadRequestException(`Tumor "${tumor}" não existe no corpus`);
    if (!t.campos.length) throw new BadRequestException(`Tumor "${tumor}" não tem campos primitivos — extração indisponível`);
    return t;
  }

  private descreveCampo(s: CampoPrimitivo) {
    const tipo = s.tipo === 'boolean' ? 'booleano (true/false)'
      : s.tipo === 'enum' ? `uma de: ${(s.opcoes || []).map(String).join(' | ')}`
      : `número${s.unidade ? ` (${s.unidade})` : ''}`;
    return `- ${s.campo} — "${s.label || s.campo}" — ${tipo}`;
  }

  montarSystem(tumor: string): string {
    const v = this.vocab(tumor);
    const campos = v.campos.map((s) => this.descreveCampo(s as CampoPrimitivo)).join('\n');
    const regimes = v.regimes.map((r) => `- ${r.regimen_id} — "${r.nome}"${r.subtipo ? ` — ${r.subtipo}` : ''}${r.esquema ? ` — ${r.esquema}` : ''}`).join('\n');
    return [
      'Você extrai dados clínicos ESTRUTURADOS de um trecho de prontuário oncológico (texto em português, já anonimizado) para um sistema de apoio à decisão. Sua saída alimenta uma PROPOSTA que um oncologista vai conferir campo a campo antes de virar registro — sua obrigação é fidelidade ao texto, não completude.',
      '',
      `TUMOR: ${tumor}.`,
      '',
      'REGRAS (todas obrigatórias):',
      '1. Só use os campos listados abaixo, com o nome EXATO e valores no tipo/opções indicados.',
      '2. CADA campo extraído vem com `trecho`: a citação LITERAL, copiada do texto (mesmas palavras, mesma ordem), que sustenta o valor. O trecho será conferido mecanicamente contra o texto; um trecho parafraseado invalida o campo.',
      '3. Sem evidência explícita no texto → NÃO inclua o campo. Nunca infira, nunca presuma um default. Booleanos só quando o texto afirma ou nega explicitamente aquele fato (ex.: "nega convulsão" → convulsao_previa=false; a ausência de menção NÃO é false).',
      '4. Um campo por nome, no máximo uma vez.',
      '5. Protocolo em curso: se o texto DECLARAR o tratamento atual, informe `regimen_id` escolhendo, entre os regimes abaixo, o que combina com o FÁRMACO E com o cenário clínico descrito (sensível vs. resistente à castração, metastático ou não). Se o fármaco está claro mas o cenário não, deixe `regimen_id` nulo e preencha só `protocolo_texto`. Sempre com trecho.',
      '6. Meta: `data_evolucao` (data da evolução/consulta, ISO YYYY-MM-DD), `proximo_retorno` (data do retorno previsto, ISO), `data_inicio` (início do tratamento em curso, ISO), `medico_assistente_texto` (nome do médico como aparece), `historico` (resumo curto e factual da história oncológica, em até 600 caracteres — este é o único campo que pode ser redigido por você), `sem_campo` (fatos clínicos relevantes que NÃO têm campo na lista — ex.: linfonodos, cirurgias, hormonioterapia — uma frase curta cada). Datas e nomes vêm com trecho.',
      '7. Se o texto tiver uma data em formato brasileiro (dd/mm/aaaa), converta para ISO no valor e mantenha o original no trecho.',
      '8. LISTA DE PROBLEMAS — `lista_problemas` com três listas categorizadas, cada item {texto, trecho}: `comorbidades` (doenças de base e eventos relevantes fora do tumor: HAS, DM, IAM prévio, DPOC, IRC…), `medicacoes_uso` (medicamentos de uso contínuo NÃO oncológicos, com dose/posologia quando o texto trouxer — ex.: "Anlodipino 5 mg 24/24h"; o antineoplásico/hormonioterapia do protocolo em curso NÃO entra aqui, ele já é o `regimen_id`), `alergias` (alergias declaradas; se o texto NEGA alergias explicitamente, inclua um item "Nega alergias conhecidas" com o trecho da negativa; se não fala em alergia, lista vazia). `texto` curto (até 120 caracteres), um item por fato; `trecho` LITERAL como nos campos. Comorbidade, medicação e alergia vão SÓ aqui — NÃO as repita em `sem_campo`; `sem_campo` fica para o resto (cirurgias, linfonodos, exames…).',
      '',
      'CAMPOS DO TUMOR:',
      campos,
      '',
      'REGIMES DO CATÁLOGO (regimen_id — nome — cenário — esquema):',
      regimes,
    ].join('\n');
  }

  montarSchema(tumor: string): Record<string, unknown> {
    const v = this.vocab(tumor);
    const nomes = v.campos.map((s) => s.campo);
    const ids = v.regimes.map((r) => r.regimen_id);
    const comTrecho = (valor: Record<string, unknown>) => ({
      type: 'object', additionalProperties: false, required: ['valor', 'trecho'],
      properties: { valor, trecho: { type: 'string' } },
    });
    const listaItens = {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['texto', 'trecho'], properties: { texto: { type: 'string' }, trecho: { type: 'string' } } },
    };
    return {
      type: 'object', additionalProperties: false,
      required: ['campos', 'protocolo', 'meta', 'lista_problemas'],
      properties: {
        lista_problemas: {
          type: 'object', additionalProperties: false, required: ['comorbidades', 'medicacoes_uso', 'alergias'],
          properties: { comorbidades: listaItens, medicacoes_uso: listaItens, alergias: listaItens },
        },
        campos: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['campo', 'valor', 'trecho'],
            properties: {
              campo: { type: 'string', enum: nomes },
              valor: { anyOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }] },
              trecho: { type: 'string' },
            },
          },
        },
        protocolo: {
          type: 'object', additionalProperties: false, required: ['regimen_id', 'protocolo_texto', 'trecho'],
          properties: {
            regimen_id: { anyOf: [{ type: 'string', enum: ids }, { type: 'null' }] },
            protocolo_texto: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            trecho: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
        },
        meta: {
          type: 'object', additionalProperties: false,
          required: ['data_evolucao', 'proximo_retorno', 'data_inicio', 'medico_assistente_texto', 'historico', 'sem_campo'],
          properties: {
            data_evolucao: { anyOf: [comTrecho({ type: 'string' }), { type: 'null' }] },
            proximo_retorno: { anyOf: [comTrecho({ type: 'string' }), { type: 'null' }] },
            data_inicio: { anyOf: [comTrecho({ type: 'string' }), { type: 'null' }] },
            medico_assistente_texto: { anyOf: [comTrecho({ type: 'string' }), { type: 'null' }] },
            historico: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            sem_campo: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    };
  }

  // ── extrair ───────────────────────────────────────────────────────────────
  async extrair(tumor: string, textoRaspado: string): Promise<ResultadoExtracao> {
    const texto = String(textoRaspado || '');
    if (texto.trim().length < 40) throw new BadRequestException('texto_raspado vazio ou curto demais');
    if (texto.length > 60_000) throw new BadRequestException('texto_raspado grande demais (máx. 60.000 caracteres)');
    const v = this.vocab(tumor);
    let provedor;
    try { provedor = provedorDoAmbiente(); } catch (e) {
      if (e instanceof ProvedorNaoConfigurado) throw new ServiceUnavailableException(e.message);
      throw e;
    }
    const resposta = await provedor.extrair({ system: this.montarSystem(tumor), texto, schema: this.montarSchema(tumor) });

    // ── pós-validação: vocabulário + trecho LITERAL no texto ──────────────────
    const textoN = norm(texto);
    const noTexto = (trecho: any) => typeof trecho === 'string' && trecho.trim().length >= 3 && textoN.includes(norm(trecho));
    const specs = new Map(v.campos.map((s) => [s.campo, s as CampoPrimitivo]));
    const descartados: ResultadoExtracao['descartados'] = [];
    const campos: ResultadoExtracao['proposta']['campos'] = [];
    const vistos = new Set<string>();
    for (const c of (Array.isArray(resposta.json?.campos) ? resposta.json.campos : [])) {
      const s = specs.get(c?.campo);
      if (!s) { descartados.push({ campo: String(c?.campo), motivo: 'campo fora do vocabulário' }); continue; }
      if (vistos.has(s.campo)) { descartados.push({ campo: s.campo, motivo: 'repetido', valor: c.valor }); continue; }
      if (!noTexto(c.trecho)) { descartados.push({ campo: s.campo, motivo: 'trecho não encontrado literalmente no texto', valor: c.valor, trecho: c.trecho }); continue; }
      let valor = c.valor;
      if (s.tipo === 'boolean') {
        if (valor === 'true') valor = true; else if (valor === 'false') valor = false;
        if (typeof valor !== 'boolean') { descartados.push({ campo: s.campo, motivo: 'booleano não explícito', valor, trecho: c.trecho }); continue; }
      } else if (s.tipo === 'enum') {
        const ops = (s.opcoes || []).map(String);
        const achou = ops.find((o) => o === String(valor)) ?? ops.find((o) => norm(o) === norm(String(valor)));
        if (!achou) { descartados.push({ campo: s.campo, motivo: `valor fora das opções (${ops.join('|')})`, valor, trecho: c.trecho }); continue; }
        valor = achou;
      } else {
        const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
        if (!Number.isFinite(n)) { descartados.push({ campo: s.campo, motivo: 'valor não numérico', valor, trecho: c.trecho }); continue; }
        valor = n;
      }
      vistos.add(s.campo);
      campos.push({ campo: s.campo, valor, trecho: String(c.trecho).trim().slice(0, 500) });
    }

    // protocolo: id do catálogo do tumor + trecho no texto; senão só o texto livre.
    const p = resposta.json?.protocolo || {};
    let regimen_id: string | null = null;
    let protocolo_texto: string | null = p.protocolo_texto ? String(p.protocolo_texto).slice(0, 200) : null;
    if (p.regimen_id) {
      const r = v.regimes.find((x) => x.regimen_id === p.regimen_id);
      if (r && noTexto(p.trecho)) regimen_id = r.regimen_id;
      else descartados.push({ campo: 'regimen_id', motivo: r ? 'trecho não encontrado literalmente no texto' : 'regime fora do catálogo do tumor', valor: p.regimen_id, trecho: p.trecho });
    }
    if (protocolo_texto && !noTexto(protocolo_texto) && !noTexto(p.trecho)) { descartados.push({ campo: 'protocolo_texto', motivo: 'sem trecho no texto', valor: protocolo_texto }); protocolo_texto = null; }

    // meta: datas em ISO com trecho no texto; médico com trecho; histórico é o único redigido.
    const m = resposta.json?.meta || {};
    const ISO = /^\d{4}-\d{2}-\d{2}$/;
    const dataMeta = (k: string) => {
      const x = m[k]; if (!x || typeof x !== 'object') return null;
      if (!ISO.test(String(x.valor))) { descartados.push({ campo: k, motivo: 'data fora do ISO', valor: x.valor, trecho: x.trecho }); return null; }
      if (!noTexto(x.trecho)) { descartados.push({ campo: k, motivo: 'trecho não encontrado literalmente no texto', valor: x.valor, trecho: x.trecho }); return null; }
      return String(x.valor);
    };
    let medico: string | null = null;
    if (m.medico_assistente_texto && typeof m.medico_assistente_texto === 'object') {
      const x = m.medico_assistente_texto;
      if (noTexto(x.trecho) || noTexto(x.valor)) medico = String(x.valor).slice(0, 200);
      else descartados.push({ campo: 'medico_assistente_texto', motivo: 'trecho não encontrado literalmente no texto', valor: x.valor, trecho: x.trecho });
    }
    const meta = {
      data_evolucao: dataMeta('data_evolucao'),
      proximo_retorno: dataMeta('proximo_retorno'),
      data_inicio: dataMeta('data_inicio'),
      medico_assistente_texto: medico,
      historico: m.historico ? String(m.historico).slice(0, 1200) : null,
      sem_campo: (Array.isArray(m.sem_campo) ? m.sem_campo : []).map((x: any) => String(x).slice(0, 200)).filter(Boolean).slice(0, 20),
      protocolo_texto,
    };
    // lista de problemas: a mesma trava dos campos — item sem trecho literal no texto é
    // descartado (listado em `descartados` como "lista_problemas.<lista>"); texto vazio ou
    // repetido dentro da lista também sai. Até 30 itens por lista.
    const lp = resposta.json?.lista_problemas || {};
    const lista_problemas: ResultadoExtracao['proposta']['lista_problemas'] = { comorbidades: [], medicacoes_uso: [], alergias: [] };
    for (const k of ['comorbidades', 'medicacoes_uso', 'alergias'] as const) {
      const vistosLp = new Set<string>();
      for (const it of (Array.isArray(lp[k]) ? lp[k] : [])) {
        const texto = String(it?.texto || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (!texto) continue;
        if (vistosLp.has(norm(texto))) { descartados.push({ campo: `lista_problemas.${k}`, motivo: 'repetido', valor: texto }); continue; }
        if (!noTexto(it?.trecho)) { descartados.push({ campo: `lista_problemas.${k}`, motivo: 'trecho não encontrado literalmente no texto', valor: texto, trecho: it?.trecho }); continue; }
        vistosLp.add(norm(texto));
        lista_problemas[k].push({ texto, trecho: String(it.trecho).trim().slice(0, 500) });
        if (lista_problemas[k].length >= 30) break;
      }
    }
    // Só metadados no log — nunca o texto nem a resposta.
    this.log.log(`extração ${tumor}: modelo=${resposta.modelo} campos=${campos.length} lista_problemas=${lista_problemas.comorbidades.length}/${lista_problemas.medicacoes_uso.length}/${lista_problemas.alergias.length} descartados=${descartados.length} tokens=${resposta.uso ? `${resposta.uso.entrada}/${resposta.uso.saida}` : '?'}`);
    return { proposta: { tumor, regimen_id, campos, meta, lista_problemas }, descartados, modelo: resposta.modelo, uso: resposta.uso };
  }
}
