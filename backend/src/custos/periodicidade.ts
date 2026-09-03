// Periodicidade do esquema, derivada do TEXTO: o INTERVALO ENTRE CICLOS.
//
// Por que derivar em vez de ler um campo: o bloco `expectativa_uso` só carrega
// `periodicidade_dias` quando o tipo é `fixa`. No tipo `ate_progressao` o número que
// existe é um TEMPO (meses de PFS ou de exposição), e para virar CICLOS precisa do
// intervalo entre aplicações — que está no esquema, não no bloco.
//
// A regra dura: só vale periodicidade ÚNICA. Esquema que admite duas cadências
// ("a cada 21 dias ou semanal") não tem resposta, e chutar uma delas erraria o custo por
// um fator de 3. Zero também não tem resposta: oral diário contínuo (osimertinibe,
// sunitinibe) não tem intervalo de ciclo nenhum no texto.
//
// PARENTESCO com `periodicidades_do_esquema` do portão de dados (Python), que é parecida
// mas NÃO é a mesma função — e a diferença é deliberada, não deriva:
//
//   • Lá a pergunta é "a periodicidade que este bloco AFIRMA é rastreável ao texto?".
//     Para responder isso ela também lê listas de dias ("D1, D22, D43" → 21), porque há
//     esquema que escreve as datas em vez do intervalo.
//   • Aqui a pergunta é "qual é o intervalo ENTRE CICLOS?". Lista de dias quase sempre
//     é intra-ciclo — "Eribulina D1 e D8 a cada 21 dias" tem ciclo de 21 dias, não de 7 —
//     então incluí-la produziria 3x ciclos a mais e 3x o custo.
//
// Consequência: sobre os 295 esquemas as duas discordam em 39, sempre no mesmo sentido
// (a do portão vê intervalos a mais). Onde a lista de dias é o ÚNICO sinal, esta devolve
// vazio e o regime cai em "sem estimativa" — o lado seguro do erro. O portão de custo
// tem a sua própria cópia mínima desta regra, de propósito: portão que importa a função
// sob teste não testa nada.

const SEM_ACENTO = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// [regex, multiplicador para dias]
const PADROES: [RegExp, number][] = [
  [/a cada (\d+)\s*dias/g, 1],
  [/a cada (\d+)\s*sem(?:anas?)?\b/g, 7],
  [/a cada (\d+)\s*meses/g, 30],
  [/\b(\d+)\s*em\s*\1\s*dias/g, 1],
  [/\b(\d+)\/\1\s*d\b/g, 1],
  [/\b(\d+)\/\1\s*dias/g, 1],
  [/\b(\d+)\/\1\s*sem(?:anas?)?\b/g, 7],
  [/ciclos?\s*de\s*(\d+)\s*dias/g, 1],
  [/mg\/(\d+)\s*sem/g, 7],
];

export function periodicidadesDoEsquema(esquema: string): number[] {
  const t = SEM_ACENTO(esquema);
  const vals = new Set<number>();
  for (const [re, mult] of PADROES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const v = Number(m[1]) * mult;
      if (v >= 1 && v <= 180) vals.add(v);
    }
  }
  if (/\bsemanal(mente)?\b/.test(t) || /\/\s*semana\b/.test(t)) vals.add(7);
  return [...vals].sort((a, b) => a - b);
}

// Periodicidade utilizável = existe UMA só. Zero (oral diário contínuo, que não tem
// intervalo de ciclo) e duas ou mais (alternativas) devolvem null — o chamador vira
// "sem estimativa", nunca um palpite.
export function periodicidadeUnica(esquema: string): number | null {
  const p = periodicidadesDoEsquema(esquema);
  return p.length === 1 ? p[0] : null;
}
