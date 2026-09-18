# Auditoria GRADE — corpus `2026-09-16-drivers-pulmao/v1` (301 regimes)

**Data:** 2026-09-17 · **Natureza:** somente leitura (nada em corpus, app, banco ou git foi alterado) ·
**Encomenda:** revisor + direção, suspeita de GRADE inflado (muitos 1A, inclusive em não-incorporados por custo).
**Status:** relatório entregue; a re-derivação em lote é rodada própria, com referendo do revisor.

Reprodutibilidade: `python3 -c` sobre `regimes-consolidados.json` do RUN_ATIVO; amostra =
`random.Random(20260917).sample(sorted(ids_1A), 15)` (Python 3.9.6) — lista em `amostra-1A-seed-20260917.json`.

---

## Resumo executivo

1. **A suspeita procede.** 1A é o valor de **177/301 regimes (59%)** — 65% dos que têm valor. Mama, único tumor feito no lote de 07-18 com justificativas completas (mediana 46 palavras), tem **30% de 1A**; os 24 tumores do lote de 07-21 (justificativas de 14–19 palavras) têm **65–95%**. A diferença é de método, não de biologia.
2. **Não houve regra: houve um atalho.** O framework do squad é razoável no papel (ponto de partida RCT=alta, 5 domínios de rebaixamento, fichas de indireta e imprecisão com OIS/300 eventos). Mas nas 177 justificativas 1A **nenhuma** usa as palavras "rebaixar", "imprecisão", "substituto"; só 4 citam IC; 2 citam "indireta" (e mantêm 1A). O padrão real foi: *"fase 3 + ganho de SG → 1A"*. E 299/301 regimes têm `afirmado_protocolo.grade = null` — o "verificador adversarial" nunca teve o que confrontar; o GRADE é 100% derivação própria do modelo.
3. **O número (força) está sendo usado como "qualidade do ensaio", não como força de recomendação.** 51 regimes não-incorporados: 20 são 1A (7 com custo/ICER no motivo). 11 regimes 1A têm ESMO-MCBS 1–2 (três com MCBS **1**: bevacizumabe, aflibercepte, regorafenibe em CRC). Pazopanibe (PALETTE) é "fortemente contra" no protocolo e exibe **GRADE 1A** na tela — a notação `1A` não tem direção.
4. **Amostra de 15 (semente 20260917): 7 sobrevivem como 1A (47%), 2 são limítrofes (1A só citando corpo de evidência que não está na fonte), 6 caem (40%).** Das 6 quedas, 3 são de *força* (certeza A correta, mas o "1" contradiz a decisão institucional ou inverte a direção) e 3 de *certeza* (imprecisão, indireta, pivô citado negativo no desfecho primário).
5. **Extrapolando** 47–60% de sobrevivência sobre os 177: **~85–105 regimes 1A**, isto é, **28–35% do corpus** — exatamente a faixa da mama (30%), o tumor feito pelo método completo. É uma triangulação, não uma prova; a prova é a re-derivação.
6. **Consequência prática de re-derivar:** `valor_rederivado` entra no `content_hash` (app/build-data.py:217) → todo parecer gravado sobre o hash antigo expira para `pendente_re_revisao`. Hoje 133 regimes têm aprovação registrada no corpus, **98 deles 1A**. A rodada precisa de um desenho de referendo em lote (seção 4.3), senão devolve ~100 protocolos à fila como se fossem revisões novas.

---

## 1. Como o GRADE foi derivado

**Trilha:** `agents/extrator/tasks/extrair-regimes.md` (transcreve `afirmado_protocolo` do PDF — que quase nunca gradua) → `agents/verificador-evidencia/tasks/rederivar-grade.md` (step 03, "Gael GRADE", modelo `powerful`, subagente) → `consolidar.md` (só mapeia `{status, valor, justificativa, fonte}`; não recalcula nada).

**O que a task manda fazer** (item 3): "Avaliar desenho, risco de viés, consistência, precisão (IC) e magnitude; derivar qualidade (A/B/C) e força (1/2)". **O que ela não exige:** um veredito por domínio, o desfecho crítico avaliado, número de eventos/IC transcritos, nem qualquer regra que ligue força a benefício/custo/incorporação. O output é um campo livre `valor_rederivado` + `justificativa` de 1–3 frases. Sem checklist obrigatório, o modelo escolheu o caminho curto.

