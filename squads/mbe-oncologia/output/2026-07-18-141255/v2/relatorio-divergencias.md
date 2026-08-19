# Relatório de divergências — Protocolo de mama (Orizonti/OncoMed)

**Lote:** neoplasia de mama · **Fonte:** `Protocolos de Oncologia 2025 1.pdf` (pp. 10–27) · **Run:** 2026-07-18-141255
**Regimes processados:** 60 · **Confronto adversarial dos quatro eixos** (GRADE, ESMO-MCBS, NCCN Affordability, elegibilidade) contra a fonte primária.

> Este documento **informa e sinaliza**. Nenhuma conduta está prescrita; toda decisão é do oncologista. Nada é publicado como "confirmado" sem esta revisão humana (Step 08).

## Selo de confiança

| Selo | Qtde (v1) | Qtde (v2) | Significado |
|------|-----------|-----------|-------------|
| ✅ **Confirmado** | 24 | **36** | Os eixos concordam com o protocolo, ou foram re-derivados de forma sólida sem afirmação do protocolo a confrontar. |
| 🔴 **Divergência** | 5 | **6** | Ao menos um eixo diverge do que o protocolo afirma/pratica. **Exigem decisão.** |
| 🟡 **Incompleto** | 31 | **18** | Lacuna real de fonte que trava consumo pelo app (sem estudo-pivô rastreável e/ou sem critérios de elegibilidade computáveis). |

> **v2 (2026-07-20):** re-verificação dos incompletos do lote de mama usando a escada de APIs abertas (ClinicalTrials.gov, Europe PMC, Crossref, Unpaywall, OpenAlex, PubMed). Ver adendo no fim do documento.

**Regra do selo:** divergência tem precedência; depois incompleto (lacuna de fonte); senão confirmado. O status `indeterminado` de GRADE/Affordability **por ausência de afirmação do protocolo** (esses campos vêm `null` no PDF) **não** rebaixa o regime — apenas registra que não havia valor institucional a confrontar.

---

## 🔴 A. Divergências — decisão necessária

Estas cinco entram no topo porque mudam ou podem mudar conduta/indicação. Para cada uma: **Aceitar re-derivação** (o sistema achou algo que o protocolo não reflete), **Manter protocolo** (com motivo registrado), ou **Escalar ao Tumor Board**.

### A1. TCH neoadjuvante (HER2+, até cT1c) — indicação além da população estudada 🎯
- **Eixo:** elegibilidade — `mais_amplo`.
- **Protocolo:** aplica TCH (docetaxel + carboplatina + trastuzumabe) na neoadjuvância para tumores **até cT1c**, que podem incluir **N0 de baixo risco**.
- **Fonte primária (BCIRG-006, NEJM 2011):** o estudo foi **adjuvante** e incluiu HER2+ **N+ ou N0 de alto risco**, com FEVE basal ≥50%. Tumores mínimos N0 de baixo risco e o cenário neoadjuvante **não foram estudados**.
- **Risco:** indicar TCH a uma população que o estudo-pivô excluiria, em cenário distinto.
- **Fonte:** https://doi.org/10.1056/NEJMoa0910383
- **Sugestão:** escalar ao Tumor Board — decidir se restringe a elegibilidade (alinhar ao BCIRG-006 / usar estudos neoadjuvantes apropriados) ou documenta a extrapolação institucional.

### A2. Alpelisibe + fulvestranto — ESMO-MCBS afirmado "1", re-derivado "3" 📈
- **Eixo:** ESMO-MCBS — **diverge** (afirmado `1` → re-derivado `3`).
- **Fonte primária (SOLAR-1):** PIK3CA-mutado, SLP 11,0 vs 5,7 meses (HR 0,65); **SG final não significativa** (39,3 vs 31,4 m; HR 0,86; p=0,15). ESMO-MCBS oficial (Form 2b) = **3**.
- **Leitura:** o "1" do protocolo reflete uma **decisão institucional** por toxicidade elevada (hiperglicemia; ~70% de interrupções, ~25% de descontinuações) e piora de QoL — julgamento clínico legítimo, mas **não é a magnitude ESMO-MCBS**, que é 3.
- **Fonte:** SOLAR-1 (Ann Oncol 2021); PRO em J Clin Oncol 2021;39:2005; ABC5 guidelines (MCBS=3).
- **Sugestão:** manter a **recomendação** institucional (não incorporar) por toxicidade/QoL, **mas corrigir o rótulo do eixo** para MCBS=3 e mover a justificativa de toxicidade para o campo próprio — o eixo de magnitude não deve carregar a decisão de custo/tolerabilidade. Regime segue "não incorporado".

