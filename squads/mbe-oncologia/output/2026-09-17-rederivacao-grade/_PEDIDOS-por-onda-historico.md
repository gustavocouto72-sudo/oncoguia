# Pedidos de artigo — rodada de re-derivação GRADE (run 2026-09-17-rederivacao-grade)

Protocolo (adendo da direção, 2026-09-17): item aqui = a escada de APIs abertas não trouxe o dado; a direção
baixa o PDF e coloca em **`squads/mbe-oncologia/pipeline/data/artigos-fornecidos/<PMID>.pdf`** (pasta proposta;
gitignore a decidir — são PDFs de editor). A repescagem transcreve do PDF com
`fonte_transcricao = pdf_fornecido_revisor` e `proveniencia = "PDF fornecido pelo revisor metodológico, conferido
contra DOI <x>"`, e roda como passo próprio depois do piloto.

Legenda: **BLOQUEIA** = regime ficou `indeterminado` sem isso · **UPGRADE** = regime fechou (B/C) e o dado pode
subir a certeza · **PROPOSTA** = referência que não está no corpus; só faz sentido se o revisor aceitar em C7.

## Piloto renal — v2.1 (após C1–C8): 0 bloqueantes, 2 upgrades

| # | regime | estudo | DOI / PMID | o que falta | tipo | efeito esperado |
|---|---|---|---|---|---|---|
| 1 | `renal-met-intalto-axitinibe-pembrolizumabe` | KEYNOTE-426, 43 m (Eur Urol 2023) | 10.1016/j.eururo.2023.06.006 · PMID 37500340 | contagem de óbitos por braço (o abstract não traz taxas nem medianas → nada a deduzir) | UPGRADE | B → A |
| 2 | `renal-adj-pembrolizumab` | KEYNOTE-564, 57 m (NEJM 2024) | 10.1056/nejmoa2312695 · PMID 38631003 | nº de eventos de SLD por braço (o abstract só traz o HR 0,72; 0,59–0,87) | UPGRADE | B → A (se ≥ 300 eventos) |

Resolvidos pela calibração (não precisam mais de PDF): CheckMate 214 int/alto e favorável (C4 → Tannir 2024, abstract basta),
CheckMate 9ER (C4 → ESMO Open 2024; C1 deduz ≥ 326 óbitos das medianas), CheckMate 025 (C1 deduz ≈640 das taxas de 5 anos),
METEOR (C4 → final 2016; C1 deduz ≥ 329), KEYNOTE-564 (C4 → NEJM 2024), sunitinibe/IFN (C4 → JCO 2009), pazopanibe
(Sternberg 2010 entra como ADICIONAL — C7; a SG final do COMPARZ é carta sem abstract, não transcritível).

## Onda 1 — esôfago-estômago (rev. C9)

### A. Pivôs que NÃO sustentam — 4 regimes `indeterminado`

Separado em **FATO** (verificável na fonte, sem revisor) e **DECISÃO CLÍNICA** (qual ensaio passa a sustentar o regime — do revisor).

| regime | FATO (verificado na escada) | DECISÃO CLÍNICA (revisor) |
|---|---|---|
| `gastrico-met-1l-cisplatina-5fu` | O DOI gravado (10.1093/oxfordjournals.annonc.a010676, "doi_reparado" no corpus) resolve no Crossref/Europe PMC para **Glimelius 1996 — "advanced pancreatic and biliary cancer"**. O artigo que a citação descreve (Glimelius 1997, Ann Oncol 8:163) é **10.1023/a:1008243606668** (PMID 9093725): N=61, SG mediana 8 vs 5 m com **p=0,12**, sem HR/IC no abstract, QT = ELF / 5-FU-LV (**sem cisplatina**) | Corrigir o DOI é fato; escolher o pivô é decisão: (a) Cochrane CD004064 como corpo (QT vs BSC HR 0,3; 0,24–0,55, moderada — C9 → teto B) e/ou (b) REAL-2 (10.1056/nejmoa073149) como referência do braço cisplatina/5-FU |
| `gastrico-met-1l-folfox` | Al-Batran 2008 (10.1200/JCO.2007.13.9378): FLO vs FLP, N=220, **SLP 5,8 vs 3,9 m, p=0,077; SG "sem diferença significativa"; sem HR/IC** — negativo no primário | Adotar REAL-2 (NI oxaliplatina vs cisplatina, N=1.002) e/ou Cochrane CD004064 (oxaliplatina vs cisplatina HR 0,81; 0,67–0,98, baixa — C9 → teto C) |
| `gastrico-met-1l-capox` | idem; além disso a intervenção do ensaio (FLO = 5-FU infusional) **não contém capecitabina** | REAL-2 (braço EOX/capecitabina) e/ou Cochrane CD004064 (capecitabina vs 5-FU HR 0,94; 0,79–1,11, moderada — C9 → teto B) |
| `gastrico-met-2l-paclitaxel` | RAINBOW (10.1016/S1470-2045(14)70420-6) testa **ramucirumabe**; paclitaxel está **nos dois braços** — não há efeito do paclitaxel na fonte | WJOG4007 (10.1200/jco.2012.48.5805 · PMID 24190112, paclitaxel semanal vs irinotecano, N=223) e/ou Cochrane CD004063 (2ª linha vs BSC HR 0,81, alta — C9, corpo de classe) |

