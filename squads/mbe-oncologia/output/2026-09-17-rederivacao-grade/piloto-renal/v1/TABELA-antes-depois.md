# Piloto de calibração GRADE — RENAL (10 regimes) · tabela ANTES → DEPOIS

**Data:** 2026-09-17 · **Base:** RUN_ATIVO `2026-09-16-drivers-pulmao/v1` (valores "antes") · **Saída:** `piloto-renal/regimes-consolidados.json`
(schema 2; **não promovido**, nada em RUN_ATIVO/backend/app/produção) · **Portão A:** passou (check [11] 10/10; `portao-saida.txt`) ·
**DOIs:** os 9 do corpus + 5 propostos resolvem no Crossref.

**Referendo duplo:** o revisor valida o **clínico** (colunas certeza/força/direção e os itens de calibração C1–C7);
eu valido o **método** (transcrição, regras, portão). Portão C (mérito) não é carimbado aqui.

**Fontes abertas:** Crossref + Europe PMC (abstract) para os 9 DOIs; texto completo pela página PMC do manuscrito
de autor para CheckMate 214, 9ER, 025, METEOR e ASPEN (o `fullTextXML` do Europe PMC devolveu 500; NEJM/Wiley
devolvem 403 ao bot — Unpaywall/OpenAlex apontam as URLs). Respostas cruas em `fontes/`. **Nenhum efeito veio de
memória**: `rederivar_renal.py` copia cada transcrição do arquivo salvo por busca literal e aborta se a frase não
existir. **0 indeterminados** — os pedidos de artigo são todos *upgrade* (`PEDIDOS-DE-ARTIGO.md`).

## Placar

| | antes | depois |
|---|---|---|
| 1A | 8 | **2** (adj pembrolizumabe, axitinibe+pembrolizumabe) |
| 1B | 1 | 2 (ipi+nivo int/alto, nivo+cabo) |
| 2B | 1 | 1 (sunitinibe favorável) |
| 2C | 0 | 3 (pazopanibe, nivolumabe 2L, cabozantinibe 2L pós-IO) |
| 2D | 0 | 2 (ipi+nivo favorável, não-claras) |

Sobrevivência como 1A: **2/8 (25%)** — abaixo dos 47% da amostra da auditoria. A diferença não é clínica: é
o que as regras 6 e 7 fazem com **fonte registrada incompleta** (eventos não transcritos, IC não-95%, comparador
obsoleto). Os itens C1–C4 abaixo decidem se isso é o rigor desejado ou excesso de regra — antes das ondas.

## Tabela

