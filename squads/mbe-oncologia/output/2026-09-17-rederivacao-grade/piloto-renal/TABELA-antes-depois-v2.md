# Piloto de calibração GRADE — RENAL · tabela ANTES → DEPOIS **v2** (após C1–C7)

**Data:** 2026-09-17 · **Base "antes":** valores do corpus publicado (RUN_ATIVO `2026-09-17-intake-revisao-4/v1` — os 10 renais
são idênticos aos do run anterior salvo aprovação/data do adj pembrolizumabe) · **Saída:** `piloto-renal/regimes-consolidados.json`
(schema 2; **não promovido**) · **Portão A:** passou, check [11] 10/10 (`portao-saida.txt`) · **v1** arquivada em `v1/`.

**Fontes:** as 9 já salvas + **6 publicações maduras dos mesmos estudos** exigidas por C4 (abstracts do Europe PMC, salvos em
`fontes/`; DOIs resolvem no Crossref): KEYNOTE-564 SG (NEJM 2024), sunitinibe vs IFN SG final (JCO 2009), CheckMate 214 8 anos
(Ann Oncol 2024), KEYNOTE-426 43 m (Eur Urol 2023), CheckMate 9ER 44 m (ESMO Open 2024), METEOR final (Lancet Oncol 2016).
COMPARZ: a SG final (NEJM 2014) é carta sem abstract → fica o 2013. CheckMate 025 (2020) e ASPEN já eram as versões maduras.
Toda transcrição continua copiada do arquivo salvo por busca literal (`rederivar_renal.py`). **0 indeterminados.**

## Decisões de calibração aplicadas (e onde cada uma vive)

| # | decisão | razão registrada | implementação |
|---|---|---|---|
| C1 | eventos dedutíveis contam | se o número se deduz do publicado, o dado existe; rebaixar pela redação do artigo é avaliar o texto, não a evidência | `efeito.eventos` + `eventos_por: "deduzido de <cálculo>"`; portão exige o cálculo e lista no WARN |
| C2 | comparador obsoleto rebaixa só se muda a decisão de hoje | comparador padrão na época que segue referência não leva segunda punição | `pivo.comparador_muda_decisao` obrigatório quando `comparador_padrao_atual=false`; só `true` força indireta ≤ −1 |
| C3 | IC > 95% não rebaixa por si | IC 99,8% que exclui o nulo é evidência mais segura | regra 4: o colchão 0,95 só vale para IC de exatamente 95%; outros níveis avaliam só a exclusão do nulo |
| C4 | sempre a publicação mais madura do mesmo estudo | atualizar versão não é trocar de estudo | `pivo.referencia_atualizada {doi, por}` → a `fonte` do card passa a ser ela; `efeito.analise=interina` sem versão madura → −1 obrigatório |
| C5 | fase II randomizado: ortodoxo | RCT parte de A independente da fase; cai por imprecisão (−2 com os critérios da ficha) | `rct_fase2` parte de A; `imprecisao_muito_seria` (eventos < 300 **e** IC não exclui o nulo a 95%) força −2 |
| C6 | direção controversa: Portão C | mérito clínico é do revisor | `recomendacao.direcao = pendente_revisor` (WARN) |
| C7 | referências propostas são adicionais | só a versão madura do mesmo estudo substitui (C4) | `pivo.referencias_adicionais[] {doi, papel}` (WARN); `referencia_proposta` aposentado |

## (a) Placar

| | corpus (antes) | v1 | **v2** |
|---|---|---|---|
| 1A | 8 | 2 | **3** (ipi+nivo int/alto, nivo+cabo, nivolumabe 2L) |
| 1B | 1 | 2 | **3** (adj pembrolizumabe, axitinibe+pembro, cabozantinibe pós-IO) |
| 2B | 1 | 1 | 0 |
| 2C | 0 | 3 | **3** (pazopanibe, sunitinibe, ipi+nivo favorável — este com direção pendente) |
| 2D | 0 | 2 | **1** (não-claras) |

Certeza: **A=3 · B=3 · C=3 · D=1**. Sobrevivência como 1A: 3/8 (38%) — v1 tinha 25%; a amostra da auditoria, 47%.
Forte a favor: 6/10; condicional: 4/10 (1 com direção pendente).

## (b) Quantos mudaram em relação à v1 e por qual regra