### A3. Sacituzumabe govitecana (HR+/HER2- metastático, 2L+) — elegibilidade mais ampla que o TROPiCS-02 🎯
- **Eixo:** elegibilidade — `mais_amplo`.
- **Protocolo:** exige "2 a 4 linhas de QT prévia" e "sem TDXd prévio".
- **Fonte primária (TROPiCS-02):** exigiu 2–4 linhas de QT **no metastático E** endócrina, **taxano E iCDK4/6 prévios**. O protocolo **omite** a exigência de iCDK4/6/endócrina/taxano — permite paciente sem iCDK4/6 prévio que o estudo excluiria.
- **Fonte:** https://doi.org/10.2217/fon-2020-0163
- **Sugestão:** aceitar a re-derivação — acrescentar à elegibilidade os critérios `iCDK4/6 prévio`, `endócrina prévia`, `taxano prévio` para alinhar à população-pivô.

### A4. T-DM1 3ª linha HER2+ (TH3RESA) — elegibilidade muito mais ampla que o estudo 🎯
- **Eixo:** elegibilidade — `mais_amplo`.
- **Protocolo:** exige apenas "HER2+ não exposto previamente ao T-DM1".
- **Fonte primária (TH3RESA):** exigiu **≥2 regimes anti-HER2 no cenário avançado, incluindo trastuzumabe E lapatinibe E taxano**. O protocolo omite tudo isso — permite paciente muito menos tratado que o estudo incluiu.
- **Fonte:** https://doi.org/10.1016/S1470-2045(14)70178-0
- **Sugestão:** escalar/aceitar re-derivação — na prática 3L+ o paciente já costuma ter recebido linhas anti-HER2, mas o critério computável está frouxo; alinhar à sequência exigida pelo TH3RESA.

### A5. Sacituzumabe govitecana (TNBC metastático, 3L, ASCENT) — ESMO-MCBS afirmado "5", re-derivado "4" 📈
- **Eixo:** ESMO-MCBS — **diverge** (afirmado `5` → re-derivado `4`).
- **Fonte primária (ASCENT):** SG 11,8 vs 6,9 m (ganho 4,9 m; HR 0,48); SLP 4,8 vs 1,7 m (HR 0,41); melhora de QoL. Com **SG do controle < 12 meses**, o Form 2a **limita o teto a 4** (HR ≤0,65 e ganho ≥3 m). A análise sistemática ESMO-MCBS de ADCs confirma 4. O "5" **não é alcançável** neste formulário.
- **Fonte:** https://doi.org/10.1056/NEJMoa2028485; PMC11163648.
- **Sugestão:** aceitar re-derivação — corrigir o rótulo do eixo para MCBS=4 (benefício segue substancial; a recomendação de uso não muda).

---

## 🟡 B. Incompletos — o que falta (31 regimes)

Não são erros: são regimes que, hoje, **não têm insumo de fonte para consumo pleno pelo app**. Duas lacunas:

- **Sem critérios de elegibilidade computáveis (31):** o protocolo não escreve elegibilidade e/ou o item é uma **lista genérica de QT** (opções NCCN, backbones) sem estudo-pivô único do qual extrair `{campo, operador, valor}`. Ex.: backbones adjuvantes/neoadjuvantes (AC-T, TC, AC, CMF, ACdd-CT), listas de QT metastática (paclitaxel, docetaxel, vinorelbina, gencitabina, doxo lipossomal, capecitabina), e regimes "não incorporados" (PHESGO, capivasertibe, atezolizumabe, bevacizumabe, T-DXd RH-).
- **Sem estudo-pivô GRADE rastreável (13, subconjunto):** referência ausente ou apenas diretriz/real-world — sem RCT único para graduar isoladamente (HT isolada, QT em crise visceral, monodrogas 2L de suporte, listas NCCN, atezolizumabe e bevacizumabe não incorporados).