| # | regime | antes | certeza | rec. (força · direção) | depois | domínio que mudou o resultado | trecho da fonte (transcrito) |
|---|---|---|---|---|---|---|---|
| 1 | `renal-adj-pembrolizumab` — KEYNOTE-564 30 m, Lancet Oncol 2022 | 1A | **A** | forte · a favor | **1A** | nenhum rebaixado. Duplo-cego, placebo; SLD HR 0,63 (0,50–0,80) = efeito grande (dispensa OIS). ⚠ a justificativa antiga citava **ganho de SG** — não está nesta fonte (proposta: NEJM 2024, `10.1056/nejmoa2312695`) | "Disease-free survival was better with pembrolizumab compared with placebo (HR 0·63 [95% CI 0·50-0·80]). Median disease-free survival was not reached in either group." |
| 2 | `renal-met-favoravel-pazopanibe` — COMPARZ, NEJM 2013 | 1A | **C** | condicional · a favor | **2C** | **indireta −1** (SLP substituto; SG "similar" 0,91; 0,76–1,08) + **imprecisão −1** (não-inferioridade: limite 1,22 encostado na margem 1,25; IC inclui o nulo). O pivô sustenta *equivalência*, não superioridade. Proposta: Sternberg 2010 (pazopanibe vs placebo) | "Pazopanib was noninferior to sunitinib with respect to progression-free survival (hazard ratio … 1.05; 95% confidence interval [CI], 0.90 to 1.22), meeting the predefined noninferiority margin (upper bound of the 95% confidence interval, <1.25). Overall survival was similar (hazard ratio for death with pazopanib, 0.91; 95% CI, 0.76 to 1.08)." |
| 3 | `renal-met-favoravel-sunitinibe` — Motzer 2007, NEJM | 1A | **B** | condicional · a favor | **2B** | **indireta −1** (SLP substituto sem SG nesta fonte; comparador IFN-α obsoleto; população toda-risco vs regime favorável — leitura −2 defensável → C). Força: escolha vs IO-TKI é sensível a preferência; MCBS n/a. **= gabarito da auditoria (caso 01: 2B).** Proposta: Motzer 2009 (SG) | "The median progression-free survival was significantly longer in the sunitinib group (11 months) than in the interferon alfa group (5 months), corresponding to a hazard ratio of 0.42 (95% confidence interval, 0.32 to 0.54; P<0.001)." |
| 4 | `renal-met-favoravel-ipilimumabe-nivolumabe` — CheckMate 214, subgrupo favorável | 1B | **D** | condicional · **a favor (?)** | **2D** | **indireta −2** (desfecho exploratório fora do primário; SG, SLP e TRO favorecem o sunitinibe) + **imprecisão −2** (37 óbitos; IC 99,8% 0,51–4,12). Direção "a favor" só porque o protocolo lista o regime — **C6: o revisor decide**. Proposta: Tannir 2024 (8 anos) | "the hazard ratio for death favored sunitinib: 1.45; 99.8% CI, 0.51 to 4.12; P = 0.27 … only 37 deaths had occurred … The objective response rate was 29% … versus 52% … median progression-free survival was 15.3 months … versus 25.1 months … (hazard ratio … 2.18; 99.1% CI, 1.29 to 3.68; P<0.001), both favoring sunitinib." |
| 5 | `renal-met-intalto-ipilimumabe-nivolumabe` — CheckMate 214, int/alto | 1A | **B** | forte · a favor | **1B** | **imprecisão −1**: 1ª interina (51% dos óbitos planejados), IC disponível é **99,8%** (0,44–0,89), nº de óbitos não transcrito → OIS não demonstrável (regra 1). Proposta: Tannir 2024 → provável A. **C1/C3** | "the 18-month overall survival rate was 75% (95% CI, 70 to 78) versus 60% (95% CI, 55 to 65) (hazard ratio for death, 0.63; 99.8% CI, 0.44 to 0.89; P<0.001)." |
| 6 | `renal-met-intalto-axitinibe-pembrolizumabe` — KEYNOTE-426, NEJM 2019 | 1A | **A** | forte · a favor | **1A** | nenhum rebaixado: SG HR 0,53 (0,38–0,74) = efeito grande. ⚠ **C4**: é a 1ª interina (seguimento 12,8 m) — Cochrane gradua *moderada* | "After a median follow-up of 12.8 months, the estimated percentage of patients who were alive at 12 months was 89.9% in the pembrolizumab-axitinib group and 78.3% in the sunitinib group (hazard ratio for death, 0.53; 95% confidence interval [CI], 0.38 to 0.74; P<0.0001)." |
| 7 | `renal-met-intalto-nivolumabe-cabozantinibe` — CheckMate 9ER, NEJM 2021 | 1A | **B** | forte · a favor | **1B** | **imprecisão −1**: IC da SG reportado é **98,89%** (0,40–0,89), limite 0,89 > 0,85, óbitos não transcritos, mediana não atingida. **C1/C3** | "The probability of overall survival at 12 months was 85.7% (95% CI, 81.3 to 89.1) with nivolumab plus cabozantinib and 75.6% (95% CI, 70.5 to 80.0) with sunitinib (hazard ratio for death, 0.60; 98.89% CI, 0.40 to 0.89" |
| 8 | `renal-met-2l-pos-vegfr-nivolumabe` — CheckMate 025 5 anos, Cancer 2020 | 1A | **C** | condicional · a favor | **2C** | **indireta −1** (comparador everolimo não é padrão atual — regra 6) + **imprecisão −1** (RRR 27% < 30%; nº de óbitos **não escrito**, embora dedutível ≥ 600 das taxas de SG 5 a × N). **É o caso-teste de C1 e C2**: com qualquer um dos dois relaxado vira B; com os dois, A | "With a minimum follow-up of 64 months (median, 72 months), nivolumab maintained an OS benefit in comparison with everolimus (median, 25.8 months [95% CI, 22.2-29.8 months] vs 19.7 months [95% CI, 17.6-22.1 months]; hazard ratio [HR], 0.73; 95% CI, 0.62-0.85) with 5-year OS probabilities of 26% and 18%, respectively." |
| 9 | `renal-met-2l-pos-io-cabozantinibe` — METEOR, NEJM 2015 (texto PMC) | 1A | **C** | condicional · a favor | **2C** | **indireta −1** (população METEOR = pós-TKI VEGFR; regime = pós-**imunoterapia**; comparador everolimo obsoleto) + **imprecisão −1** (202 óbitos < 300; interina que não cruzou o limite p ≤ 0,0019). Proposta: METEOR final 2016 (SG madura) → B | "At the prespecified interim analysis of overall survival, 202 deaths had occurred in the overall survival population. A trend for increased overall survival with cabozantinib was observed (hazard ratio 0.67, unadjusted 95% CI, 0.51 to 0.89; P=0.005)" |
| 10 | `renal-naoclaras-sunitinibe-pazopanibe` — ASPEN, Lancet Oncol 2016 (fase 2 randomizado) | 2B | **D** (regra squad) | condicional · a favor | **2D** | fase 2 → parte de **C**; **indireta −1** (SLP substituto; pazopanibe não testado; população mista vs "papilífero"); **imprecisão −1** (IC **80%** 1,03–1,92; p=0,16; 87 eventos). **C5: cálculo dos dois jeitos abaixo** | "As of December, 2014, 87 progression-free survival events had occurred … Sunitinib significantly increased progression-free survival compared with everolimus (8·3 months [80% CI 5·8-11·4] vs 5·6 months [5·5-6·0]; hazard ratio 1·41 [80% CI 1·03-1·92]; p=0·16)" |