**O que os dados mostram** (177 justificativas 1A):

| cheiro | ocorrências |
|---|---|
| "fase III/3" | 144 |
| menciona SG/OS | 113 |
| menciona SLP/PFS | 39 |
| "aberto/open-label" | 8 (nenhum rebaixa por isso) |
| cita IC | 4 |
| "indireta" | 2 (ambos mantêm 1A) |
| "rebaix", "imprecis", "substitut/surrogate" | **0** |
| fase II | 4 (1A com fase II) |

**Origem histórica:** os valores atuais são os do run `2026-07-22-refeito-completo`, cujo `state.json` declara método *"conversor (critérios→regra)"* para 23 tumores e *"v2 + elegibilidade computável do run 07-18"* para mama — ou seja, o 07-22 **herdou** o GRADE dos runs 07-18 (mama) e 07-21 (demais) e só reconverteu elegibilidade. O 07-21 é o batch rejeitado — rejeitado por outros motivos, mas o GRADE dele sobreviveu à rejeição. Os intakes de 08-18 → 09-16 não tocaram o eixo em lote.

**Framework operacional** (`pipeline/data/grade-framework.md`): correto mas raso — 20 linhas, "casos limítrofes vão ao Tumor Board". As fichas `mbe-grade-certeza.md`, `mbe-indirectness.md`, `mbe-magnitude-precisao.md` são boas e **não são input declarado** da task `rederivar-grade` (que só lista `grade-framework.md` e `fontes-confiaveis.md`).

## 2. Distribuição atual

| valor | n | % de 301 |
|---|---|---|
| **1A** | **177** | **59%** |
| 1B | 51 | 17% |
| 2B | 28 | 9% |
| 2C | 13 | 4% |
| só letra (A/B/C) | 4 | 1% |
| vazio/None | 28 | 9% |

Status: `re_derivado` 263 · `indeterminado` 37 · `concorda` 1. `afirmado_protocolo.grade` ≠ null: **2 de 301**.

**1A por tumor:** esôfago-estômago 18/19 (95%), colorretal 12/13 (92%), colo de útero 7/8, renal 8/10, cabeça-pescoço 14/18, ovário 10/13 … **mama 19/64 (30%)**, testículo 3/7, pênis 0/7, vulva 0/2.

**1A por cenário:** adjuvância 33/46 (72%), metastático 111/198 (56%), localmente avançado 19/28, neoadjuvância 13/26.

**Contradições internas (sem abrir nenhuma fonte):**
- 1A com ESMO-MCBS ≤ 2: **11** — `crc-met-bevacizumabe-1l` (MCBS 1), `crc-met-aflibercepte` (1), `crc-met-regorafenibe` (1), `gastrico-ramucirumabe` (2), `ovario-niraparibe` (2), `ovario-carbo-gem-bevacizumabe` (2), `pancreas-adj-gem-cape` (2), `sarcoma-pm-pazopanibe` (2), `biliares-2l-folfox` (2), `biliares-durvalumab-gemcis` (2), `nsclc-met-atezo-bev` (2-3). Recomendação **forte** para benefício que a própria escala de magnitude classifica como irrelevante.
- 1A com desfecho principal só SLP (sem SG no desfecho): **8** — inclui `renal-met-favoravel-sunitinibe`, `renal-met-favoravel-pazopanibe` (não-inferioridade), `net-baixograu-analogo-somatostatina`, `cp-tireoide-diferenciado-lenvatinibe`. Substituto sem rebaixamento.
- Não-incorporados (regra da app: `incorporacao.status`, flag `nao_*`, sufixo de id): **51**, dos quais **1A = 20**, 1B = 13. Com "custo/ICER/CONITEC/QALY" no motivo: 10 (7 são 1A).

## 3. Amostra sorteada — 15 regimes 1A reavaliados

Método: certeza **por desfecho crítico** (RCT parte de Alta; −1/−2 por risco de viés, inconsistência, indireta, imprecisão, viés de publicação); força = balanço benefício×dano, certeza, valores, custo **e o que a instituição de fato recomenda** (direção incluída). Referência: fichas do próprio squad + GRADE handbook (OIS/300 eventos; não rebaixar por OIS quando IC exclui nulo e RRR grande).

