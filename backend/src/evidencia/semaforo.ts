import type { Semaforo } from '../database/entities';

// SEMÁFORO NO SERVIDOR — o interpretador genérico das regras de elegibilidade do corpus
// (`elegibilidade.regra` de cada regime, sobre os `campos_primitivos` do tumor), portado da
// app (`evalExpr`/`cmpOp`/`primRank` em app/index.html). Lógica de TRÊS valores: true /
// false / null (indeterminado). Nenhuma regra clínica é escrita aqui — tudo vem do dado.
//
// Por que existe uma segunda cópia: a validação de uma proposta de importação decide, NO
// SERVIDOR, se o protocolo proposto é verde (elegível + incorporado) antes de gravar a
// avaliação como vigente. Enquanto o semáforo vivesse só na app, bastava um POST direto
// com `semaforo: 'elegivel'` para um protocolo amarelo nascer vigente — a trava seria de
// tela, não de sistema (mesma família do `naoIncorporado()` do EvidenciaService). É
// dívida conhecida, e documentada aqui como no irmão: se o interpretador mudar, muda nos
// dois; o portão da importação compara o veredito do servidor com o da app para o mesmo
// paciente e quebra se saírem de sincronia.
//
// UMA diferença deliberada em relação à app: aqui NÃO há default por tipo. A app, ao
// desenhar o formulário, presume `false` para booleano ausente e a primeira opção para
// enum — é conveniência de tela. Na importação o snapshot só carrega o que foi INFORMADO
// (regra do piloto #80: booleano ausente NÃO vira false), então um primitivo que a regra
// referencia e que ninguém informou fica INDETERMINADO → 🟡, nunca verde. O validador
// preenche explicitamente o que falta se quiser o verde.

export interface CampoPrimitivo {
  campo: string;
  tipo: 'boolean' | 'enum' | 'integer' | 'number' | 'score' | string;
  opcoes?: any[];
  ordinal?: Record<string, number>;
  indeterminado?: any[];               // tokens que o motor trata como NÃO informado (ex.: "nao_testado")
  rotulos?: Record<string, string>;    // rótulo por opção (só apresentação)
  label?: string;
  secao?: string;
  estavel?: boolean;
  unidade?: string;
}
export type PrimMap = Record<string, CampoPrimitivo>;
export type CritMap = Record<string, any>;

const CMP_OPS: Record<string, 1> = { eq: 1, ne: 1, gt: 1, gte: 1, lt: 1, lte: 1, in: 1 };
const OP_SYM: Record<string, string> = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', in: '∈' };

function vazio(v: any): boolean { return v === undefined || v === null || v === ''; }
// Token INDETERMINADO declarado no vocabulário do squad (spec.indeterminado): vale como vazio
// → null (🟡). "Não testado" nunca libera verde, e nenhuma regra clínica mora aqui — o dado diz
// qual token é o vazio. Espelha `_indet` da app.
function indet(spec: CampoPrimitivo | undefined, v: any): boolean {
  return !!(spec && Array.isArray(spec.indeterminado) && spec.indeterminado.map(String).includes(String(v)));
}