## C5 — ASPEN calculado dos dois jeitos (fase II randomizado)

| método | inicial | risco de viés | inconsistência | indireta | imprecisão | viés publ. | **certeza** | valor |
|---|---|---|---|---|---|---|---|---|
| **Regra do squad** ("fase II parte de C") | C | 0 | 0 | −1 | −1 | 0 | **D** | 2D |
| **GRADE ortodoxo** (RCT parte de A), imprecisão *séria* | A | 0 | 0 | −1 | −1 | 0 | **B** | 2B |
| **GRADE ortodoxo**, imprecisão *muito séria* (N=108, 87 eventos, IC 80%, p=0,16 — IC 95% inclui o nulo com folga) | A | 0 | 0 | −1 | −2 | 0 | **C** | 2C |

Leitura: o ortodoxo só chega a B se a imprecisão de um ensaio de 108 pacientes desenhado com IC 80% for
lida como "séria" e não "muito séria" — o que contraria a própria ficha (`< 300 eventos` **e** IC cruzando
o nulo **e** limites levando a recomendações opostas: três dos quatro critérios). Com −2, ortodoxo = C e
squad = D: **um degrau de diferença**, e o valor antigo (2B) só se sustenta na leitura mais generosa.
Decisão para o referendo: manter "fase II parte de C" (simples, conservador) **ou** "parte de A com
imprecisão −2 obrigatória em fase II" (ortodoxo, chega no mesmo C na prática). Recomendo a segunda:
é GRADE puro, e o portão consegue impor "−2 obrigatório" tão determinístico quanto "parte de C".

## Triangulação Cochrane (só leitura; nada copiado para o corpus)

Fontes: Cochrane **CD013798.pub2** (2023, NMA 1ª linha), **CD012796.pub2** (2020, terapia-alvo mRCC),
**CD011673.pub2** (2017, imunoterapia mRCC) — abstracts via Europe PMC (`fontes/cochrane-renal.europepmc.json`).
Sem Cochrane para: adjuvante (KEYNOTE-564), nivo+cabo ("comparison data were not available"), cabozantinibe 2L
(não aparece no abstract), não-células claras.

| regime | certeza do piloto | Cochrane (comparação · desfecho · certeza) | leitura |
|---|---|---|---|
| pazopanibe | C | 2020: PAZ vs SUN — SLP HR 1,05 (0,90–1,23) **baixa**; SG HR 0,92 **baixa**. 2023 NMA: SG "pouca ou nenhuma diferença" **moderada** | **converge** (baixa = C) na revisão de ensaio direto; NMA sobe a moderada |
| sunitinibe (vs IFN) | B | 2017: IFN-α vs terapia-alvo (SUN/temsirolimo) — mortalidade 1 a RR 1,30 **moderada** | **converge** (moderada = B) |
| ipi+nivo int/alto | B | 2020: SUN vs NIV+IPI (847 pts, 30 m) — SG HR 1,52 (1,23–1,89) **alta**; SLP **baixa**. 2023 NMA (toda-risco): SG **moderada** | **diverge para cima**: Cochrane usou a atualização de 30 m (IC 95%, eventos maduros); eu, a fonte registrada (1ª interina, IC 99,8%). Repescagem com Tannir 2024 fecha em A → **C1/C3** |
| axitinibe+pembro | A | 2020: SUN vs PEM+AXI — SG HR 1,90 (1,36–2,65) **moderada**; SLP **moderada**. 2023 NMA: SG **moderada** | **diverge para baixo**: Cochrane rebaixou (risco de viés "high/some concerns" + interina). É o **C4** — o piloto foi mais generoso que o Cochrane aqui |
| nivolumabe 2L | C | 2017: NIV vs everolimo — mortalidade 1 a RR 0,70 (0,56–0,87) **moderada**; QoL e EA g≥3 **moderada** | **diverge para cima**: Cochrane não penaliza comparador (a pergunta deles *é* "vs everolimo") nem eventos (usou a análise primária). **C2** decide |
| ipi+nivo favorável | D | 2023 NMA: resultados por grupo de risco só nas tabelas SoF (não no abstract) | sem dado no abstract — não conferido |