### B. Upgrades e PDF

| # | regime | estudo | DOI / PMID | o que falta | tipo | efeito esperado |
|---|---|---|---|---|---|---|
| 1 | `gastrico-met-her2-trastuzumabe-qt` | ToGA (Lancet 2010) | 10.1016/S0140-6736(10)61121-X · PMID 20728210 | contagem de óbitos por braço (dedução dá ≥ 292; limiar 300) | UPGRADE | B → A |
| 2 | `gastrico-adj-crt-5fu-lv` | INT0116 (Smalley 2012) | 10.1200/JCO.2011.36.7136 · PMID 22585691 | nº de óbitos por braço (texto PMC sem taxas/medianas) | UPGRADE | B → A |
| 3 | `gastrico-zolbetuximabe-nao-incorporado` | SPOTLIGHT (Lancet 2023) | 10.1016/S0140-6736(23)00620-7 · PMID 37068504 | nº de óbitos / medianas de SG — ou análise final de SG (ASCO 2024, não indexada) | UPGRADE | 2B → 2A |
| 4 | `eso-neoadj-crt-carbo-paclitaxel` | CROSS 10 anos (JCO 2021) | 10.1200/jco.20.03614 · PMID 33891478 | contagem de óbitos (dedução ≈ 251) — só muda se o referendo relaxar a convenção de efeito grande | UPGRADE (condicionado) | B → A |
| 5 | `gastrico-met-her2-pembro-tras-qt` | KEYNOTE-811 análise final — **carta NEJM 2024** | 10.1056/nejmc2408121 · PMID 39282917 | PDF da carta (SG final) — sem abstract | PDF (bloqueia o upgrade) | C → B |
| 6 | `eso-def-crt-cisplatina-5fu` | RTOG 85-01 — corpo (C9) | — | meta-análise de QRT vs RT em esôfago, se o revisor indicar uma (Cochrane Wong 2006 foi retirada; nenhuma localizada na escada) | DECISÃO C9 | B → A (se corpo com certeza alta) |

Sem pedido: FLOT4, CheckMate 577, CLASSIC, CheckMate 649 (A); irinotecano e docetaxel (C9 aplicada); DESTINY-Gastric01 (indireta de população é juízo); TAGS (A); ramucirumabe (dado completo; Cochrane sem HR do fármaco no abstract).

## Onda 2 — colorretal

### A. Pivôs sem efeito transcritível — 3 regimes `indeterminado`

| regime | FATO (verificado na escada) | DECISÃO CLÍNICA (revisor) |
|---|---|---|
| `retal-neoadj-crt-capecitabina` | Hofheinz 2012 (10.1016/S1470-2045(12)70116-X · PMID 22503032): abstract só com taxas por braço (SG 5 a 76% [67–82] vs 67% [58–74], NI p=0,0004; SLD 3 a 75% vs 67%, p=0,07) — **sem HR/IC** | nenhuma: **texto completo** (Lancet Oncol; 403 ao bot) — HR/IC de SG e SLD → provável B/A |
| `retal-tnt-folfox-capox` | OPRA (10.1200/JCO.23.01208 · PMID 37883738): fase 2 randomizado, **os dois braços são TNT** (indução vs consolidação); SLD 5 a 71% vs 69%, p=0,68; TME-free 39% vs 54% | qual pivô compara TNT com FOLFOX/CAPOX vs QRT padrão (RAPIDO — Bahadoer 2021 Lancet Oncol; Cochrane CD015590 é protocolo). OPRA fica como evidência de preservação de órgão |
| `crc-met-quimio-doublet` | de Gramont 2000 (10.1200/JCO.2000.18.16.2938 · PMID 10944126): SLP 9,0 vs 6,2 m (p=0,0003) **sem HR**; SG 16,2 vs 14,7 m **p=0,12** | regime de CLASSE: corpo para "doublet vs fluoropirimidina isolada" (meta-análise de oxaliplatina/irinotecano) ou pivôs por doublet (Saltz/Douillard 2000 para FOLFIRI; NO16966 para CAPOX vs FOLFOX) |

### B. Upgrades