| # | regime | pivô citado | domínios que pesam | certeza | força (institucional) | veredito |
|---|---|---|---|---|---|---|
| 01 | `renal-met-favoravel-sunitinibe` | Motzer 2007 (sunitinibe vs IFN-α, N=750, aberto) | primário SLP (substituto); SG HR 0,82 IC 0,67–1,00 cruza nulo (−1 imprecisão); comparador IFN obsoleto e população toda-risco (−1 indireta); "estudo" cita "COMPARZ", que é outro ensaio | SLP B / SG C | escolha vs IO-TKI é sensível a preferência → **2** | **cai → 2B** |
| 02 | `cp-cec-met-1l-pembrolizumabe-qt-cps1` | KEYNOTE-048 (N=882) | SG 13,6 vs 10,4 m, HR 0,65 (0,53–0,80) em CPS≥1 pré-especificado; desfecho duro, eventos suficientes | **A** | MCBS 4, padrão → **1** | **sobrevive** |
| 03 | `sarcoma-pm-pazopanibe-nao-incorporado` | PALETTE (duplo-cego, N=369) | SLP HR 0,31 (A); SG HR 0,86 IC 0,67–1,11 (−1 imprecisão) | SG **B** | protocolo é **fortemente CONTRA** — "1A" na tela lê "forte a favor, alta" | **cai** — direção invertida pela notação |
| 04 | `hcc-1l-tremelimumabe-durvalumabe` | HIMALAYA (N=1.171, aberto) | SG HR 0,78 (0,65–0,93), mantido a 4 anos | **A** | protocolo: "restrito, prefere IMBRAVE, câmara técnica" = condicional → **2** | **cai → 2A** (letra sobrevive) |
| 05 | `gastrico-met-docetaxel` | COUGAR-02 (N=168, aberto) | SG HR 0,67 (0,49–0,92); <300 eventos (−1 imprecisão) **se avaliado sozinho**; consistente com Kang 2012 (N=202, HR 0,66) e meta-análise — corpo de evidência sustenta A, mas o corpo não está na fonte | B isolado / A corpo | **1** | **limítrofe** — 1B como derivado; 1A só reescrevendo a fonte |
| 06 | `prostata-mcrpc-1l-docetaxel-prednisona` | TAX 327 (N=1.006) | SG HR 0,76 (0,62–0,94), >300 eventos, replicado (SWOG 9916) | **A** | **1** | **sobrevive** |
| 07 | `gastrico-met-1l-capox` | Al-Batran 2008 (FLO vs FLP, N=220) | **pivô citado é negativo no desfecho primário** (SLP 5,8 vs 3,9 m, p=0,077; SG NS). A base real de CAPOX é não-inferioridade (REAL-2, N=1.002) — aberto, margem de NI (−1) | **B** (com referência trocada) | opção equivalente → 1 | **cai → 1B** + referência errada |
| 08 | `anal-crt-mitomicina-5fu` | ACT II / RTOG 98-11 | QRT vs RT: ACT I (N=585) + EORTC 22861 → controle local/colostomia (desfecho importante) A. **Mas** a justificativa afirma "mitomicina superior à cisplatina": ACT II (N=940) mostrou RC 90,5 vs 89,6% (sem diferença); RTOG 98-11 é confundido por indução | **A** para o regime | **1** | **sobrevive com justificativa corrigida** |
| 09 | `cp-naso-inducao-cisplatina-gemcitabina` | Zhang NEJM 2019 (N=480, aberto) | SLR HR 0,51 (0,34–0,77), SG HR 0,43 (0,24–0,77); <300 eventos mas RRR grande e IC exclui nulo (sem rebaixar por OIS); população endêmica (China) → indireta −0/−1 para não-endêmico; consistente com MAC-NPC | **A** (nota de indireta) | **1** | **sobrevive** com nota |
| 10 | `mama-met-hrpos-1l-ia-cdk46` | MONALEESA-2 (duplo-cego, N=668) | SLP HR 0,57; SG HR 0,76 (0,63–0,93); classe consistente em SLP; SG só riboci/abema (PALOMA-2 NS) — regime "classe" mistura evidência de SG heterogênea (MCBS já separa) | **A** (riboci/abema) | **1** | **sobrevive** com ressalva palbociclibe |
| 11 | `pancreas-met-nabpac-gem-nao-incorporado` | MPACT (N=861, aberto) | SG HR 0,72 (0,62–0,83), >300 eventos | **A** vs gemcitabina | instituição **não incorpora** (preferência FOLFIRINOX) — "1" não é a recomendação da instituição; a flag admite "padrão para inelegíveis a FOLFIRINOX" | **cai** — letra A correta, número não |
| 12 | `mama-adj-her2neg-tc` | US Oncology 9735 (N=1.016, aberto) | SLD HR 0,74 (0,56–0,98), SG HR 0,69 (0,50–0,97): limites superiores encostam em 1, <300 eventos (−1 imprecisão); **inconsistência** com ABC trials (Blum 2017: TC×6 inferior a taxano+AC, HR 1,23, NI não demonstrada) (−1); `elegibilidade_protocolo` vazia — sem restrição de risco | **B** | 1 em baixo risco / 2 em alto risco | **cai → 1B** (2B em N+) |
| 13 | `pancreas-met-mfolfirinox` | PRODIGE 4 (N=342, aberto) | SG HR 0,57 (0,45–0,73), RRR 43%, IC estreito (sem rebaixar por OIS); **indireta de intervenção**: ensaio testou FOLFIRINOX pleno (bolus 5-FU, irinotecano 180) — corpus grava mFOLFIRINOX (sem bolus, 150); evidência do "m" é fase II/retrospectiva | **A** (−0) ou B (−1) | **1** | **sobrevive** com nota de intervenção |
| 14 | `ovario-recidiva-platina-sensivel-doublet` | CALYPSO / "MITO-8" | CALYPSO é NI carbo+PLD vs carbo+pac (SLP; SG igual) — **não sustenta** "doublet é padrão"; quem sustenta é ICON4/AGO-OVAR 2.2 (N=802, SG HR 0,82 IC 0,69–0,97) + Cochrane 2013; MITO-8 é sobre não-platina em parcialmente sensível | **A** (com referência corrigida) | **1** | **sobrevive com referência corrigida** |
| 15 | `eso-def-crt-cisplatina-5fu` | RTOG 85-01 (N=123 randomizados) | interrompido precocemente por benefício (RoB −1), <300 eventos (−1), comparador RT 64 Gy vs 50 Gy; efeito muito grande (SG 5a 26% vs 0%) mitiga; Cochrane (Wong 2006) sustenta A | B isolado / A corpo | **1** | **limítrofe** — 1B como derivado |