**8 de 10 mudaram de valor; 2 mantiveram** (pazopanibe 2C; não-claras 2D — este por caminho novo, C5). Por regime:

| regime | v1 | v2 | o que mudou | regra |
|---|---|---|---|---|
| adj pembrolizumabe | 1A | **1B** | ↓ fonte passou a ser a SG madura (NEJM 2024): HR 0,62 (0,44–0,87), ≈113 óbitos deduzidos, 3ª interina → −1 imprecisão. Com a SLD de 2022 (0,63; 0,50–0,80) era A | **C4** (+C1) |
| pazopanibe | 2C | 2C | = (só ganhou Sternberg 2010 como referência adicional) | C7 |
| sunitinibe favorável | 2B | **2C** | ↓ fonte passou a ser a SG final (JCO 2009): HR 0,821 (0,673–1,001) toca o nulo → −1 imprecisão; IFN muda a decisão de hoje → −1 indireta (o exemplo literal de C2). Alternativa para o revisor: SLP 2007 + exceção "crossover 33% documentado" → B | **C4 + C2** |
| ipi+nivo favorável | 2D | **2C** (dir. pendente) | ↑ 8 anos: SG HR 0,82 (0,60–1,13) — IC inclui o nulo mas o ponto já não é contra; indireta −1 (não −2), imprecisão −1. Direção → revisor | **C4 + C6** |
| ipi+nivo int/alto | 1B | **1A** | ↑ 8 anos: SG HR 0,69 (0,59–0,81) = efeito grande; some a interina/IC 99,8% | **C4** (C3 tornou-se irrelevante) |
| axitinibe+pembro | 1A | **1B** | ↓ análise final (43 m): HR 0,73 (0,60–0,88), RRR < 30%, óbitos não dedutíveis do abstract → −1 imprecisão (pedido *upgrade*: texto completo) | **C4** |
| nivo+cabo | 1B | **1A** | ↑ 44 m: HR 0,70 (0,56–0,87); medianas atingidas nos dois braços → ≥ 326 óbitos deduzidos | **C4 + C1** |
| nivolumabe 2L | 2C | **1A** | ↑ ≈640 óbitos deduzidos das taxas de SG 5 a (C1); everolimo não muda a decisão para esta indicação (C2) — as duas punições da v1 caem | **C1 + C2** |
| cabozantinibe pós-IO | 2C | **1B** | ↑ METEOR final: HR 0,66 (0,53–0,83), ≥ 329 óbitos deduzidos; fica só a indireta de **população** (pós-TKI → pós-IO) | **C4 + C1** (C2 evita a dupla punição) |
| não-claras (ASPEN) | 2D | 2D | = valor; caminho mudou: RCT parte de A, −1 indireta, **−2 imprecisão muito séria** (87 eventos, IC 80%, p=0,16) | **C5** |

Resumo: **8 mudaram de valor** (5 subiram: int/alto, nivo+cabo, nivolumabe 2L, cabozantinibe, ipi+nivo favorável; 3 desceram:
adj pembrolizumabe, sunitinibe, axitinibe+pembro), **2 mantiveram** (pazopanibe; não-claras — este por caminho novo).
Regra mais influente: **C4** (7 regimes), depois **C1** (4) e **C2** (2). As três descidas são todas efeito de C4 — a versão
madura mostrou efeito atenuado (0,53 → 0,73; 0,63 → 0,72) ou desfecho duro que toca o nulo (sunitinibe SG).

## (c) Convergência com o Cochrane nas 3 divergências da v1

| regime | v1 | Cochrane | **v2** | leitura |
|---|---|---|---|---|
| ipi+nivo int/alto | B | **alta** (CD012796, SG a 30 m) | **A** | **convergiu** — C4 fez o piloto usar dados maduros como o Cochrane fez |
| axitinibe+pembro | A | **moderada** (CD012796 e CD013798) | **B** | **convergiu** — C4 trocou a interina (0,53) pela final (0,73); a razão do Cochrane (interina + RoB) e a do piloto (OIS não demonstrável no abstract) diferem, o resultado não |
| nivolumabe 2L | C | **moderada** (CD011673, mortalidade 1 a) | **A** | **cruzou para o outro lado**: o Cochrane usou a análise primária (2015, 1 ano) e rebaixou; o piloto usa 5 anos com ≈640 óbitos e não rebaixa. Divergência agora é de *maturidade da fonte*, não de método — e o piloto está com a fonte mais madura |