| # | regime | estudo | DOI / PMID | o que falta | tipo | efeito esperado |
|---|---|---|---|---|---|---|
| 1 | `retal-tnt-folfirinox` | PRODIGE 23, 7 anos | 10.1016/j.annonc.2024.06.019 · PMID 38986769 | HR de SG/SLD e N por braço (abstract só traz RMST) | UPGRADE | B → B/A (depende do HR) |
| 2 | `crc-met-aflibercepte-nao-incorporado` | VELOUR primária | 10.1200/jco.2012.42.8201 · PMID 22949147 | N e óbitos por braço | UPGRADE | 2B → 2A |
| 3 | `crc-met-regorafenibe-nao-incorporado` | CORRECT | 10.1016/S0140-6736(12)61900-X · PMID 23177514 | versão madura (não localizada) — ou aceitar a interina com ≥ 381 óbitos | UPGRADE (decisão C4) | 2B → 2A |
| 4 | `colon-adj-fluoropirimidina-stageII` | Cochrane CD005390 (2008) | 10.1002/14651858.cd005390.pub2 | revisão com grau GRADE / corpo mais recente para adjuvância em EII de alto risco | DECISÃO C9 | B → A se corpo com certeza alta |

Sem pedido: NO16968 (A), anti-EGFR (A via corpo), KEYNOTE-177 (A), SUNLIGHT (A), TRIBE (indireta é juízo), bevacizumabe (corpo sem grau; dado completo).

<details><summary>v1 (histórico — 7 pedidos, antes da calibração)</summary>

## Piloto renal — 0 bloqueantes, 7 pedidos

| # | regime | estudo | DOI / PMID | o que falta | tipo | efeito esperado |
|---|---|---|---|---|---|---|
| 1 | `renal-met-intalto-ipilimumabe-nivolumabe` | CheckMate 214 (NEJM 2018) | 10.1056/NEJMoa1712126 · PMID 29562145 | nº de óbitos e IC **95%** da SG em int/alto (texto principal só dá IC 99,8%, 1ª interina) — **ou** o artigo de 8 anos (Tannir 2024, 10.1016/j.annonc.2024.07.727 · PMID 39098455) | UPGRADE (+ PROPOSTA) | B → A |
| 2 | `renal-met-favoravel-ipilimumabe-nivolumabe` | CheckMate 214 8 anos (Ann Oncol 2024) | 10.1016/j.annonc.2024.07.727 · PMID 39098455 | SG/SLP do subgrupo favorável com seguimento maduro (o corpus já cita Tannir 2024 na citação, sem DOI) | PROPOSTA | D → decisão C6; certeza provavelmente sobe a C/B |
| 3 | `renal-met-intalto-nivolumabe-cabozantinibe` | CheckMate 9ER (NEJM 2021) | 10.1056/NEJMoa2026982 · PMID 33657295 | nº de óbitos e IC 95% da SG (texto só traz IC 98,89%) — suplemento ou atualização | UPGRADE | B → A (com C1/C3) |
| 4 | `renal-met-2l-pos-vegfr-nivolumabe` | CheckMate 025 5 anos (Cancer 2020) | 10.1002/cncr.33033 · PMID 32673417 | contagem de óbitos por braço (o texto dá só probabilidades de SG; ≥ 600 dedutíveis) | UPGRADE | C → B (C1) → A (C1+C2) |
| 5 | `renal-met-2l-pos-io-cabozantinibe` | METEOR final (Lancet Oncol 2016) | 10.1016/s1470-2045(16)30107-3 · PMID 27279544 | SG madura (a fonte registrada é a interina com 202 óbitos) | PROPOSTA + UPGRADE | C → B |
| 6 | `renal-met-favoravel-pazopanibe` | Sternberg 2010 (JCO) — pazopanibe vs placebo | 10.1200/jco.2009.23.9764 · PMID 20100962 | eficácia absoluta do pazopanibe (o corpus só tem a não-inferioridade) | PROPOSTA | C → B (SLP vs placebo, efeito grande) |
| 7 | `renal-met-favoravel-sunitinibe` | Motzer 2009 (JCO) — SG final sunitinibe vs IFN | 10.1200/jco.2008.20.1293 · PMID 19487381 | SG (desfecho duro) do mesmo ensaio | PROPOSTA | B fica B (SG HR ≈ 0,82 cruza o nulo — ver auditoria caso 01) ou C; fecha a nota "SG não demonstrada" |

Sem pedido: `renal-adj-pembrolizumab` (A fechado; a SG de 2024 — 10.1056/nejmoa2312695 · PMID 38631003 — é
PROPOSTA opcional em C7), `renal-met-intalto-axitinibe-pembrolizumabe` (A; C4 é decisão, não dado),
`renal-naoclaras-sunitinibe-pazopanibe` (o IC 95% da SLP **não existe** no paper — desenho com IC 80%; nada a pedir).

</details>
