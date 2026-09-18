# PEDIDOS DE ARTIGO — lista única, ordenada por impacto (4 ondas, 50 regimes)

**Data:** 2026-09-18 · **Protocolo:** PDF em `squads/mbe-oncologia/pipeline/data/artigos-fornecidos/<PMID>.pdf`; repescagem transcreve com
`fonte_transcricao = pdf_fornecido_revisor` + `proveniencia = "PDF fornecido pelo revisor metodológico, conferido contra DOI <x>"`, como passo
próprio após as ondas. Histórico por onda em `_PEDIDOS-por-onda-historico.md`.

**Impacto** = o que muda de valor se o artigo abrir. **Só PDF** = sem abstract na escada (carta/suplemento); os demais são textos completos
cujo abstract já foi lido — o que falta é a contagem de eventos/IC. Os itens de **DECISÃO** (qual ensaio sustenta o regime) não são pedidos de
artigo: estão no REFERENDO-CLINICO §3 e só depois viram busca.

| ordem | regime | artigo | DOI · PMID | o que falta | impacto |
|---|---|---|---|---|---|
| 1 | `gastrico-met-her2-trastuzumabe-qt` | ToGA (Lancet 2010) | 10.1016/S0140-6736(10)61121-X · 20728210 | contagem de óbitos por braço (dedução dá ≥ 292; limiar 300) | **1B → 1A** (padrão HER2 — o de maior uso na lista) |
| 2 | `gastrico-met-her2-pembro-tras-qt` | KEYNOTE-811 análise final — **carta NEJM 2024** | 10.1056/nejmc2408121 · 39282917 | **só PDF**: SG final | **2C → 1B** se SG significativa (hoje C por substituto + interina) |
| 3 | `renal-adj-pembrolizumab` | KEYNOTE-564, 57 m (NEJM 2024) | 10.1056/nejmoa2312695 · 38631003 | nº de eventos de SLD por braço | **1B → 1A** se ≥ 300 (ou por M1) |
| 4 | `gastrico-adj-crt-5fu-lv` | INT0116 (Smalley 2012) | 10.1200/JCO.2011.36.7136 · 22585691 | nº de óbitos por braço (texto PMC sem taxas) | **1B → 1A** |
| 5 | `retal-neoadj-crt-capecitabina` | Hofheinz 2012 (Lancet Oncol) | 10.1016/S1470-2045(12)70116-X · 22503032 | HR/IC de SG e SLD (abstract só tem taxas por braço) | **indet. → B/A** — único indeterminado que o artigo resolve sozinho |
| 6 | `renal-met-intalto-axitinibe-pembrolizumabe` | KEYNOTE-426, 43 m (Eur Urol 2023) | 10.1016/j.eururo.2023.06.006 · 37500340 | contagem de óbitos por braço | **1B → 1A** |
| 7 | `eso-neoadj-crt-carbo-paclitaxel` | CROSS 10 anos (JCO 2021) | 10.1200/jco.20.03614 · 33891478 | contagem de óbitos (dedução ≈ 251) | **1B → 1A** só se M1 relaxar o IC sup (RRR já é 30%) — senão nada |
| 8 | `retal-tnt-folfirinox` | PRODIGE 23, 7 anos (Ann Oncol 2024) | 10.1016/j.annonc.2024.06.019 · 38986769 | HR de SG/SLD e N por braço (abstract só tem RMST) | 1B → 1B/1A (depende do HR) |
| 9 | `gastrico-zolbetuximabe-nao-incorporado` | SPOTLIGHT (Lancet 2023) | 10.1016/S0140-6736(23)00620-7 · 37068504 | nº de óbitos / medianas de SG — ou a SG final (ASCO 2024, não indexada) | 2B → 2A (direção contra mantida) |
| 10 | `crc-met-aflibercepte-nao-incorporado` | VELOUR primária (JCO 2012) | 10.1200/jco.2012.42.8201 · 22949147 | N e óbitos por braço | 2B → 2A (contra mantida) |
| 11 | `crc-met-regorafenibe-nao-incorporado` | CORRECT (Lancet 2013) | 10.1016/S0140-6736(12)61900-X · 23177514 | versão madura (não localizada) — ou M6 aceita a interina com ≥ 381 óbitos | 2B → 2A (contra mantida) |
| 12 | `colo-qrt-io-keynote-a18` | KEYNOTE-A18 — análise final de SG (ainda não publicada) | — | quando sair; hoje 2ª interina | 1B → 1A (com M1) |
| 13 | `colon-adj-fluoropirimidina-stageII` | corpo mais recente para adjuvância em EII de alto risco (Cochrane CD005390 é de 2008, sem grau) | — | revisão com GRADE, se o revisor indicar | 1B → 1A se corpo alta |
| 14 | `eso-def-crt-cisplatina-5fu` | meta-análise de QRT vs RT em esôfago (Cochrane Wong 2006 retirada; nenhuma na escada) | — | corpo, se o revisor indicar | 1B → 1A se corpo alta |

Sem pedido (dado completo ou juízo, não dado): FLOT4, CheckMate 577/649/025/9ER/214 int-alto, CLASSIC, NO16968, anti-EGFR (corpo), KEYNOTE-177,
SUNLIGHT, KEYNOTE-826, EMPOWER, GOG-240, TAGS, COUGAR-02/docetaxel (corpo), irinotecano (corpo), RTOG 85-01 (N pequeno), ASPEN (IC 80% por desenho),
DESTINY-Gastric01 e FOLFOXIRI (indiretas de juízo), pazopanibe (COMPARZ; SG final é carta), sunitinibe, ramucirumabe, bevacizumabe CRC/colo.

**Resolvidos pela calibração (não pedir mais):** CheckMate 214 ×2, 9ER, 025, METEOR, sunitinibe/IFN (C1/C4).