As duas convergências prévias se mantêm (pazopanibe C = baixa; sunitinibe C ≈ moderada do Cochrane para "IFN vs terapia-alvo" —
o Cochrane agrupa 2 ensaios, o piloto lê o SG final de um só, que toca o nulo).

## Tabela completa v2

| # | regime | antes | certeza | rec. | depois | domínio decisivo | fonte do card (v2) · trecho transcrito |
|---|---|---|---|---|---|---|---|
| 1 | `renal-adj-pembrolizumab` | 1A | **B** | forte · a favor | **1B** | imprecisão −1: ≈113 óbitos (deduzido), limite 0,87 > 0,85, 3ª interina | **NEJM 2024** (C4) · "A significant improvement in overall survival was observed with pembrolizumab as compared with placebo (hazard ratio for death, 0.62; 95% confidence interval [CI], 0.44 to 0.87;" |
| 2 | `renal-met-favoravel-pazopanibe` | 1A | **C** | condicional · a favor | **2C** | indireta −1 (substituto) + imprecisão −1 (NI 1,22 vs 1,25) | NEJM 2013 · "Pazopanib was noninferior to sunitinib … (hazard ratio … 1.05; 95% confidence interval [CI], 0.90 to 1.22) … Overall survival was similar (… 0.91; 95% CI, 0.76 to 1.08)." |
| 3 | `renal-met-favoravel-sunitinibe` | 1A | **C** | condicional · a favor | **2C** | indireta −1 (IFN muda a decisão — C2) + imprecisão −1 (IC toca o nulo) | **JCO 2009** (C4) · "Median overall survival was greater in the sunitinib group than in the IFN-alpha group (26.4 v 21.8 months, respectively; hazard ratio [HR] = 0.821; 95% CI, 0.673 to 1.001;" |
| 4 | `renal-met-favoravel-ipilimumabe-nivolumabe` | 1B | **C** | condicional · **pendente** | **2C** | indireta −1 (exploratório; SLP/TRO a favor do sunitinibe) + imprecisão −1 (IC inclui o nulo) | **Ann Oncol 2024** (C4) · "… 0.82 (0.60-1.13) in FAV patients. \| PFS probabilities at 90 months were … 12.7% versus 17.0% (FAV) \| ORR … 29.6% versus 51.6% (FAV)." |
| 5 | `renal-met-intalto-ipilimumabe-nivolumabe` | 1A | **A** | forte · a favor | **1A** | nenhum: SG HR 0,69 (0,59–0,81) = efeito grande, 8 anos | **Ann Oncol 2024** (C4) · "the hazard ratio [HR; 95% confidence interval (CI)] for OS with NIVO+IPI versus SUN was 0.72 (0.62-0.83) in ITT patients, 0.69 (0.59-0.81) in I/P patients," |
| 6 | `renal-met-intalto-axitinibe-pembrolizumabe` | 1A | **B** | forte · a favor | **1B** | imprecisão −1: RRR 27%, óbitos não dedutíveis do abstract (pedido *upgrade*) | **Eur Urol 2023** (C4) · "Benefit with pembrolizumab plus axitinib versus sunitinib was maintained for OS (hazard ratio [HR], 0.73 [95% confidence interval {CI}, 0.60-0.88])," |
| 7 | `renal-met-intalto-nivolumabe-cabozantinibe` | 1A | **A** | forte · a favor | **1A** | nenhum: ≥ 326 óbitos (medianas atingidas), IC 0,56–0,87 | **ESMO Open 2024** (C4) · "Overall, 323 patients were randomised to NIVO + CABO and 328 to SUN. \| median OS favoured NIVO + CABO versus SUN (49.5 versus 35.5 months; HR 0.70; 95% CI 0.56-0.87)." |
| 8 | `renal-met-2l-pos-vegfr-nivolumabe` | 1A | **A** | forte · a favor | **1A** | nenhum: ≈640 óbitos (deduzido), everolimo não muda a decisão (C2) | Cancer 2020 · "… nivolumab (n = 410) or everolimus (n = 411); \| … HR, 0.73; 95% CI, 0.62-0.85) with 5-year OS probabilities of 26% and 18%, respectively." |
| 9 | `renal-met-2l-pos-io-cabozantinibe` | 1A | **B** | forte · a favor | **1B** | indireta −1 (população pós-TKI → pós-IO) | **Lancet Oncol 2016** (C4) · "Median overall survival was 21·4 months (95% CI 18·7-not estimable) with cabozantinib and 16·5 months (14·7-18·8) with everolimus (hazard ratio [HR] 0·66 [95% CI 0·53-0·83];" |
| 10 | `renal-naoclaras-sunitinibe-pazopanibe` | 2B | **D** | condicional · a favor | **2D** | imprecisão **−2** (C5: 87 eventos, IC 80%, p=0,16) + indireta −1 | Lancet Oncol 2016 · "87 progression-free survival events had occurred … hazard ratio 1·41 [80% CI 1·03-1·92]; p=0·16)" |

