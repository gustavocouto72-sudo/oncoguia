# Onda 1 — ESÔFAGO-ESTÔMAGO (19 regimes) · tabela ANTES → DEPOIS

**Data:** 2026-09-17 (rev. C9) · **Regras:** schema 2 + C1–C9 · **Base "antes":** RUN_ATIVO `2026-09-17-intake-revisao-4/v1` ·
**Saída:** `onda-1-esofago-estomago/regimes-consolidados.json` (**não promovido**) · **Portão A:** passou, check [11] 19/19 (`portao-saida.txt`) ·
**DOIs:** 17 fontes + 8 adicionais resolvem no Crossref.

**Fontes abertas:** Crossref + Europe PMC (abstract) para os 17 DOIs registrados; busca C4 por versão madura de cada ensaio (6 achadas com
abstract: CROSS 10 anos, RTOG 85-01 5 anos, CLASSIC 5 anos, CheckMate 649 5 anos, GLOW, KEYNOTE-859; KEYNOTE-811 final é carta sem
abstract; DESTINY-Gastric01, SPOTLIGHT, CheckMate 577 sem versão madura publicada com abstract); textos PMC para INT0116 e CheckMate 649 (N do
CPS≥5). Respostas cruas em `fontes/` (`escada-saida.txt`, `escada-c4-saida.txt`). Toda transcrição é copiada do arquivo salvo por busca literal
(`rederivar_esofago_estomago.py`).

## Placar

| | antes | **depois** |
|---|---|---|
| 1A | **18** | **4** — FLOT4, adj nivolumabe (CheckMate 577), adj CAPOX (CLASSIC), IO+QT CPS≥10 (CheckMate 649) |
| 1B | 0 | **5** — CROSS, QRT definitiva (RTOG 85-01), INT0116, docetaxel 2L (C9: corpo Cochrane), ToGA |
| 2A | 0 | **1** — TAS-102 (não incorporado → contra) |
| 2B | 0 | **3** — ramucirumabe, zolbetuximabe (não incorporados → contra); irinotecano 2L (C9: corpo Cochrane) |
| 2C | 0 | **2** — pembro+trastuzumabe+QT (KEYNOTE-811), T-DXd 2L |
| indeterminado | 0 | **4** — cisplatina/5-FU 1L (Glimelius), FOLFOX 1L, CAPOX 1L (Al-Batran), paclitaxel 2L (RAINBOW) |

Certeza: **A=5 · B=8 · C=2 · indeterminado=4**. Sobrevivência como 1A: **4/18 (22%)**. Recomendação: forte a favor 9 · condicional a favor 3 ·
condicional **contra** 3 (os três não incorporados — regra 5).

O que derrubou os 1A, por causa raiz:
- **Pivô que não sustenta (4 → indeterminado):** DOI errado (Glimelius pâncreas/biliar em vez do gástrico, e o gástrico não tem
  cisplatina nem HR/IC), ensaio negativo no primário sem HR/IC (Al-Batran FLO vs FLP, usado por FOLFOX **e** CAPOX), e RAINBOW citado
  como base do paclitaxel isolado (paclitaxel está nos dois braços). São os modos de falha 3 e 4 da auditoria. Propostas C7 no
  `PEDIDOS-DE-ARTIGO.md` — decisão do revisor.
- **Não incorporado com "1A" (3 → 2A/2B):** TAS-102, ramucirumabe, zolbetuximabe — a letra fica (A/B/B), o número inverte a direção
  (regra 5 / D4).
- **Imprecisão por OIS (5 → 1B):** CROSS (≈251 óbitos deduzidos; RRR 30% mas IC sup 0,89 — **convenção**), RTOG 85-01 (N ≈ 120), INT0116
  (óbitos não dedutíveis), COUGAR-02 (161 óbitos), ToGA (≥ 292 dedutíveis — 8 abaixo do limiar).
- **Substituto/interina/população (2 → 2C):** KEYNOTE-811 (SLP; SG não significativa na 3ª interina), DESTINY-Gastric01 (fase 2 de 3ª
  linha+; ≥ 94 óbitos).
- **C9 (corpo de evidência) aplicada a 2:** irinotecano 2L (Cochrane CD004064, alta → B por indireta de linha; antes 2C pelo ensaio de N=40)
  e docetaxel 2L (Cochrane CD004063, alta → B por indireta de classe/sítio; COUGAR-02 concordante). RTOG 85-01 sem corpo localizável
  (Cochrane Wong 2006 retirada); ramucirumabe sem HR agregado do fármaco no abstract do Cochrane — ficam como estão.

## Tabela

