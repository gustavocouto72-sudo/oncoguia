import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  CabecalhoOncologico, LinhaCabecalho, MarcadorCabecalho, PontoMarcador, TIPOS_LINHA_CABECALHO, TextoCabecalho,
  TipoLinhaCabecalho,
} from '../database/entities';

// CABEÇALHO ONCOLÓGICO — regras puras (validação, ordenação, aplicação de operações),
// sem banco. O serviço lê a coluna, chama `aplicarOperacoesCabecalho`, grava o resultado e
// deixa o evento na trilha. Separado para que a Fase 2 (importação) escreva pelo MESMO
// caminho — e para que as regras possam ser lidas de uma vez só:
//
//  • OMITIR É PREFERÍVEL A INFERIR. Data parcial (mm/aaaa, aaaa) é válida como está e
//    NUNCA é completada; a ordenação usa o início do período (2024 < 01/2024 < 01/01/2024).
//    Campo vazio some do objeto — título/subtítulo/status com texto vazio são REMOVIDOS,
//    não gravados em branco.
//  • Linha pode ter data OU rótulo (S1, C3, D15) — ou nenhum dos dois: linha sem data não
//    ganha uma inventada, vai para o fim da seção na ordem em que foi registrada.
//  • `pai_id` faz da linha uma intercorrência da linha-pai; só TERAPÊUTICA aceita filhos, e
//    um nível só (filho não tem filho). A intercorrência herda o tipo do pai. Remover o pai
//    remove as intercorrências (e o evento diz quantas).
//  • Marcador tumoral é série (valor, data), nome único por paciente (sem acento/caixa).
//    Editar = acrescentar ou retirar ponto. A série fica ordenada por data.

export const ROTULO_TIPO: Record<TipoLinhaCabecalho, string> = {
  apresentacao: 'apresentação', propedeutica: 'propedêutica', terapeutica: 'terapêutica',
};

const LIM = {
  linhas: 300, marcadores: 20, pontos: 200, operacoes: 60,
  texto_linha: 1000, titulo: 300, status: 1000, rotulo: 12, nome_marcador: 40, unidade: 20, valor: 20,
};

const OPS = [
  'titulo', 'subtitulo', 'status_atual',
  'linha_adicionar', 'linha_editar', 'linha_remover',
  'marcador_adicionar', 'marcador_remover', 'ponto_adicionar', 'ponto_remover',
] as const;
export type OperacaoCabecalho = Record<string, any> & { op: (typeof OPS)[number] };

const norm = (s: string) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
const limpar = (s: unknown) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const limparMultilinha = (s: unknown) => String(s == null ? '' : s).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

// ---- data parcial ---------------------------------------------------------------
// Aceita EXATAMENTE dd/mm/aaaa, mm/aaaa ou aaaa. Qualquer outra coisa (ISO, dia sem mês,
// 31/02) é 400 — a app manda o que o médico digitou, o servidor é quem decide.
const RE_DMA = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const RE_MA = /^(\d{2})\/(\d{4})$/;
const RE_A = /^(\d{4})$/;
export function validarDataParcial(raw: unknown, campo = 'data'): string {
  const s = limpar(raw);
  const erro = () => new BadRequestException(`${campo} inválida: "${s}" — use dd/mm/aaaa, mm/aaaa ou aaaa (a data parcial fica parcial, nunca é completada)`);
  let d: number | null = null, m: number | null = null, a: number;
  let g: RegExpMatchArray | null;
  if ((g = s.match(RE_DMA))) { d = +g[1]; m = +g[2]; a = +g[3]; }
  else if ((g = s.match(RE_MA))) { m = +g[1]; a = +g[2]; }
  else if ((g = s.match(RE_A))) { a = +g[1]; }
  else throw erro();
  if (a < 1900 || a > 2100) throw erro();
  if (m != null && (m < 1 || m > 12)) throw erro();
  if (d != null) {
    const dt = new Date(Date.UTC(a, m! - 1, d));
    if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m! - 1 || dt.getUTCDate() !== d) throw erro();
  }
  return s;
}
// Chave de ordenação = INÍCIO do período. Componente ausente vira '00' (menor que qualquer
// dia/mês real), então 2024 < 01/2024 < 01/01/2024 — o menos específico primeiro.
export function chaveDataParcial(s: string | null | undefined): string | null {
  if (!s) return null;
  let g: RegExpMatchArray | null;
  if ((g = s.match(RE_DMA))) return `${g[3]}-${g[2]}-${g[1]}`;
  if ((g = s.match(RE_MA))) return `${g[2]}-${g[1]}-00`;
  if ((g = s.match(RE_A))) return `${g[1]}-00-00`;
  return null;
}
// Rótulo "natural": S1 < S3 < S11 (prefixo, depois o número).
function chaveRotulo(r: string | null | undefined): string {
  if (!r) return '~';
  const g = r.match(/^(\D*)(\d+)(.*)$/);
  return g ? `${norm(g[1])}${g[2].padStart(6, '0')}${norm(g[3])}` : norm(r);
}