**Placar:** sobrevivem limpos **4** (02, 06, 10, 13) · sobrevivem com correção de justificativa/referência **3** (08, 09, 14) · limítrofes **2** (05, 15) · caem **6** (01, 03, 04, 07, 11, 12).
**Sobrevivência como 1A: 7/15 (47%)**; 9/15 (60%) se os limítrofes forem resolvidos citando o corpo de evidência.

**Modos de falha (o que a re-derivação precisa capturar):**
- **Força ≠ decisão institucional / sem direção** (03, 04, 11): a letra está certa, o número mente. É o modo que produz "1A em não-incorporado".
- **Certeza sem os domínios** (01, 12): substituto e imprecisão ignorados; inconsistência com ensaio posterior ignorada.
- **Referência que não sustenta a afirmação** (07, 14; parcialmente 01, 08): pivô negativo no primário, ou ensaio de comparação de esquema usado como se fosse "vs padrão". O Portão A checa se o DOI *resolve*, não se ele *sustenta*.
- **Corpo de evidência não citado** (05, 15): o valor pode até estar certo, mas a fonte registrada não o prova — para um auditor externo, é 1B.

## 4. Proposta

### 4.1 Re-derivação em lote — o que muda no método

**a) Schema do eixo `grade` deixa de ser um campo livre.** Proposta (compatível: `valor_rederivado` continua existindo, derivado):

```json
"grade": {
  "desfecho_critico": "SG",                         // SG | SLD/iDFS | controle local | RC patológica | SLP (substituto) | …
  "desenho": "RCT fase 3 aberto, N=861",
  "efeito": {"medida":"HR","valor":0.72,"ic95":[0.62,0.83],"eventos":"~700"},
  "dominios": {                                     // 0 | -1 | -2, cada um com 1 frase
    "risco_vies":     {"nota":0,  "por":"aberto, mas desfecho duro (SG)"},
    "inconsistencia": {"nota":0,  "por":"ensaio único; sem contradição posterior"},
    "indireta":       {"nota":0,  "por":"população = protocolo; comparador (gem) era padrão em 2013"},
    "imprecisao":     {"nota":0,  "por":">300 eventos; IC exclui nulo com folga"},
    "vies_publicacao":{"nota":0,  "por":"—"}
  },
  "certeza": "A",                                   // A | B | C | D (muito baixa)
  "recomendacao": {"forca":"condicional","direcao":"contra","base":"não incorporado: preferência institucional por FOLFIRINOX; padrão para inelegíveis"},
  "valor_rederivado": "2A",                          // compat — derivado de certeza + força; NÃO exibir como valor principal
  "status": "re_derivado", "justificativa": "…", "fonte": "https://doi.org/…"
}
```