**Encaminhamento sugerido:** para backbones e listas de QT, decidir se o app os trata como "regimes de suporte sem gate de elegibilidade" (elegibilidade aberta, por decisão médica) — o que resolve a maior parte dos 31 sem precisar inventar critério. Os "não incorporados" já carregam a justificativa institucional; basta confirmar o rótulo.

---

## ⚠️ C. Confirmados com ressalva (afrouxamento menor de elegibilidade)

Selo **confirmado**, mas com sinal de `mais_amplo` pontual — vale um olhar:

- **T-DM1 adjuvante (KATHERINE):** o protocolo não reproduz a exclusão de **T1aN0/T1bN0** do estudo. Impacto pequeno; considerar registrar.
- **T-DXd 2L HER2+ (DESTINY-Breast03):** o protocolo não reproduz a exclusão de **T-DM1 prévio**. Na sequência atual raramente relevante; considerar registrar.

---

## ✅ D. Confirmados sólidos (destaques)

Concordância confirmada contra a fonte-pivô e, quando existe, o scorecard oficial ESMO:
- **Olaparibe adjuvante (OlympiA):** MCBS **A**, GRADE 1A, elegibilidade equivalente (4 braços idênticos ao estudo).
- **T-DM1 adjuvante doença residual (KATHERINE):** MCBS **A**, GRADE 1A.
- **Abemaciclibe adjuvante (monarchE):** MCBS **A** (ressalva honesta: SG ainda não significativa; grau A vem da magnitude de iDFS).
- **Pembrolizumabe neoadjuvante (KEYNOTE-522):** MCBS **A**, GRADE 1A, elegibilidade literalmente igual ("T1c N1-2 ou T2-4 N0-2").
- **THP 1L HER2+ metastático (CLEOPATRA):** MCBS **4**, GRADE 1A.
- **T-DXd 2L HER2+ (DESTINY-Breast03):** MCBS **4**; **KEYNOTE-355** TNBC 1L: MCBS **4**; **DESTINY-Breast04** HR+ HER2-low: MCBS **4**.

---

## Nota metodológica e isenção

- O PDF do protocolo é **vetorial** (sem camada de texto); a extração exigiu renderização e leitura visual das páginas.
- O protocolo **não afirma** notas GRADE nem Affordability em nenhum regime (campos `null`); esses eixos foram **re-derivados** e reportados, mas não geram "diverge/concorda" por falta de valor institucional a confrontar.
- Scorecards oficiais da ESMO são renderizados por JS e não foram lidos por fetch direto; usaram-se os valores oficiais recuperados por busca e a análise sistemática revisada por pares como proxy do consenso, sempre citada em `fonte`.
- Onde a fonte não permitiu concluir, o veredito é `indeterminado`/`n/a` — nunca um chute.

**O sistema sinaliza; a decisão — aceitar, manter ou escalar — é do oncologista.**

---

## 📡 Adendo v2 (2026-07-20) — Re-verificação pela escada de APIs abertas

Os verificadores e a vigilância passaram a consultar as **APIs abertas das bases científicas** (Europe PMC, Unpaywall, OpenAlex, Crossref, PubMed E-utilities e ClinicalTrials.gov v2) **antes** de marcar um artigo como inacessível — em vez de desistir no paywall da página do editor. Elegibilidade prioriza o `eligibilityModule` do ClinicalTrials.gov, que traz os critérios de inclusão/exclusão já estruturados. E-mail de contato usado nos parâmetros exigidos: `gustavocouto72@gmail.com`.

**Resultado:** dos 31 regimes "incompleto", **13 foram convertidos** — **12 para ✅ confirmado** e **1 para 🔴 divergência**.