function eqv(a: any, b: any): boolean {
  if (typeof b === 'boolean') return Boolean(a) === b;
  if (typeof b === 'number') return Number(a) === b;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// Ordinal a partir do primitivo: mapa `ordinal` (estadiamento; token fora do mapa → null,
// nunca 0), senão o índice em `opcoes`, senão o número.
function rank(spec: CampoPrimitivo | undefined, v: any): number | null {
  if (typeof v === 'number') return v;
  if (spec && spec.ordinal && Object.prototype.hasOwnProperty.call(spec.ordinal, String(v))) return spec.ordinal[String(v)];
  if (spec && spec.ordinal) return null;
  if (spec && Array.isArray(spec.opcoes)) { const i = spec.opcoes.map(String).indexOf(String(v)); return i < 0 ? null : i; }
  const n = Number(v); return isNaN(n) ? null : n;
}

function cmpOp(op: string, pv: any, cval: any, spec?: CampoPrimitivo): boolean | null {
  switch (op) {
    case 'eq': return eqv(pv, cval);
    case 'ne': return !eqv(pv, cval);
    case 'in': return Array.isArray(cval) && cval.some((x) => eqv(pv, x));
    case 'gt': case 'gte': case 'lt': case 'lte': {
      const a = typeof pv === 'number' ? pv : rank(spec, pv);
      const b = typeof cval === 'number' ? cval : rank(spec, cval);
      if (a == null || b == null) return null;
      if (op === 'gt') return a > b; if (op === 'gte') return a >= b; if (op === 'lt') return a < b; return a <= b;
    }
    default: return null;
  }
}

// and: algum false → false; senão algum null → null; senão true. or espelhado. ref resolve
// critérios nomeados do tumor (com guarda contra ciclo). Primitivo não informado → null.
export function evalExpr(node: any, vals: Record<string, any>, critMap: CritMap, primMap: PrimMap, seen?: Set<string>): boolean | null {
  if (!node || typeof node !== 'object') return null;
  const k = Object.keys(node)[0], v = node[k];
  if (k === 'and') { let unk = false; for (const c of v) { const r = evalExpr(c, vals, critMap, primMap, seen); if (r === false) return false; if (r === null) unk = true; } return unk ? null : true; }
  if (k === 'or') { let unk = false; for (const c of v) { const r = evalExpr(c, vals, critMap, primMap, seen); if (r === true) return true; if (r === null) unk = true; } return unk ? null : false; }
  if (k === 'not') { const r = evalExpr(v, vals, critMap, primMap, seen); return r === null ? null : !r; }
  if (k === 'ref') { if (seen && seen.has(v)) return null; const e = critMap && critMap[v]; if (!e) return null; const s = new Set(seen || []); s.add(v); return evalExpr(e, vals, critMap, primMap, s); }
  if (CMP_OPS[k]) { const [campo, cval] = v; const pv = vals[campo]; const sp = primMap && primMap[campo]; if (vazio(pv) || indet(sp, pv)) return null; return cmpOp(k, pv, cval, sp); }
  return null;
}

// Primitivos referenciados pela regra que estão VAZIOS ou em token indeterminado — é o "por
// quê" de um 🟡, e o que o validador precisa preencher para sair do amarelo.
export function camposFaltando(node: any, vals: Record<string, any>, critMap: CritMap, seen: Set<string> | null, out: string[], primMap?: PrimMap): void {
  if (!node || typeof node !== 'object') return;
  const k = Object.keys(node)[0], v = node[k];
  if (k === 'or' && evalExpr(node, vals, critMap, primMap, seen || undefined) === true) return;   // ramo já satisfeito: nada falta
  if (k === 'and' || k === 'or') { v.forEach((c: any) => camposFaltando(c, vals, critMap, seen, out, primMap)); return; }
  if (k === 'not') { camposFaltando(v, vals, critMap, seen, out, primMap); return; }
  if (k === 'ref') { if (seen && seen.has(v)) return; const e = critMap && critMap[v]; if (!e) return; const s = new Set(seen || []); s.add(v); camposFaltando(e, vals, critMap, s, out, primMap); return; }
  if (CMP_OPS[k]) { const [campo] = v; const pv = vals[campo]; if ((vazio(pv) || indet(primMap && primMap[campo], pv)) && !out.includes(campo)) out.push(campo); }
}

// ---- rótulos (só apresentação; espelham os da app) ----
function humanOpt(v: any): string {
  const s = String(v);
  if (s === 'true') return 'Sim'; if (s === 'false') return 'Não';
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  return s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
function shortLabel(l: string): string { return String(l).replace(/\s*\(.*\)\s*$/, '').trim(); }
function fieldLabel(campo: string, primMap: PrimMap): string {
  const s = primMap && primMap[campo];
  return shortLabel((s && s.label) || campo.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase()));
}
function optLabel(spec: CampoPrimitivo | undefined, v: any): string {
  if (spec && spec.rotulos && Object.prototype.hasOwnProperty.call(spec.rotulos, String(v))) return String(spec.rotulos[String(v)]);
  return humanOpt(v);
}
function leafLabel(campo: string, op: string, valor: any, primMap: PrimMap): string {
  const sp = primMap && primMap[campo];
  const val = Array.isArray(valor) ? '[' + valor.map((x) => optLabel(sp, x)).join(', ') + ']' : optLabel(sp, valor);
  return `${fieldLabel(campo, primMap)} ${OP_SYM[op] || op} ${val}`;
}
export function clauseLabel(node: any, primMap: PrimMap, critLabels: Record<string, string>): string {
  if (!node || typeof node !== 'object') return 'critério';
  const k = Object.keys(node)[0], v = node[k];
  if (k === 'ref') return critLabels[v] || String(v);
  if (CMP_OPS[k]) return leafLabel(v[0], k, v[1], primMap);
  if (k === 'not') return 'não (' + clauseLabel(v, primMap, critLabels) + ')';
  if (k === 'and') return v.map((c: any) => clauseLabel(c, primMap, critLabels)).join(' e ');
  if (k === 'or') return v.map((c: any) => clauseLabel(c, primMap, critLabels)).join(' ou ');
  return 'critério';
}

export interface ResultadoSemaforo {
  semaforo: Semaforo;
  status: 'ok' | 'warn' | 'bad';           // vocabulário da app (detalhe_semaforo.status)
  crits: { label: string; status: 'ok' | 'warn' | 'bad'; detail: string }[];
  faltando: string[];                       // primitivos que a regra pede e não foram informados
}

const STATUS_TO_SEM: Record<string, Semaforo> = { ok: 'elegivel', warn: 'atencao', bad: 'inelegivel' };

// Classifica um regime para um conjunto de valores INFORMADOS. Regime sem regra → verde
// (mesmo comportamento da app: `regra ? evalExpr(...) : true`). Uma chip por cláusula do
// `and` do topo (ou a regra inteira), como o card da app.
export function classificarRegra(
  regra: any,
  vals: Record<string, any>,
  critMap: CritMap,
  primMap: PrimMap,
  critLabels: Record<string, string>,
): ResultadoSemaforo {
  const res = regra ? evalExpr(regra, vals, critMap, primMap) : true;
  const status = res === true ? 'ok' : res === false ? 'bad' : 'warn';
  const clauses: any[] = regra && regra.and ? regra.and : regra ? [regra] : [];
  const crits = clauses.map((cl) => {
    const r = evalExpr(cl, vals, critMap, primMap);
    const st: 'ok' | 'warn' | 'bad' = r === true ? 'ok' : r === false ? 'bad' : 'warn';
    const falta: string[] = [];
    if (r === null) camposFaltando(cl, vals, critMap, null, falta, primMap);
    const detail = falta.length ? `não informado: ${falta.map((c) => fieldLabel(c, primMap)).join(', ')}` : '';
    return { label: clauseLabel(cl, primMap, critLabels), status: st, detail };
  });
  const faltando: string[] = [];
  if (regra) camposFaltando(regra, vals, critMap, null, faltando, primMap);
  return { semaforo: STATUS_TO_SEM[status], status, crits, faltando };
}
