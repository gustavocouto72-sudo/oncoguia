// ARITMÉTICA DE INSUMO — dose declarada → mg por aplicação → frascos → desperdício.
//
// Fica num arquivo próprio, sem dependência de Nest, de banco ou de repositório, por dois
// motivos: é a parte que decide dinheiro (um frasco a mais por aplicação, vezes ciclos,
// vezes pacientes) e é a parte que o portão precisa recalcular com regra PRÓPRIA. Portão
// que importa a função sob teste não testa nada — então esta é escrita para ser fácil de
// reimplementar do zero, não para ser importada de fora.

import type { UnidadeApresentacao } from '../database/entities';

// DIMENSÃO: massa, unidade internacional e atividade radioativa não se convertem entre si.
// Uma dose de "30 UI" de BCG não pode ser paga com um frasco de "30 mg" de outra coisa —
// e sem esta separação seria exatamente isso que aconteceria, em silêncio.
export type Dimensao = 'mg' | 'UI' | 'GBq';

// Vocabulário FECHADO de unidade de dose, o mesmo de extracao-composicao/regras.py.
// Unidade nova exige decidir aqui como ela vira mg — então ela entra nos dois lugares
// juntos, ou não entra em nenhum.
export const UNIDADES_DOSE = [
  'mg_m2', 'mg_kg', 'mg', 'g', 'g_m2', 'mcg', 'mcg_kg', 'UI', 'AUC', 'GBq',
] as const;
export type UnidadeDose = (typeof UNIDADES_DOSE)[number];

export const DIMENSAO_DA_DOSE: Record<UnidadeDose, Dimensao> = {
  mg_m2: 'mg', mg_kg: 'mg', mg: 'mg', g: 'mg', g_m2: 'mg',
  mcg: 'mg', mcg_kg: 'mg', AUC: 'mg', UI: 'UI', GBq: 'GBq',
};

export const DIMENSAO_DA_APRESENTACAO: Record<UnidadeApresentacao, Dimensao> = {
  mg: 'mg', g: 'mg', mcg: 'mg', UI: 'UI', GBq: 'GBq',
};

// O CORPO sobre o qual a dose é calculada. `origem` existe porque a diferença entre
// "1,75 m² declarado" e "1,78 m² deste paciente" não é detalhe: o primeiro é o custo de
// um paciente que não existe, e a tela tem de dizer qual dos dois está mostrando.
export interface Corpo {
  sc_m2: number;
  peso_kg: number;
  clearance_ml_min: number;
  origem_sc: 'padrao_declarado' | 'paciente';
  origem_peso: 'padrao_declarado' | 'paciente';
  origem_clearance: 'padrao_declarado';
}

// Superfície corporal por Mosteller — a fórmula mais usada em oncologia e a única que
// precisa só de peso e altura. Só é chamada quando o paciente TEM as duas medidas.
export function scMosteller(pesoKg: number, alturaCm: number): number {
  return Math.sqrt((alturaCm * pesoKg) / 3600);
}

// Conteúdo do frasco na unidade BASE da sua dimensão (mg, UI ou GBq).
export function conteudoNaBase(valor: number, unidade: UnidadeApresentacao): number {
  if (unidade === 'g') return valor * 1000;
  if (unidade === 'mcg') return valor / 1000;
  return valor; // mg, UI, GBq já estão na base
}

// Quantidade por APLICAÇÃO, na unidade base da dimensão da dose.
// AUC usa Calvert: dose_mg = AUC × (clearance + 25). O 25 é a constante da fórmula, não um
// parâmetro — o que é declarado (e configurável) é o clearance.
export function quantidadePorAplicacao(valor: number, unidade: UnidadeDose, corpo: Corpo): number {
  switch (unidade) {
    case 'mg_m2': return valor * corpo.sc_m2;
    case 'mg_kg': return valor * corpo.peso_kg;
    case 'mg': return valor;
    case 'g': return valor * 1000;
    case 'g_m2': return valor * 1000 * corpo.sc_m2;
    case 'mcg': return valor / 1000;
    case 'mcg_kg': return (valor * corpo.peso_kg) / 1000;
    case 'AUC': return valor * (corpo.clearance_ml_min + 25);
    case 'UI': return valor;
    case 'GBq': return valor;
  }
}

export interface Frascos {
  aplicacoes_por_ciclo: number;
  quantidade_por_aplicacao: number;   // na base da dimensão
  frascos_por_aplicacao: number;      // inteiro, arredondado para CIMA
  frascos_por_ciclo: number;
  desperdicio_por_ciclo: number;      // na base da dimensão
  desperdicio_pct: number;            // 0–100
}

// Arredonda para CIMA por APLICAÇÃO, não por ciclo: cada administração abre frascos
// novos, e sobra de segunda-feira não é reaproveitada na segunda seguinte. Arredondar no
// ciclo inteiro subestimaria a compra em regimes de vários dias — que são exatamente os
// que mais consomem frasco.
export function frascosDoItem(
  quantidadePorAplicacao: number,
  conteudoBase: number,
  aplicacoesPorCiclo: number,
): Frascos {
  const porAplicacao = Math.ceil(quantidadePorAplicacao / conteudoBase);
  const porCiclo = porAplicacao * aplicacoesPorCiclo;
  const compradoPorCiclo = porCiclo * conteudoBase;
  const usadoPorCiclo = quantidadePorAplicacao * aplicacoesPorCiclo;
  const desperdicio = compradoPorCiclo - usadoPorCiclo;
  return {
    aplicacoes_por_ciclo: aplicacoesPorCiclo,
    quantidade_por_aplicacao: arred(quantidadePorAplicacao, 3),
    frascos_por_aplicacao: porAplicacao,
    frascos_por_ciclo: porCiclo,
    desperdicio_por_ciclo: arred(desperdicio, 3),
    desperdicio_pct: compradoPorCiclo > 0 ? arred((desperdicio / compradoPorCiclo) * 100, 1) : 0,
  };
}

export function arred(v: number, casas: number): number {
  const f = Math.pow(10, casas);
  return Math.round(v * f) / f;
}

// Dinheiro em CENTAVOS inteiros no caminho todo: frascos × preço × ciclos × pacientes é
// multiplicação encadeada, e ponto flutuante acumula erro em cada passo. Converte no fim.
export function centavos(reais: number): number {
  return Math.round(reais * 100);
}

export function reais(cent: number): number {
  return Math.round(cent) / 100;
}
