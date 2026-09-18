# Onda 2 — COLORRETAL (13 regimes) · tabela ANTES → DEPOIS

**Data:** 2026-09-17 · **Regras:** schema 2 + C1–C9 · **Base "antes":** RUN_ATIVO `2026-09-17-intake-revisao-4/v1` ·
**Saída:** `onda-2-colorretal/regimes-consolidados.json` (**não promovido**) · **Portão A:** passou, check [11] 13/13 (`portao-saida.txt`) ·
**DOIs:** 13 fontes + 8 adicionais resolvem no Crossref.

**Fontes abertas:** Crossref + Europe PMC para os 13 DOIs registrados; C4: X-ACT final (2012), NO16968 final (2015), MOSAIC 10 anos, TRIBE final
(2015), PRIME final (2014), CRYSTAL+OPUS pooled, VELOUR primária (2012), NO16966, IDEA; Cochrane: CD007047 (anti-EGFR, 2017, GRADE), CD005392
(anti-angiogênicos, 2009), CD005390 (adjuvância EII, 2008), CD006041 (QRT vs RT em reto, 2013). KEYNOTE-177 e PRODIGE 23 já estavam registrados
na versão madura. Respostas cruas em `fontes/`; transcrições por busca literal (`rederivar_colorretal.py`).

## Placar

| | antes | **depois** |
|---|---|---|
| 1A | **12** | **4** — oxaliplatina adj EIII (NO16968 final), anti-EGFR (**C9**, Cochrane alta), pembrolizumabe MSI-H (crossover 62% → exceção), TAS-102 + bev (SUNLIGHT) |
| 1B | 1 | **2** — TNT-FOLFIRINOX (PRODIGE 23), fluoropirimidina adj EII (**C9**, Cochrane sem grau → teto B) |
| 2B | 0 | **3** — bevacizumabe 1L (**C9**), aflibercepte, regorafenibe (não incorporados → **contra**) |
| 2C | 0 | **1** — FOLFOXIRI (TRIBE: bevacizumabe nos dois braços; IC encosta no nulo) |
| indeterminado | 0 | **3** — QRT com capecitabina (Hofheinz: sem HR/IC), TNT FOLFOX/CAPOX (OPRA: sem braço sem TNT), doublet metastático (de Gramont: sem HR; SG NS) |

Certeza: **A=4 · B=5 · C=1 · indeterminado=3**. Sobrevivência como 1A: **4/12 (33%)**. Forte a favor 6 · condicional a favor 1 · condicional
**contra** 3.

Causas raiz:
- **Pivô sem efeito transcritível (3 → indet.)**: abstract só com taxas por braço (Hofheinz), ensaio que compara duas sequências de TNT sem
  comparador padrão (OPRA — fase 2, o caso "fase II com 1A" da auditoria), ensaio de 2000 sem HR e com SG NS usado como pivô de uma classe.
- **C9 aplicada a 3**: anti-EGFR sobe a A pelo corpo (CRYSTAL sozinho seria B por SLP); estádio II fica B pelo corpo sem grau; bevacizumabe
  fica B pelo corpo (com direção *contra* por não incorporado).
- **Não incorporado com 1A (3 → 2B)**: bevacizumabe, aflibercepte, regorafenibe — MCBS 1 os três; a letra fica B, a direção inverte.
- **Exceção de crossover (1 → mantém 1A)**: KEYNOTE-177, 62% de crossover efetivo transcrito; SLP HR 0,60 é efeito grande.

## Tabela