| # | regime | antes | certeza | rec. | depois | domínio decisivo | fonte do card · trecho transcrito |
|---|---|---|---|---|---|---|---|
| 1 | `eso-perioperatorio-flot` — FLOT4 | 1A | **A** | forte · a favor | **1A** | nenhum: ≥ 358 óbitos (medianas atingidas), IC 0,63–0,94 | Lancet 2019 · "Overall survival was increased in the FLOT group compared with the ECF/ECX group (hazard ratio [HR] 0·77; 95% confidence interval [CI; 0.63 to 0·94]; median overall survival, 50 months … vs 35 months …)" |
| 2 | `eso-neoadj-crt-carbo-paclitaxel` — CROSS | 1A | **B** | forte · a favor | **1B** | imprecisão −1: ≈251 óbitos deduzidos (10 a: 38% × 178 + 25% × 188), RRR 30% mas IC sup 0,89 > 0,85 — **convenção do squad** | **JCO 2021, 10 anos** (C4) · "Patients receiving neoadjuvant chemoradiotherapy had better overall survival (hazard ratio [HR], 0.70; 95% CI, 0.55 to 0.89). … The absolute 10-year overall survival benefit was 13% (38% v 25%)." |
| 3 | `eso-def-crt-cisplatina-5fu` — RTOG 85-01 | 1A | **B** | forte · a favor | **1B** | imprecisão −1: N ≈ 120 (RT isolada 62), < 300 eventos; diferença absoluta 26% (IC 15–37%) | **JAMA 1999, 5 anos** (C4) · "at 5 years of follow-up the overall survival for combined therapy was 26% (95% confidence interval [CI], 15%-37%) compared with 0% following RT." |
| 4 | `gastrico-adj-nivolumabe` — CheckMate 577 | 1A | **A** | forte · a favor | **1A** | nenhum: SLD duro em adjuvância (C8), ≥ 397 eventos (medianas atingidas), IC 96,4% 0,56–0,86 (C3) | NEJM 2021 · "median disease-free survival was 22.4 months … as compared with 11.0 months … (hazard ratio for disease recurrence or death, 0.69; 96.4% CI, 0.56 to 0.86; P<0.001)." |
| 5 | `gastrico-adj-capox` — CLASSIC | 1A | **A** | forte · a favor | **1A** | nenhum: 342 eventos de SLD transcritos (139 + 203); SG também positiva (0,66; 0,51–0,85) | **Lancet Oncol 2014, 5 anos** (C4) · "139 (27%) patients had disease-free survival events … versus 203 (39%) … (stratified hazard ratio [HR] 0·58, 95% CI 0·47-0·72; p<0·0001)." |
| 6 | `gastrico-adj-crt-5fu-lv` — INT0116 | 1A | **B** | forte · a favor | **1B** | imprecisão −1: RRR 24%, óbitos não transcritos nem dedutíveis (abstract e texto PMC sem taxas/medianas) → *upgrade* | JCO 2012 (10 anos) · "The hazard ratio (HR) for OS is 1.32 (95% CI, 1.10 to 1.60; P = .0046). The HR for RFS is 1.51 (95% CI, 1.25 to 1.83; P < .001)." (HR = observação vs QRT) |
| 7 | `gastrico-met-1l-cisplatina-5fu` — "Glimelius" | 1A | **indet.** | — | **—** | **DOI registrado resolve para outro ensaio** (Glimelius 1996, pâncreas/biliar); o gástrico (1997, N=61) não tem HR/IC, SG p=0,12, e a QT (ELF/5-FU-LV) não contém cisplatina | fonte registrada (errada) · propostas: Glimelius 1997 correto, Cochrane CD004064 (QT vs BSC HR 0,3, moderada), REAL-2 |
| 8 | `gastrico-met-1l-folfox` — Al-Batran 2008 | 1A | **indet.** | — | **—** | **pivô negativo no primário** e sem HR/IC (SLP 5,8 vs 3,9 m, p=0,077; SG NS) — caso 07 da auditoria | proposta: REAL-2 (NI oxaliplatina/capecitabina, N=1.002); Cochrane: oxaliplatina vs cisplatina HR 0,81 (baixa) |
| 9 | `gastrico-met-1l-capox` — Al-Batran 2008 | 1A | **indet.** | — | **—** | idem + a intervenção do ensaio (FLO) **não contém capecitabina** | idem; Cochrane: capecitabina vs 5-FU HR 0,94 (moderada) |
| 10 | `gastrico-met-2l-paclitaxel` — RAINBOW | 1A | **indet.** | — | **—** | **paclitaxel está nos dois braços** — a fonte não tem efeito do paclitaxel | proposta: WJOG4007 (paclitaxel vs irinotecano, N=223); Cochrane CD004063 (2ª linha vs BSC HR 0,81, alta) |
| 11 | `gastrico-met-2l-irinotecano-folfiri` — **C9: Cochrane CD004064** (+Thuss-Patience adicional) | 1A | **B** | condicional · a favor | **2B** | indireta −1: corpo é "com vs sem irinotecano", majoritariamente 1ª linha/combinações; regime é 2ª linha. Teto do corpo: alta | **Cochrane 2017** · "Irinotecan extends OS slightly (by an additional 1.6 months) versus non-irinotecan-containing regimens (HR 0.87, 95% CI 0.80 to 0.95, 2135 participants, 10 studies, high-quality evidence)." |
| 12 | `gastrico-met-docetaxel` — **C9: Cochrane CD004063** (+COUGAR-02 adicional) | 1A | **B** | forte · a favor (MCBS n/a justificado) | **1B** | indireta −1: corpo de classe (QT e/ou alvo vs BSC) em esôfago/JEG; COUGAR-02 (0,67; 161 óbitos) concordante e incluído. **Sem a indireta de classe seria A** — item de referendo | **Cochrane 2017** · "Five studies in 750 participants … palliative chemotherapy and/or targeted therapy compared to best supportive care (HR 0.81, 95% CI 0.71 to 0.92, high-quality evidence). Subcomparisons including only people receiving second-line therapies, chemotherapies, … all showed a similar benefit." |
| 13 | `gastrico-met-1l-io-qt-cps` — CheckMate 649 | 1A | **A** | forte · a favor | **1A** | nenhum: ≈850 óbitos deduzidos (5 a: 16% × 473 + 6% × 482; N do CPS≥5 no texto PMC de 2021); pembrolizumabe sustentado por KEYNOTE-859 (adicional) | **Ann Oncol 2026, 5 anos** (C4) · "the OS benefit [hazard ratio (HR) 0.71, 95% confidence interval (CI) 0.61-0.81] … in patients with PD-L1 CPS ≥5 were sustained. Five-year OS and PFS rates were 16% versus 6% …" |
| 14 | `gastrico-met-her2-trastuzumabe-qt` — ToGA | 1A | **B** | forte · a favor | **1B** | imprecisão −1: ≥ 292 óbitos dedutíveis (limite inferior, 8 abaixo de 300); RRR 26% → *upgrade* com a contagem real | Lancet 2010 · "Median overall survival was 13.8 months … compared with 11.1 months … (hazard ratio 0.74; 95% CI 0.60-0.91; p=0.0046)." |
| 15 | `gastrico-met-her2-pembro-tras-qt` — KEYNOTE-811 | 1A | **C** | condicional · a favor | **2C** | indireta −1 (SLP substituto; SG HR 0,84; 0,70–1,01 NS) + imprecisão −1 (3ª interina; final é carta sem abstract) | Lancet 2023 · "median progression-free survival was 10·0 months … versus 8·1 months … (HR 0·73 [0·61-0·87]), and median overall survival was 20·0 months … versus 16·8 months … (HR 0·84 [0·70-1·01]), but did not meet prespecified criteria for significance" |
| 16 | `gastrico-met-her2-2l-tdxd` — DESTINY-Gastric01 | 1A | **C** | condicional · a favor | **2C** | C5: fase 2 randomizado parte de A; indireta −1 (população ≥ 2 linhas, asiática; regime 2ª linha) + imprecisão −1 (≥ 94 óbitos; interina de SG) | NEJM 2020 · "Overall survival was longer with trastuzumab deruxtecan than with chemotherapy (median, 12.5 vs. 8.4 months; hazard ratio for death, 0.59; 95% confidence interval, 0.39 to 0.88;" |
| 17 | `gastrico-tas102-nao-rotineiro` — TAGS | 1B | **A** | condicional · **contra** | **2A** | nenhum rebaixado: RRR 31% com IC sup 0,85 = efeito grande (**convenção**). Não incorporado rotineiro → contra (regra 5) | Lancet Oncol 2018 · "Median overall survival was 5·7 months … and 3·6 months … (hazard ratio 0·69 [95% CI 0·56-0·85]; one-sided p=0·00029, two-sided p=0·00058)." |
| 18 | `gastrico-ramucirumabe-nao-incorporado` — RAINBOW (+REGARD) | 1A | **B** | condicional · **contra** | **2B** | imprecisão −1: IC sup 0,962 > 0,95 (regra 4); ≥ 333 óbitos. Não incorporado → contra | Lancet Oncol 2014 · "Overall survival was significantly longer in the ramucirumab plus paclitaxel group … (median 9·6 months … vs 7·4 months …, hazard ratio 0·807 [95% CI 0·678-0·962]; p=0·017)." |
| 19 | `gastrico-zolbetuximabe-nao-incorporado` — SPOTLIGHT (+GLOW) | 1A | **B** | condicional · **contra** | **2B** | imprecisão −1: RRR 25%, óbitos não dedutíveis (abstract sem medianas de SG) → *upgrade*. Não incorporado → contra | Lancet 2023 · "Zolbetuximab treatment also showed a significant reduction in the risk of death versus placebo (HR 0·75, 95% CI 0·60-0·94; p=0·0053)." |