**b) Regras determinísticas (entram no `verificar_dados.py`, Portão A — o modelo preenche, o script barra):**
1. `certeza = A` exige: RCT **e** desfecho crítico duro (SG, SLD/iDFS, controle local, mortalidade) ou substituto validado com nota **e** IC exclui nulo **e** (eventos ≥ 300 **ou** RRR ≥ 30% com IC estreito) **e** nenhum domínio em −1 sem contrapartida declarada.
2. Desfecho crítico = SLP/ORR sem SG demonstrada → teto **B** (indireta por substituto), salvo justificativa explícita (ex.: crossover documentado).
3. Fase II / braço único / basket → parte de **C**; nunca A.
4. Imprecisão automática: HR com limite superior > 0,95, ou eventos < 300 sem efeito grande → −1 obrigatório.
5. **Força `forte` a favor exige:** certeza ≥ B **e** MCBS ≥ 3 (paliativo) ou ≥ B (curativo) — ou MCBS `n/a` com justificativa **e** regime **incorporado**. Regime não-incorporado → `direcao = contra` (forte ou condicional); nunca "1 a favor".
6. Referência tem de **sustentar**: intervenção do pivô ⊇ `farmacos[]` do regime e comparador = padrão da época; pivô negativo no primário → flag `pivo_nao_sustenta` e certeza ≤ B até trocar a referência.
7. Fichas `mbe-grade-certeza`, `mbe-indirectness`, `mbe-magnitude-precisao` viram **input declarado** da task; e o abstract do Europe PMC (N, HR, IC, desfecho primário) tem de ser **transcrito** em `efeito` — sem transcrição, `indeterminado`.

**c) Escopo:** os **301**, não só os 177 — 1B/2B também podem estar errados nas duas direções, e as regras 5–6 mudam não-incorporados de qualquer valor. Prioridade de execução: (i) 51 não-incorporados, (ii) 177 1A, (iii) resto. Por tumor, modelo `powerful`, escada de APIs do squad.

**d) Saída da rodada:** run novo em `output/` (não promove `RUN_ATIVO` sozinho) + `relatorio-rederivacao-grade.md` com tabela **antes → depois** por regime (valor antigo, certeza/força/direção novos, domínio decisivo) — é isso que o revisor referenda.

### 4.2 Hierarquia de selos na tela

Hoje (`selosLine` em app/index.html:5115 e `flowLeaf` em :5311) os três badges têm o mesmo peso (10px), na ordem GRADE → MCBS → Custo, e o GRADE aparece como `1A`. Proposta:

```
┌ regime ─────────────────────────────────────────────────────────┐
│ Nab-paclitaxel + Gemcitabina                                     │
│ ┌──────────────┐                                                 │
│ │ ESMO-MCBS 4  │  ← central, 13px, cor por faixa (4–5/A–B ·    │
│ └──────────────┘    3/C · 1–2 · n/a com o porquê no tooltip)     │
│ certeza A · recomendação: condicional contra (política           │
│ institucional)   ·   custo 4/5   ·   não incorporado             │
│ ↑ linha secundária, 11px, cinza — GRADE em palavras, não "2A"    │
└──────────────────────────────────────────────────────────────────┘
```

- **MCBS central e maior** (é a magnitude que o oncologista decide por). Normalizar o valor: hoje há 10+ formatos (`"4 (ribociclibe/abemaciclibe); 3 (palbociclibe)"`, `"A (curativo)"`, `"2-3"`, `"n/a (não-inferioridade…)"`). Proposta: `esmo_mcbs = {escala: "curativo"|"paliativo", valor, nota}` — o build-data pode derivar isso do texto atual sem tocar o corpus na primeira passada.
- **GRADE em palavras** ("certeza A · rec. forte a favor"), menor. A notação `1A` só no apêndice/export. Motivo: `1A` esconde a direção (caso PALETTE) e o leitor lê "1" como "primeira linha".
- **Custo e disponibilidade** no mesmo tamanho pequeno; "não incorporado" continua como pílula própria (`incPillHtml`).
- Fluxograma (`flowLeaf`): mesma ordem; o `fl-badges` já tem os três — só reordena e redimensiona.