// ---- ordenação -------------------------------------------------------------------
// Linhas de topo: por tipo (apresentação → propedêutica → terapêutica), depois pela chave
// da data; sem data vai para o fim da seção; empate pelo instante de registro. Filhos logo
// abaixo do pai: por data se tiverem, senão por rótulo natural, senão por registro.
export function ordenarCabecalho(cab: CabecalhoOncologico): CabecalhoOncologico {
  const linhas = Array.isArray(cab.linhas) ? cab.linhas : [];
  const cmpEm = (x: LinhaCabecalho, y: LinhaCabecalho) => (x.em || '').localeCompare(y.em || '') || x.id.localeCompare(y.id);
  const cmpTopo = (x: LinhaCabecalho, y: LinhaCabecalho) => {
    const t = TIPOS_LINHA_CABECALHO.indexOf(x.tipo) - TIPOS_LINHA_CABECALHO.indexOf(y.tipo);
    if (t) return t;
    const kx = chaveDataParcial(x.data), ky = chaveDataParcial(y.data);
    if (kx && ky && kx !== ky) return kx < ky ? -1 : 1;
    if (kx && !ky) return -1;
    if (!kx && ky) return 1;
    return cmpEm(x, y);
  };
  const cmpFilho = (x: LinhaCabecalho, y: LinhaCabecalho) => {
    const kx = chaveDataParcial(x.data), ky = chaveDataParcial(y.data);
    if (kx && ky && kx !== ky) return kx < ky ? -1 : 1;
    if (kx && !ky) return -1;
    if (!kx && ky) return 1;
    const rx = chaveRotulo(x.rotulo), ry = chaveRotulo(y.rotulo);
    if (rx !== ry) return rx < ry ? -1 : 1;
    return cmpEm(x, y);
  };
  const topo = linhas.filter((l) => !l.pai_id).sort(cmpTopo);
  const ordenadas: LinhaCabecalho[] = [];
  for (const p of topo) {
    ordenadas.push(p);
    ordenadas.push(...linhas.filter((l) => l.pai_id === p.id).sort(cmpFilho));
  }
  // Órfã (pai sumiu por um caminho que não este) não some em silêncio: vira linha de topo.
  for (const l of linhas) if (l.pai_id && !topo.some((p) => p.id === l.pai_id)) ordenadas.push({ ...l, pai_id: null });
  const marcadores = (Array.isArray(cab.marcadores) ? cab.marcadores : []).map((m) => ({
    ...m,
    pontos: [...(m.pontos || [])].map((p, i) => ({ p, i })).sort((x, y) => {
      const kx = chaveDataParcial(x.p.data) || '', ky = chaveDataParcial(y.p.data) || '';
      return kx < ky ? -1 : kx > ky ? 1 : x.i - y.i;
    }).map((x) => x.p),
  }));
  const out: CabecalhoOncologico = {};
  if (cab.titulo) out.titulo = cab.titulo;
  if (cab.subtitulo) out.subtitulo = cab.subtitulo;
  if (ordenadas.length) out.linhas = ordenadas;
  if (marcadores.length) out.marcadores = marcadores;
  if (cab.status_atual) out.status_atual = cab.status_atual;
  return out;
}

// ---- aplicação de operações --------------------------------------------------------
export interface ContextoCabecalho { autor: { id: number; nome: string }; agora: string; origem: string }
export interface ResultadoCabecalho { cabecalho: CabecalhoOncologico; partes: string[]; alterou: boolean }

function novoId(existentes: Set<string>): string {
  for (; ;) { const id = randomBytes(5).toString('hex'); if (!existentes.has(id)) { existentes.add(id); return id; } }
}
const descLinha = (l: LinhaCabecalho) => `linha ${ROTULO_TIPO[l.tipo]}${l.pai_id ? ' (intercorrência)' : ''}${l.data ? ' ' + l.data : l.rotulo ? ' ' + l.rotulo : ''}`;
const descPonto = (m: MarcadorCabecalho, p: PontoMarcador) => `ponto ${m.nome} ${p.valor} (${p.data})`;