## Triangulação Cochrane (só leitura)

Revisões achadas (Europe PMC, abstracts em `fontes/`): **CD004064.pub4** (Wagner 2017, QT em gástrico avançado), **CD004063.pub4**
(Janmaat 2017, paliativa em esôfago/JEG), **CD008107.pub2** (Ronellenfitsch 2013, perioperatória vs cirurgia — sem grau GRADE no abstract),
**CD011461.pub2** (Diaz 2016, terapia-alvo 1ª linha — anterior a zolbetuximabe). Sem Cochrane para: QRT neoadjuvante/definitiva de esôfago,
adjuvância gástrica (CLASSIC/INT0116), IO, HER2, T-DXd, TAS-102 (a revisão de 2025 sobre ICI em esôfago é protocolo).

| regime | onda 1 | Cochrane (comparação · certeza) | leitura |
|---|---|---|---|
| cisplatina/5-FU 1L | indet. (pivô) | CD004064: QT vs BSC HR 0,3 (0,24–0,55) **moderada**; combinação vs monoterapia HR 0,84 **moderada** | o Cochrane sustenta a *classe* (QT 1L); o corpus citou o ensaio errado. Com CD004064 como adicional → B |
| FOLFOX / CAPOX 1L | indet. (pivô) | CD004064: oxaliplatina vs cisplatina HR 0,81 (0,67–0,98) **baixa**; capecitabina vs 5-FU HR 0,94 (0,79–1,11) **moderada** | converge com "equivalência", não com 1A: a certeza do Cochrane para a troca oxaliplatina/capecitabina é baixa/moderada |
| irinotecano 2L | **B** (C9) | CD004064: regimes com irinotecano HR 0,87 (0,80–0,95) **alta** (10 estudos, 2.135 pts) | **resolvido por C9**: o corpo é agora a fonte do card; fica B pela indireta de linha (corpo de 1ª linha → regime de 2ª) |
| docetaxel 2L | **B** (C9) | CD004063: 2ª linha vs BSC HR 0,81 (0,71–0,92) **alta**; CD004064: regimes com docetaxel HR 0,86 **alta** | **resolvido por C9**: corpo é a fonte; fica B pela indireta de classe/sítio. Se o referendo aceitar corpo de classe para o agente → A |
| paclitaxel 2L | indet. (pivô) | CD004063: 2ª linha vs BSC HR 0,81 (0,71–0,92) **alta** | sustenta "tratar em 2ª linha"; não sustenta paclitaxel especificamente |
| ramucirumabe | B | CD004063: "único agente individual com benefício replicado em SG e SLP" (agente adicional HR 0,75, **alta**) | **diverge para cima** em certeza; o Cochrane não opina sobre incorporação (a direção *contra* é política, MCBS 2) |
| FLOT (perioperatório) | A | CD008107: QT perioperatória vs cirurgia HR 0,81 (0,73–0,89), sem grau no abstract | concordante em direção; comparação diferente (vs cirurgia, não vs ECF) |
| zolbetuximabe | B | CD011461 (2016): terapia-alvo 1L HR 0,92 (0,80–1,05) **baixa** — pré-zolbetuximabe | não comparável (agentes anteriores) |