| # | regime | antes | certeza | rec. | depois | domínio decisivo | fonte do card · trecho transcrito |
|---|---|---|---|---|---|---|---|
| 1 | `retal-neoadj-crt-capecitabina` — Hofheinz 2012 | 1A | **indet.** | — | — | **abstract sem HR/IC**: SG 5 a 76% [67–82] vs 67% [58–74], NI p=0,0004; SLD 3 a p=0,07 | pedido: texto completo (HR/IC) |
| 2 | `retal-tnt-folfox-capox` — OPRA | 1A | **indet.** | — | — | **sem comparador sem TNT**: indução vs consolidação, SLD 5 a 71% vs 69% (p=0,68); TME-free 39% vs 54% | DECISÃO: pivô comparativo (RAPIDO; Cochrane CD015590 ainda protocolo) |
| 3 | `retal-tnt-folfirinox` — PRODIGE 23, 7 anos | 1A | **B** | forte · a favor | **1B** | imprecisão −1: IC da diferença de RMST em SG 0,35–8,38 m encosta em 0; < 300 óbitos | Ann Oncol 2024 · "The 7-year OS was 81.9% (95% CI 75.8% to 86.6%) … and 76.1% (95% CI 69.7% to 81.2%) … (RMST difference 4.37 months, 95% CI 0.35-8.38 months, P = 0.033)." |
| 4 | `colon-adj-fluoropirimidina-stageII` — **C9: Cochrane CD005390** (+X-ACT) | 1A | **B** | forte · a favor | **1B** | teto B (revisão sem grau) via imprecisão −1; SG não demonstrada (RR 0,96). X-ACT (registrado) é de **estádio III** — não responde à pergunta | **Cochrane 2008** · "the pooled relative risk ratio for overall survival was 0.96 (95% confidence interval 0.88, 1.05). With regards to disease-free survival, the pooled relative risk ratio was 0.83 (95% confidence interval 0.75, 0.92)." |
| 5 | `colon-adj-oxaliplatina-stageIII` — NO16968 final (+MOSAIC, IDEA) | 1A | **A** | forte · a favor | **1A** | nenhum: SLD HR 0,80 (0,69–0,93), 648 eventos (da primária); SG HR 0,83 a 7 anos | **JCO 2015** (C4) · "Seven-year DFS rates were 63% and 56% … (hazard ratio [HR], 0.80; 95% CI, 0.69 to 0.93; P = .004). Seven-year OS rates were 73% and 67% … (HR, 0.83; 95% CI, 0.70 to 0.99; P = .04)." |
| 6 | `crc-met-quimio-doublet` — de Gramont 2000 | 1A | **indet.** | — | — | **sem HR/IC; SG NS** (16,2 vs 14,7 m, p=0,12) — pivô de uma classe | DECISÃO: corpo/pivôs por doublet |
| 7 | `crc-met-folfoxiri` — TRIBE final | 1B | **C** | condicional · a favor | **2C** | indireta −1 (bevacizumabe nos dois braços; regime sem bev) + imprecisão −1 (IC sup 0,98; ≥ 254 óbitos) | **Lancet Oncol 2015** (C4) · "median overall survival was 29·8 months … compared with 25·8 months … (hazard ratio [HR] 0·80, 95% CI 0·65-0·98; p=0·03)." |
| 8 | `crc-met-anti-egfr` — **C9: Cochrane CD007047** (+CRYSTAL/OPUS, PRIME) | 1A | **A** | forte · a favor | **1A** | nenhum: SG HR 0,77 (0,67–0,88) em RAS wt estendido, **alta**; regime (esquerdo, RAS/BRAF wt) ⊂ população | **Cochrane 2017** · "For the extended RAS wild-type population … addition of EGFR MAb improved progression-free survival (HR 0.60, 95% CI 0.48 to 0.75; moderate-quality evidence) and overall survival (HR 0.77, 95% CI 0.67 to 0.88; high-quality evidence)." |
| 9 | `crc-met-pembrolizumabe-msi` — KEYNOTE-177 > 5 anos | 1A | **A** | forte · a favor | **1A** | nenhum: SLP HR 0,60 (0,45–0,79) = efeito grande; SG HR 0,73 (0,53–0,99) com **crossover efetivo 62% transcrito** → exceção da regra 2 | Ann Oncol 2025 · "Median PFS was 16.5 months with pembrolizumab and 8.2 months with chemotherapy (hazard ratio, 0.60; 95% confidence interval 0.45-0.79)." |
| 10 | `crc-met-tas-bevacizumab` — SUNLIGHT | 1A | **A** | forte · a favor | **1A** | nenhum: SG HR 0,61 (0,49–0,77) = efeito grande | NEJM 2023 · "The median overall survival was 10.8 months in the combination group and 7.5 months in the FTD-TPI group (hazard ratio for death, 0.61; 95% confidence interval [CI], 0.49 to 0.77;" |
| 11 | `crc-met-bevacizumabe-1l-nao-incorporado` — **C9: Cochrane CD005392** (+Hurwitz pooled, NO16966) | 1A | **B** | condicional · **contra** | **2B** | inconsistência −1 (heterogeneidade em SLP; NO16966 sem SG); revisão sem grau (teto B). Não incorporado → contra | **Cochrane 2009** · "The overall HR s for PFS (0.61, 95% CI 0.45 - 0.83) and OS (0.81, 95% 0.73 - 0.90) for the comparison of first-line chemotherapy, with or without bevacizumab, confirms significant benefits … However, the effect on PFS shows significant heterogeneity." |
| 12 | `crc-met-aflibercepte-nao-incorporado` — VELOUR primária | 1A | **B** | condicional · **contra** | **2B** | imprecisão −1: RRR 18%, N/óbitos não no abstract; IC 95,34% 0,713–0,937 exclui o nulo (C3). A fonte registrada era a análise de **subgrupos** | **JCO 2012** · "Adding aflibercept to FOLFIRI significantly improved overall survival relative to placebo plus FOLFIRI (hazard ratio [HR], 0.817; 95.34% CI, 0.713 to 0.937; P = .0032) with median survival times of 13.50 versus 12.06 months, respectively." |
| 13 | `crc-met-regorafenibe-nao-incorporado` — CORRECT | 1A | **B** | condicional · **contra** | **2B** | imprecisão −1: análise interina sem versão madura (C4); ≥ 381 óbitos, IC 0,64–0,94 | Lancet 2013 · "The primary endpoint of overall survival was met at a preplanned interim analysis … Median overall survival was 6·4 months … versus 5·0 months … (hazard ratio 0·77; 95% CI 0·64-0·94; one-sided p=0·0052)." |