function validarTipo(raw: unknown): TipoLinhaCabecalho {
  const t = limpar(raw) as TipoLinhaCabecalho;
  if (!TIPOS_LINHA_CABECALHO.includes(t)) throw new BadRequestException(`tipo "${t}" inválido (apresentacao | propedeutica | terapeutica)`);
  return t;
}
function textoObrigatorio(raw: unknown, max: number, campo: string): string {
  const t = limparMultilinha(raw);
  if (!t) throw new BadRequestException(`${campo} vazio`);
  if (t.length > max) throw new BadRequestException(`${campo} excede ${max} caracteres`);
  return t;
}
function textoCurto(raw: unknown, max: number, campo: string): string | null {
  if (raw == null) return null;
  const t = limpar(raw);
  if (!t) return null;
  if (t.length > max) throw new BadRequestException(`${campo} excede ${max} caracteres`);
  return t;
}
function validarPonto(raw: any): PontoMarcador {
  if (!raw || typeof raw !== 'object') throw new BadRequestException('ponto inválido: esperado {valor, data}');
  const valor = textoCurto(raw.valor, LIM.valor, 'valor do marcador');
  if (!valor) throw new BadRequestException('valor do marcador vazio');
  return { valor, data: validarDataParcial(raw.data, 'data do ponto') };
}