### 4.3 Motivo de não-incorporação por alçada

Hoje o motivo (`INCORP_MOTIVO_META`: refutado / indisponível / evidência insuficiente / custo) e o **texto livre** — inclusive "~R$ 643 mil/QALY", "ICER desfavorável" — aparecem para quem vê o card (oncologista, revisor, auditor, admin). Gestor **não vê** o card (`podeVerClinico()` exclui gestor).

Proposta:
- **Oncologista / auditor:** "🚫 Não incorporado — **política institucional**". Se o motivo for clínico (`refutado`, `evidencia_insuficiente`), mostrar também o fato clínico ("estudo negativo em SG") — é informação que muda a conduta, não é segredo.
- **Revisor / admin:** tudo (já é quem decide).
- **Gestor:** motivo real (custo, ICER, CONITEC) — numa lista **"Não incorporados"** somente leitura dentro de Recursos, ou aba própria; hoje não existe superfície.
- **Onde cortar:** no servidor, em `/api/evidencia`, por **perfil ativo do token** — mesmo padrão da secretaria ("payload reduzido = corte no SELECT", não `display:none`). Campos: `incorporacao.motivo`, `incorporacao.nota_revisao`, flags `nao_incorporado:*` e `nccn_affordability.justificativa` quando contêm custo.
- **Enum de motivo fechado, decidido pelo revisor no Step 08**, não por regex: hoje `classificarMotivoIncorp()` é heurística, e os 8 regimes com `incorporacao.status` explícito estão **todos** como `refutado` — inclusive DB-06 (T-DXd, SLP positiva) e capivasertibe. Falta o valor `preferencia_institucional` (MPACT, HIMALAYA).

### 4.4 Referendo e efeito na fila de revisão

- `valor_rederivado` está no `content_hash` (app/build-data.py:217–229). Re-derivar expira **todo** parecer gravado sobre regimes que mudarem: 133 regimes têm aprovação no corpus, 98 são 1A. Estimativa: **60–110 protocolos** voltam a `pendente_re_revisao`.
- Proposta de referendo: o revisor valida a tabela antes→depois **por tumor, fora da tela** (1 sessão, ~2–3 h); o intake grava a decisão como parecer `natureza: dado` com `aplicada_em` (regra 4 do Portão A), e só então `RUN_ATIVO` é promovido. Assim a fila recebe pareceres já respondidos, não 100 pendências.
- Alternativa estrutural (decisão da direção, fora desta rodada): hash **por eixo**, para que mudança em GRADE não expire a aprovação de elegibilidade.

### 4.5 Decisões que precisam do revisor antes da rodada

| # | decisão | opções |
|---|---|---|
| D1 | notação na tela | palavras (certeza + força + direção) **[recomendado]** · manter `1A` com direção (`1A↓`) |
| D2 | escopo | 301 **[recomendado]** · 177 1A + 51 não-incorporados |
| D3 | limiar de força forte | MCBS ≥ 3 paliativo / ≥ B curativo **[recomendado]** · só certeza ≥ B |
| D4 | regime não-incorporado | força sempre `contra` **[recomendado]** · manter força "vs comparador" + campo separado de decisão institucional |
| D5 | pareceres que expiram | referendo em tabela por tumor **[recomendado]** · aceitar fila |
| D6 | gestor vê motivo | lista em Recursos **[recomendado]** · aba própria · não vê |
| D7 | enum de motivo | fechar 5 valores (+`preferencia_institucional`) e revisor escolhe no Step 08 |

## 5. Limites desta auditoria

- Reavaliação da amostra feita de memória do auditor sobre os ensaios (N, HR, IC citados são os publicados; conferir no referendo — nenhuma API foi chamada nesta rodada, por ser leitura pura).
- Não avaliei os 1B/2B/2C nem o eixo ESMO-MCBS — o mesmo atalho de método provavelmente está lá (formato heterogêneo já sugere).
- Não abri o banco de produção (pareceres reais podem diferir das `aprovacoes` do corpus).
- Portão C (mérito clínico) é do oncologista; este relatório só mede aderência ao método.