Síntese: 2 convergências, 3 divergências — e as três divergências caem exatamente nos itens de calibração
C1–C4. O Cochrane é mais rigoroso que o piloto num ponto (interina do KEYNOTE-426) e mais generoso em dois
(eventos deduzíveis/atualizações; comparador obsoleto). Nenhuma divergência é sobre o *método* em si.

## Itens de calibração para o referendo (decidir antes das ondas)

| # | questão | afeta no piloto | minha recomendação |
|---|---|---|---|
| **C1** | Nº de eventos **dedutível** da fonte (N × taxa de sobrevida transcrita) conta para OIS, ou só o número escrito? | 025 (C→B), 214 int/alto (B→A com C3), 9ER (B→A com C3), KEYNOTE-564 (já A) | permitir com campo `eventos_derivados: {calculo, por}` — aritmética sobre números transcritos não é memória; o portão confere a conta |
| **C2** | Comparador **obsoleto** = indireta −1 mesmo quando a indicação do regime é idêntica à do ensaio (2ª linha pós-TKI = 025)? | 025 (C→B), sunitinibe (fica B — já tem substituto), METEOR (fica C — tem população) | −1 só quando o comparador obsoleto muda a **pergunta** (1ª linha hoje ≠ vs IFN); quando a indicação é a mesma e o regime *é* o padrão que substituiu o comparador, 0 com frase. Portão: `comparador_padrao_atual=false` passa a **WARN** em vez de forçar −1 |
| **C3** | IC reportado a **> 95%** (98,89 / 99,8) — tratar como conservador sem penalizar? | 214 int/alto, 9ER | sim: IC mais largo que o de 95% que ainda exclui o nulo não é imprecisão; a penalidade fica só para eventos (C1). Portão: `ic_nivel > 95` não entra na regra 4 (já é assim) e o limite 0,85 do "efeito grande" é avaliado sobre ele (conservador) |
| **C4** | **Análise interina precoce** (sem parada) rebaixa? Cochrane rebaixou o KEYNOTE-426 a moderada | axitinibe+pembro (A→B) | manter A **com** `por` obrigatório mencionando a interina; ou −1 automático quando o abstract diz "interim" e eventos não estão escritos. Prefiro a 2ª: é determinística e o Cochrane concorda |
| **C5** | Fase II randomizado: "parte de C" (squad) ou "parte de A com imprecisão −2 obrigatória" (ortodoxo) | não-claras (D vs C) | ortodoxo com −2 obrigatório (ver seção C5) |
| **C6** | Direção do `renal-met-favoravel-ipilimumabe-nivolumabe`: a fonte mostra SG/SLP/TRO a favor do sunitinibe no subgrupo; o protocolo lista o regime | ipi+nivo favorável | **Portão C** — decisão clínica do revisor; o método só registra que "a favor" não sai da fonte |
| **C7** | **Referências propostas** (6): aceitar troca/adição muda 5 resultados (214 ×2, METEOR, sunitinibe, pazopanibe, KEYNOTE-564 SG) | ver WARN do portão | aceitar como **referência adicional** (não troca): a fonte histórica continua o pivô; a atualização fecha eventos/SG. Exige decidir onde o schema guarda "referência complementar" — hoje só há `referencia.doi` |

## O que NÃO mudou

- `valor_rederivado` continua número+letra (sem direção) — a tela é rodada separada.
- Nenhum parecer, `content_hash` ou aprovação foi tocado: o piloto vive em `output/`.
- ESMO-MCBS e elegibilidade: intactos (o MCBS foi **lido** pela regra 5, não re-derivado).