### Convertidos para ✅ confirmado (12)
| Regime | Estudo-pivô | Como foi recuperado |
|--------|-------------|---------------------|
| mama-adj-her2neg-act | CALGB 9741 (Citron 2003) | Europe PMC (busca por termo; DOI NEJM citado não resolveu → pivô confirmado em JCO, pmid 12668651) |
| mama-adj-her2neg-tc | US Oncology 9735 (Jones 2006) | Europe PMC pmid 17135639 |
| mama-adj-her2neg-cmf | CMF (Bonadonna 1976) | Europe PMC pmid 1246307 |
| mama-neo-tnbc-tc | US Oncology 9735 | Europe PMC pmid 17135639 (flag de indirectness de cenário/subtipo) |
| mama-neo-rhpos-tc | US Oncology 9735 | Europe PMC pmid 17135639 (flag de indirectness de cenário) |
| mama-neo-her2pos-phesgo-nao-incorporado | FeDeriCa | ClinicalTrials.gov NCT03493854 |
| mama-met-hrpos-1l-fulvestranto-cdk46 | MONALEESA-3 | ClinicalTrials.gov NCT02422615 |
| mama-met-hrpos-2l-capivasertibe-nao-incorporado | CAPItello-291 | ClinicalTrials.gov NCT04305496 |
| mama-met-hrpos-2l-capecitabina | X-7/7 (Khan 2025) | Europe PMC pmid 39917581 (artigo OA) |
| mama-met-tnbc-3l-tdxd-nao-incorporado | DESTINY-Breast04 | ClinicalTrials.gov NCT03734029 |
| mama-met-tnbc-1l-atezolizumabe-nao-incorporado | IMpassion131 | Europe PMC pmid 34219000 + ClinicalTrials.gov NCT03125902 (resolve GRADE **e** elegibilidade) |
| mama-met-tnbc-bevacizumabe-nao-incorporado | E2100 (Miller 2007) | Europe PMC pmid 18160686 + ClinicalTrials.gov NCT00028990 (resolve GRADE **e** elegibilidade) |

### Nova divergência 🔴 (1)
- **A6. mama-neo-rhpos-act-acddt (AC-T/ACdd-T neoadjuvante RH+)** — eixo elegibilidade `mais_amplo`. O pivô **CALGB 9741** incluiu **apenas doença axilar-positiva (N+) em cenário adjuvante**; o protocolo admite **N0** (T3/T4 ou biologia de alto risco) e uso **neoadjuvante**. Indicação parcialmente fora da população do estudo → adicionada às divergências pendentes de revisão humana. Fonte: Europe PMC pmid 12668651.

### Não convertidos (18) — permanecem 🟡 incompleto, por honestidade adversarial
Sem estudo-pivô registrado/recuperável: compilações de opções NCCN (`mama-met-tnbc-{1,2,3}l-qt-opcoes`), itens "referência a definir" (HT isolada, QT em crise visceral, docetaxel, vinorelbina IV/VO, gencitabina), meta-análise/revisão sem elegibilidade própria (`mama-neo-tnbc-acdd-ct` EBCTCG, `mama-met-hrpos-2l-paclitaxel`), dado real-world (`mama-met-her2pos-3l-trastuzumabe-citotoxico`), e ensaios pré-2005 não indexados por DOI/registro (PACS 01 → `mama-adj-her2neg-act-docetaxel`; NSABP B-18 → `mama-adj-her2neg-ac`). O carbo-paclitaxel adjuvante (`mama-adj-her2neg-carbo-paclitaxel`) teve o CALGB 40603 localizado via ClinicalTrials.gov, mas o ensaio é **neoadjuvante e restrito a TNBC** — mismatch de cenário e subtipo grande demais para servir de pivô limpo; mantido incompleto. **Nada foi chutado.**

> Metodologia e rastreabilidade completas em `pipeline/data/fontes-confiaveis.md` (seção "APIs abertas") e em `meta.reverificacao_apis` no `regimes-consolidados.json`.