## Triangulação Cochrane (só leitura)

| regime | onda 2 | Cochrane | leitura |
|---|---|---|---|
| anti-EGFR | A (C9) | CD007047: SG RAS wt HR 0,77 **alta**; SLP **moderada** | é a própria fonte do card (C9) |
| bevacizumabe 1L | B (C9) | CD005392 (2009): SG HR 0,81, sem grau; heterogeneidade em SLP | é a própria fonte (teto B) |
| fluoropirimidina adj EII | B (C9) | CD005390 (2008): SLD RR 0,83; SG RR 0,96 NS; sem grau | é a própria fonte (teto B) |
| QRT neoadjuvante de reto | indet. | CD006041 (2013): QRT vs RT — controle local melhor, SLD/SG iguais; sem grau | não compara capecitabina vs 5-FU; sem efeito para o regime |
| doublet metastático | indet. | CD001545 (2000): QT paliativa vs BSC, sem grau; CD008593: irinotecano + fluoropirimidina vs irinotecano | nenhuma responde "doublet vs fluoropirimidina isolada" com grau |
| oxaliplatina adj EIII, TNT, MSI-H, SUNLIGHT, aflibercepte, regorafenibe | — | sem revisão Cochrane localizada | — |

Síntese: nas 3 comparações em que há Cochrane com efeito transcritível, ele **virou a fonte** (C9). Nenhuma divergência restante.

## Para o referendo

1. **3 indeterminados** (FATO/DECISÃO no PEDIDOS): Hofheinz é só texto completo; OPRA e de Gramont exigem escolha de pivô/corpo.
2. **Exceção de crossover no KEYNOTE-177** mantém 1A pela SLP — o revisor confirma que 62% de crossover justifica a exceção.
3. **FOLFOXIRI 2C**: a indireta por "bevacizumabe nos dois braços" é juízo — sem ela, B.
4. **Direção contra** nos 3 não incorporados (MCBS 1): D4 aplicada; letras B.
5. **Convenção de efeito grande** sustentou 2 A (SUNLIGHT 0,77; KEYNOTE-177 SLP 0,79).