// Aplica a lista de operações sobre uma CÓPIA do cabeçalho e devolve o objeto ordenado +
// as partes da nota do evento ("+linha terapêutica 05/04/2022"). Lança 400/404/409 —
// nada é gravado se uma operação falhar (o serviço só persiste o resultado inteiro).
export function aplicarOperacoesCabecalho(
  atual: CabecalhoOncologico | null | undefined,
  operacoes: OperacaoCabecalho[],
  ctx: ContextoCabecalho,
): ResultadoCabecalho {
  if (!Array.isArray(operacoes) || !operacoes.length) throw new BadRequestException('operacoes: lista vazia');
  if (operacoes.length > LIM.operacoes) throw new BadRequestException(`operacoes: no máximo ${LIM.operacoes} por chamada`);
  const cab: CabecalhoOncologico = JSON.parse(JSON.stringify(atual && typeof atual === 'object' ? atual : {}));
  cab.linhas = Array.isArray(cab.linhas) ? cab.linhas : [];
  cab.marcadores = Array.isArray(cab.marcadores) ? cab.marcadores : [];
  const ids = new Set<string>([...cab.linhas.map((l) => l.id), ...cab.marcadores.map((m) => m.id)]);
  const por = { id: ctx.autor.id, nome: ctx.autor.nome };
  const partes: string[] = [];
  const linhaOr404 = (id: unknown) => {
    const l = cab.linhas!.find((x) => x.id === limpar(id));
    if (!l) throw new NotFoundException(`linha "${limpar(id)}" não existe no cabeçalho`);
    return l;
  };
  const marcadorOr404 = (id: unknown) => {
    const m = cab.marcadores!.find((x) => x.id === limpar(id));
    if (!m) throw new NotFoundException(`marcador "${limpar(id)}" não existe no cabeçalho`);
    return m;
  };
  const campoTexto = (chave: 'titulo' | 'subtitulo' | 'status_atual', raw: unknown, max: number, rotulo: string) => {
    const t = chave === 'status_atual' ? limparMultilinha(raw) : limpar(raw);
    if (t.length > max) throw new BadRequestException(`${rotulo} excede ${max} caracteres`);
    const antes = cab[chave]?.texto || '';
    if (antes === t) return;
    if (!t) { delete cab[chave]; partes.push(`−${rotulo}`); return; }
    const v: TextoCabecalho = { texto: t, em: ctx.agora, por };
    cab[chave] = v;
    partes.push(`${antes ? '~' : '+'}${rotulo}`);
  };

  for (const op of operacoes) {
    if (!op || typeof op !== 'object' || !OPS.includes(op.op)) {
      throw new BadRequestException(`operação "${op && op.op}" inválida (${OPS.join(' | ')})`);
    }
    switch (op.op) {
      case 'titulo': campoTexto('titulo', op.texto, LIM.titulo, 'título'); break;
      case 'subtitulo': campoTexto('subtitulo', op.texto, LIM.titulo, 'subtítulo'); break;
      case 'status_atual': campoTexto('status_atual', op.texto, LIM.status, 'status atual'); break;

      case 'linha_adicionar': {
        if (cab.linhas.length >= LIM.linhas) throw new BadRequestException(`cabeçalho já tem ${LIM.linhas} linhas`);
        const texto = textoObrigatorio(op.texto, LIM.texto_linha, 'texto da linha');
        const data = op.data == null || limpar(op.data) === '' ? null : validarDataParcial(op.data);
        const rotulo = textoCurto(op.rotulo, LIM.rotulo, 'rótulo');
        // Intercorrência: o tipo vem do pai (terapêutica) — mandar outro é 400, omitir é ok.
        let tipo: TipoLinhaCabecalho;
        let pai_id: string | null = null;
        if (op.pai_id != null && limpar(op.pai_id) !== '') {
          const pai = linhaOr404(op.pai_id);
          if (pai.tipo !== 'terapeutica') throw new BadRequestException(`só linha terapêutica aceita intercorrência (a linha-pai é ${ROTULO_TIPO[pai.tipo]})`);
          if (pai.pai_id) throw new BadRequestException('intercorrência não aceita sublinha (um nível só)');
          if (op.tipo != null && limpar(op.tipo) !== '' && validarTipo(op.tipo) !== 'terapeutica') throw new BadRequestException('intercorrência herda o tipo terapêutica da linha-pai');
          tipo = 'terapeutica';
          pai_id = pai.id;
        } else {
          tipo = validarTipo(op.tipo);
        }
        const l: LinhaCabecalho = { id: novoId(ids), tipo, data, rotulo, texto, pai_id, origem: ctx.origem, por, em: ctx.agora };
        cab.linhas.push(l);
        partes.push(`+${descLinha(l)}`);
        break;
      }
      case 'linha_editar': {
        const l = linhaOr404(op.id);
        const antes = descLinha(l);
        if (op.texto !== undefined) l.texto = textoObrigatorio(op.texto, LIM.texto_linha, 'texto da linha');
        if (op.data !== undefined) l.data = op.data == null || limpar(op.data) === '' ? null : validarDataParcial(op.data);
        if (op.rotulo !== undefined) l.rotulo = textoCurto(op.rotulo, LIM.rotulo, 'rótulo');
        if (op.tipo !== undefined) {
          const tipo = validarTipo(op.tipo);
          if (tipo !== l.tipo) {
            if (l.pai_id) throw new BadRequestException('intercorrência não muda de tipo (é o do tratamento)');
            if (tipo !== 'terapeutica' && cab.linhas.some((x) => x.pai_id === l.id)) throw new BadRequestException('linha com intercorrências só pode ser terapêutica');
            l.tipo = tipo;
            for (const f of cab.linhas) if (f.pai_id === l.id) f.tipo = tipo;
          }
        }
        l.por = por; l.em = ctx.agora;
        partes.push(`~${antes}`);
        break;
      }
      case 'linha_remover': {
        const l = linhaOr404(op.id);
        const filhos = cab.linhas.filter((x) => x.pai_id === l.id);
        cab.linhas = cab.linhas.filter((x) => x.id !== l.id && x.pai_id !== l.id);
        partes.push(`−${descLinha(l)}${filhos.length ? ` (+${filhos.length} intercorrência${filhos.length > 1 ? 's' : ''})` : ''}`);
        break;
      }

      case 'marcador_adicionar': {
        if (cab.marcadores.length >= LIM.marcadores) throw new BadRequestException(`cabeçalho já tem ${LIM.marcadores} marcadores`);
        const nome = textoCurto(op.nome, LIM.nome_marcador, 'nome do marcador');
        if (!nome) throw new BadRequestException('nome do marcador vazio');
        if (cab.marcadores.some((m) => norm(m.nome) === norm(nome))) throw new ConflictException(`marcador "${nome}" já existe — acrescente um ponto`);
        const pontos = (Array.isArray(op.pontos) ? op.pontos : []).map(validarPonto);
        if (pontos.length > LIM.pontos) throw new BadRequestException(`marcador com mais de ${LIM.pontos} pontos`);
        const m: MarcadorCabecalho = { id: novoId(ids), nome, unidade: textoCurto(op.unidade, LIM.unidade, 'unidade'), pontos };
        cab.marcadores.push(m);
        partes.push(`+marcador ${nome}${pontos.length ? ` (${pontos.length} ponto${pontos.length > 1 ? 's' : ''})` : ''}`);
        break;
      }
      case 'marcador_remover': {
        const m = marcadorOr404(op.id);
        cab.marcadores = cab.marcadores.filter((x) => x.id !== m.id);
        partes.push(`−marcador ${m.nome}`);
        break;
      }
      case 'ponto_adicionar': {
        const m = marcadorOr404(op.marcador_id);
        if (m.pontos.length >= LIM.pontos) throw new BadRequestException(`marcador ${m.nome} já tem ${LIM.pontos} pontos`);
        const p = validarPonto(op);
        m.pontos.push(p);
        partes.push(`+${descPonto(m, p)}`);
        break;
      }
      case 'ponto_remover': {
        const m = marcadorOr404(op.marcador_id);
        const alvo = validarPonto(op);
        const idx = m.pontos.findIndex((p) => p.data === alvo.data && norm(p.valor) === norm(alvo.valor));
        if (idx < 0) throw new NotFoundException(`ponto ${alvo.valor} (${alvo.data}) não está em ${m.nome}`);
        const [p] = m.pontos.splice(idx, 1);
        partes.push(`−${descPonto(m, p)}`);
        break;
      }
    }
  }
  return { cabecalho: ordenarCabecalho(cab), partes, alterou: partes.length > 0 };
}
