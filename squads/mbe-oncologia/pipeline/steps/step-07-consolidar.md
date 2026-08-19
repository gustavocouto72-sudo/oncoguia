---
step: "07"
name: "Consolidação"
type: agent
agent: consolidador
execution: subagent
model_tier: powerful
tasks:
  - consolidar
depends_on: ['step-03', 'step-04', 'step-05', 'step-06']
---

# Step 07 — Consolidação e selo de confiança

## Para o Pipeline Runner
Executar a task `consolidar` da Consuelo. Ela junta os quatro vereditos por regime, decide o status geral e emite o selo de confiança, e escreve um relatório legível das divergências para o oncologista.

## Inputs
- `output/regimes-extraidos.json`
- `output/verificacao-grade.json`, `verificacao-mcbs.json`, `verificacao-custo.json`, `verificacao-elegibilidade.json`

## Outputs
- `output/regimes-consolidados.json` — regime + 4 eixos (afirmado × re-derivado) + `consolidacao` (status, selo, flags).
- `output/relatorio-divergencias.md` — só o que precisa de olho humano, em linguagem clínica.

## Regras do selo (confronto real, não carimbo)
Um selo só pode ser `confirmado` quando **houve confronto real** — o protocolo afirmou algo e a re-derivação bateu. "O protocolo não afirmou e a re-derivação é sólida" **não** é `confirmado`; é `re_derivado`.

Precedência (avaliar nesta ordem):
1. `divergencia` — ≥1 eixo `diverge` do afirmado. Vai para o topo do relatório humano.
2. **Validação de DOI (obrigatória).** Todo DOI-fonte tem de resolver de fato (HTTP + Crossref). Se algum DOI-fonte do regime der 404/não resolver → `flag: doi_nao_resolvido` e o regime **não pode** ser `confirmado` (cai para `incompleto`).
3. `confirmado` — ≥1 eixo `concorda` (confronto real) **E** nenhum `diverge` **E** nenhum `indeterminado` crítico (grade ou elegibilidade) **E** todos os DOIs-fonte resolvem. O eixo de custo em `estimativa` **não** conta como confronto e **não** bloqueia, mas sozinho nunca sustenta um `confirmado`.
4. `incompleto` — ≥1 eixo `indeterminado` crítico por falta de fonte, ou `doi_nao_resolvido`. Sinaliza o que falta.
5. `re_derivado` — nenhum confronto (nenhum `concorda`) mas avaliação própria sólida em todos os eixos; nada diverge, nada indeterminado crítico. É o caso "sólido, mas o protocolo não deu o que confrontar".

Regra do eixo de custo: custo sem fonte primária resolvível é `estimativa`, nunca `concorda`; não conta para `confirmado`.

**Política conservadora (na dúvida, rebaixe).** O objetivo do selo é ser honesto e mandar o borderline ao oncologista (Step 08), não maximizar "verde":
- Se o **esquema exato** (ex.: nº de ciclos) ou a **população** do regime **não estão no pivô citado** → `re_derivado` com flag `indirectness_regime`, nunca `confirmado`.
- Se a **referência é diretriz/consenso** (ESMO/NCCN/PCDT/consenso) e **não um ensaio com população discreta** → elegibilidade `re_derivado` (flag `fonte_diretriz`), nunca `concorda`.
- Sem DOI/estudo-pivô → `incompleto`/`indeterminado`; nunca fabricar para "completar".
- `confirmado`/`concorda` só com **confronto limpo**. Havendo qualquer ambiguidade, rebaixe para `re_derivado`.