## O que o referendo clínico ainda decide (acumula para o lote)

- **C6** — direção do ipi+nivo em risco favorável (2C, pendente).
- **Sunitinibe favorável**: 2C pela SG final, ou B pela SLP de 2007 com exceção "crossover 33% documentado"? (é a única leitura
  alternativa que o método deixa aberta).
- **Adj pembrolizumabe 1B**: consequência mecânica de C4 (SG interina com ≈113 óbitos). Se o revisor preferir SLD como desfecho
  crítico em adjuvância (o primário do ensaio), volta a A com a fonte de 2022 — decisão de *desfecho crítico*, não de regra.
- **Limiar de efeito grande (RRR ≥ 30% e IC sup ≤ 0,85)**: adj pembrolizumabe (0,62; 0,44–**0,87**) e KEYNOTE-426 (0,73) ficaram
  B por ele. É o único limiar numérico que ainda não passou pelo referendo.

## Pendências de artigo após a v2

Só **1 upgrade** real: KEYNOTE-426 43 m — contagem de óbitos no texto completo (B → A). Os demais pedidos da v1 foram resolvidos
por C1 (dedução) ou C4 (versão madura). `PEDIDOS-DE-ARTIGO.md` atualizado.

---

## Adendo v2.1 — C8 e sunitinibe (2026-09-17, após a v2)

**C8 aplicada** (curativo: SLD/iDFS/SLE/SLR/controle local = desfecho crítico duro; metastático: só SG/mortalidade; portão barra
desfecho curativo em regime metastático — 2 casos sintéticos novos, C8a passa / C8b barra).

| regime | v2 | **v2.1** | o que aconteceu |
|---|---|---|---|
| `renal-adj-pembrolizumab` | 1B (SG, interina) | **1B** (SLD, C8) | desfecho crítico passou a ser a **SLD** madura (NEJM 2024: HR 0,72; 0,59–0,87, `analise=atualizada`). Continua B porque o OIS não é demonstrável: eventos de SLD não estão no abstract e RRR 28% fica abaixo da **convenção do squad** (30% + IC sup ≤ 0,85). Com a SLD de 30 m (0,63; 0,50–0,80) seria A; com a contagem de eventos do texto completo, provavelmente A → **pedido upgrade**. C8 não mudou o valor aqui — SLD já era duro no vocabulário; o que segura é o limiar de efeito grande |
| `renal-met-favoravel-sunitinibe` | 2C (SG final) | **2B** | crossover **documentado no abstract do JCO 2009** ("Within the IFN-alpha group, 33% of patients received sunitinib, and 32% received other VEGF-signaling inhibitors after discontinuation") → exceção da regra 2, transcrita em `substituto_excecao.por`; desfecho crítico volta a ser a SLP (0,42; 0,32–0,54, pivô 2007); JCO 2009 entra como referência **adicional** (C7). Fica −1 indireta (IFN muda a decisão, C2) → B. = gabarito da auditoria |

Placar renal v2.1: **A=3 · B=4 · C=2 · D=1** — 1A ×3 (ipi+nivo int/alto, nivo+cabo, nivolumabe 2L) · 1B ×3 (adj pembrolizumabe,
axitinibe+pembro, cabozantinibe pós-IO) · 2B ×1 (sunitinibe) · 2C ×2 (pazopanibe; ipi+nivo favorável, direção pendente) · 2D ×1 (não-claras).

**Limiar de efeito grande** (RRR ≥ 30% e IC sup ≤ 0,85): mantido como **CONVENÇÃO DO SQUAD sujeita a referendo** — não é regra GRADE
canônica. No renal ele decide sozinho dois B (adj pembrolizumabe 0,72; axitinibe+pembro 0,73).