Síntese (após C9): 5 convergências, 1 divergência para cima (ramucirumabe — o abstract do Cochrane não traz HR agregado do fármaco,
só a afirmação de replicação; C9 não se aplica sem efeito transcritível). Nenhuma divergência para baixo.

## Para o referendo (acumula no lote)

1. **4 indeterminados por pivô que não sustenta** — decisão do revisor sobre as referências adicionais propostas (REAL-2, WJOG4007,
   Glimelius 1997 correto, Cochrane). Se aceitas, FOLFOX/CAPOX tendem a B (NI + Cochrane baixa/moderada); cisplatina/5-FU a B; paclitaxel a B.
2. **Convenção de efeito grande** decidiu 3 casos: CROSS (B, IC sup 0,89), TAGS (A, IC sup 0,85 exato) e COUGAR-02 (B).
3. **ToGA em B por 8 eventos** dedutíveis abaixo de 300 — *upgrade* certo com a contagem do texto completo.
4. **KEYNOTE-811 2C**: a SG final (carta NEJM 2024) só entra por PDF fornecido.
5. **T-DXd 2C**: a indireta de população (3ª linha+ → 2ª linha) é juízo; sem ela, B.
6. **Direção "contra" nos 3 não incorporados** (TAS-102 2A, ramucirumabe 2B, zolbetuximabe 2B) — é D4 aplicada; a letra continua alta.
