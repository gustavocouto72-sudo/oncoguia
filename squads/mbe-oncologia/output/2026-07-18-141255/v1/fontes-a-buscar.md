# Fontes a buscar — regimes com selo incompleto (falta de estudo-pivô acessível)

- **Run:** `2026-07-18-141255` — `squads/mbe-oncologia/output/2026-07-18-141255/v1`
- **Critério:** regimes com selo 'incompleto' cuja lacuna é 'grade_sem_estudo_pivo' (falta de estudo-pivô acessível)
- **Total:** 13 itens — **Caso A:** 4 · **Caso B:** 9
- **Gerado em:** 2026-07-19

**Casos:** 
- **Caso A** — referência citada no protocolo, mas não acessada (paywall/página JS/link quebrado/não tentado).
- **Caso B** — não há referência citada — candidato(s) de estudo-pivô propostos, marcados 'a confirmar', ou 'referência a definir'.

**Regras:** não inventar DOI (DOIs `confirmado` foram verificados na web; candidatos incertos = `a confirmar`); sem candidato confiável = `referência a definir` com explicação.

> **Como entregar os PDFs:** coloque os arquivos em `squads/mbe-oncologia/data/input/fontes-manuais/`, nomeados por `regimen_id` (ex.: `mama-met-hrpos-2l-docetaxel.pdf`) ou por DOI (`/` → `_`, ex.: `10.1200_JCO.1999.17.8.2341.pdf`). Ao re-rodar o squad, apenas esses regimes são reprocessados. Detalhes: `data/input/fontes-manuais/README.md`.

---

## Mama — Adjuvância — Hormonioterapia adjuvante — pós-menopausa

- [ ] **[Caso A] `mama-adj-ht-tam-ia-switch-pos`** — Tamoxifeno → IA (switch)
  - **Referência(s) citada(s):**
    - Davies C, Pan H, Godwin J, et al. Long-term effects of continuing adjuvant tamoxifen to 10 years versus stopping at 5 years after diagnosis of oestrogen receptor-positive breast cancer: ATLAS, a randomised trial. Lancet. 2013;381(9805):805-816.  
    DOI: `10.1016/S0140-6736(12)61963-1` (confirmado) · [link](https://doi.org/10.1016/S0140-6736(12)61963-1)
    - Francis PA, Regan MM, Fleming GF, et al. Adjuvant ovarian suppression in premenopausal breast cancer. N Engl J Med. 2015;372(5):436-446.  
    DOI: `10.1056/NEJMoa1412379` (confirmado) · PMID: `25495490` · [link](https://doi.org/10.1056/NEJMoa1412379)
    - Goss PE, Ingle JN, Martino S, et al. A randomized trial of letrozole in postmenopausal women after five years of tamoxifen therapy for early-stage breast cancer. N Engl J Med. 2003;349(19):1793-1802.  
    DOI: `10.1056/NEJMoa032312` (confirmado) · PMID: `14551341` · [link](https://doi.org/10.1056/NEJMoa032312)
  - **Motivo do não-acesso:** `nao_tentado` — Referência agrupada do bloco de hormonioterapia adjuvante (ATLAS/SOFT/MA.17) — o PDF não isola um estudo-pivô específico para a estratégia de switch, então nenhum DOI foi rastreado/baixado.
  - **Ação:** baixar os PDFs destes DOIs (ATLAS, SOFT, MA.17)
  - **Notas:** Atenção: as 3 referências citadas NÃO isolam o pivô da estratégia de switch (tamoxifeno→IA). O pivô próprio do switch é IES/BIG 1-98 (ver candidatos). SOFT trata de supressão ovariana em pré-menopausa — pouco aderente ao subtipo pós-menopausa. Ao baixar, priorizar o pivô do switch.
  - **Candidato(s) de pivô (a confirmar):**
    - **IES (Intergroup Exemestane Study)** — A randomized trial of exemestane after two to three years of tamoxifen therapy in postmenopausal women with primary breast cancer (Intergroup Exemestane Study, IES)  
    Coombes RC, et al. N Engl J Med. 2004;350(11):1081-1092.  
    2004 · [link](https://pubmed.ncbi.nlm.nih.gov/?term=Coombes+exemestane+intergroup+2004)  
    _Por que é o pivô:_ RCT fase III que testou exatamente o switch (tamoxifeno 2-3 anos → exemestano) em pós-menopausa; é o pivô próprio da estratégia sequencial. — **status: a confirmar**
    - **BIG 1-98** — BIG 1-98 (letrozol vs tamoxifeno, incluindo braços sequenciais)  
    BIG 1-98 Collaborative Group / Regan MM, et al.  
    [link](https://pubmed.ncbi.nlm.nih.gov/?term=BIG+1-98+letrozole+sequential)  
    _Por que é o pivô:_ Ensaio de referência de terapia endócrina adjuvante com braços sequenciais IA↔tamoxifeno; sustenta a estratégia de switch em pós-menopausa. — **status: a confirmar**


## Mama — Metastático — Triplo negativo — 1ª linha (não elegíveis a imunoterapia)

- [ ] **[Caso A] `mama-met-tnbc-1l-qt-opcoes`** — Quimioterapia (opções, não elegíveis à 1ª linha com imunoterapia)
  - **Referência(s) citada(s):**
    - NCCN Clinical Practice Guidelines in Oncology: Breast Cancer. Version 2.2025. Disponível em: https://www.nccn.org. Acesso em: jul. 2025.  
    [link](https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419)
  - **Motivo do não-acesso:** `pagina_js` — NCCN exige cadastro/login gratuito e serve o PDF por página dinâmica (JS); a diretriz é uma COMPILAÇÃO/lista de opções de QT, não um estudo-pivô isolado — mesmo acessando, não resolve a lacuna de pivô por fármaco.
  - **Ação:** baixar a diretriz NCCN (login gratuito) para rastreabilidade; para fechar o selo, definir o pivô de CADA fármaco da lista (vira Caso B por fármaco)
  - **Notas:** Item de fronteira: tem referência citada (NCCN), mas o pivô por fármaco continua indefinido. Ver Caso B (docetaxel, gencitabina, vinorelbina, doxo lipossomal) para os pivôs por agente.


## Mama — Metastático — Triplo negativo — 2ª linha

- [ ] **[Caso A] `mama-met-tnbc-2l-qt-opcoes`** — Quimioterapia (opções, 2ª linha)
  - **Referência(s) citada(s):**
    - NCCN Clinical Practice Guidelines in Oncology: Breast Cancer. Version 2.2025. Disponível em: https://www.nccn.org. Acesso em: jul. 2025.  
    [link](https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419)
  - **Motivo do não-acesso:** `pagina_js` — NCCN exige cadastro/login gratuito e serve o PDF por página dinâmica (JS); a diretriz é uma COMPILAÇÃO/lista de opções de QT, não um estudo-pivô isolado — mesmo acessando, não resolve a lacuna de pivô por fármaco.
  - **Ação:** baixar a diretriz NCCN (login gratuito) para rastreabilidade; para fechar o selo, definir o pivô de CADA fármaco da lista (vira Caso B por fármaco)
  - **Notas:** Item de fronteira: tem referência citada (NCCN), mas o pivô por fármaco continua indefinido. Ver Caso B (docetaxel, gencitabina, vinorelbina, doxo lipossomal) para os pivôs por agente.


## Mama — Metastático — Triplo negativo — 3ª linha e subsequentes

- [ ] **[Caso A] `mama-met-tnbc-3l-qt-opcoes`** — Quimioterapia (opções, 3ª linha)
  - **Referência(s) citada(s):**
    - NCCN Clinical Practice Guidelines in Oncology: Breast Cancer. Version 2.2025. Disponível em: https://www.nccn.org. Acesso em: jul. 2025.  
    [link](https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419)
  - **Motivo do não-acesso:** `pagina_js` — NCCN exige cadastro/login gratuito e serve o PDF por página dinâmica (JS); a diretriz é uma COMPILAÇÃO/lista de opções de QT, não um estudo-pivô isolado — mesmo acessando, não resolve a lacuna de pivô por fármaco.
  - **Ação:** baixar a diretriz NCCN (login gratuito) para rastreabilidade; para fechar o selo, definir o pivô de CADA fármaco da lista (vira Caso B por fármaco)
  - **Notas:** Item de fronteira: tem referência citada (NCCN), mas o pivô por fármaco continua indefinido. Ver Caso B (docetaxel, gencitabina, vinorelbina, doxo lipossomal) para os pivôs por agente.


## Mama — Metastático — HR+ / HER2 negativo — 1ª linha

- [ ] **[Caso B] `mama-met-hrpos-1l-ht-isolada`** — Hormonioterapia isolada (não combinada a iCDK4/6)
  - **Referência citada:** nenhuma. **Ação:** confirmar o pivô e baixar o PDF
  - **Explicação:** Protocolo não cita referência. HT isolada tem base ampla; FALCON é o candidato mais limpo para HT isolada de 1ª linha.
  - **Candidato(s) de pivô (a confirmar):**
    - **FALCON** — Fulvestrant 500 mg versus anastrozole 1 mg for hormone receptor-positive advanced breast cancer (FALCON)  
    Robertson JFR, et al. Lancet. 2016;388(10063):2997-3005.  
    DOI: `10.1016/S0140-6736(16)32389-3` · PMID: `27908454` · 2016 · [link](https://doi.org/10.1016/S0140-6736(16)32389-3)  
    _Por que é o pivô:_ RCT fase III de HT isolada de 1ª linha (fulvestranto vs anastrozol) em HR+ avançado sem HT prévia; pivô moderno da HT isolada. — **status: a confirmar**
    - **TARGET / North American Anastrozole** — Anastrozole alone or in combination... / estudos TARGET e North American (anastrozol vs tamoxifeno 1ª linha)  
    Bonneterre J / Nabholtz JM, et al. 2000.  
    2000 · [link](https://pubmed.ncbi.nlm.nih.gov/?term=anastrozole+first-line+advanced+breast+cancer+2000)  
    _Por que é o pivô:_ Pivôs históricos de IA de 1ª linha na doença avançada; sustentam a HT isolada quando fulvestranto não é a opção. — **status: a confirmar**


## Mama — Metastático — HR+ / HER2 negativo — 1ª linha (crise visceral)

- [ ] **[Caso B] `mama-met-hrpos-1l-qt-crise-visceral`** — Quimioterapia (crise visceral)
  - **Referência citada:** nenhuma.
  - **Ação:** `referência a definir`
  - **Explicação:** Protocolo não cita referência E não especifica o fármaco ('quimioterapia' genérica em crise visceral). Sem droga definida não há estudo-pivô único a buscar. Definir primeiro o(s) agente(s) pretendido(s) com o oncologista; só então buscar o pivô por agente.


## Mama — Metastático — HR+ / HER2 negativo — 2ª linha ou mais

- [ ] **[Caso B] `mama-met-hrpos-2l-docetaxel`** — Docetaxel
  - **Referência citada:** nenhuma. **Ação:** confirmar o pivô e baixar o PDF
  - **Explicação:** Protocolo não cita referência. Docetaxel é agente estabelecido; o 303 Study é o pivô monoterápico mais citável.
  - **Candidato(s) de pivô (a confirmar):**
    - **303 Study** — Prospective randomized trial of docetaxel versus doxorubicin in patients with metastatic breast cancer (303 Study)  
    Chan S, et al. J Clin Oncol. 1999;17(8):2341-2354.  
    DOI: `10.1200/JCO.1999.17.8.2341` · PMID: `10561296` · 1999 · [link](https://doi.org/10.1200/JCO.1999.17.8.2341)  
    _Por que é o pivô:_ RCT fase III de docetaxel monoterapia em MBC pré-tratada (pós-alquilante); pivô clássico do docetaxel isolado na doença metastática. — **status: a confirmar**

- [ ] **[Caso B] `mama-met-hrpos-2l-vinorelbina-iv`** — Vinorelbina IV
  - **Referência citada:** nenhuma.
  - **Ação:** `referência a definir`
  - **Explicação:** Protocolo não cita referência. Vinorelbina em MBC baseia-se sobretudo em fase II e uso consagrado; não há RCT fase III único como pivô limpo. Sem candidato confiável — não inventar. Opção: adotar revisão/diretriz como fonte de suporte e assumir selo 'incompleto' explícito por ausência de pivô próprio.

- [ ] **[Caso B] `mama-met-hrpos-2l-vinorelbina-vo`** — Vinorelbina VO
  - **Referência citada:** nenhuma.
  - **Ação:** `referência a definir`
  - **Explicação:** Mesma situação da vinorelbina IV; a formulação oral tem base de bioequivalência/fase II, sem RCT fase III pivô próprio. Sem candidato confiável — não inventar.

- [ ] **[Caso B] `mama-met-hrpos-2l-gencitabina`** — Gencitabina
  - **Referência citada:** nenhuma.
  - **Ação:** `referência a definir`
  - **Explicação:** Protocolo não cita referência. Gencitabina EM MONOTERAPIA na MBC apoia-se em fase II; os RCTs fase III relevantes (ex.: gencitabina+paclitaxel) são de COMBINAÇÃO, não do agente isolado — não servem como pivô do regime isolado. Sem candidato confiável para monoterapia — não inventar.

- [ ] **[Caso B] `mama-met-hrpos-2l-doxo-lipossomal`** — Doxorrubicina Lipossomal
  - **Referência citada:** nenhuma. **Ação:** confirmar o pivô e baixar o PDF
  - **Explicação:** Protocolo não cita referência. O'Brien 2004 é o RCT fase III pivô da doxorrubicina lipossomal na MBC.
  - **Candidato(s) de pivô (a confirmar):**
    - **CAELYX/Doxil vs doxorrubicina (O'Brien)** — Reduced cardiotoxicity and comparable efficacy in a phase III trial of pegylated liposomal doxorubicin HCl (CAELYX/Doxil) versus conventional doxorubicin for first-line treatment of metastatic breast cancer  
    O'Brien MER, et al. Ann Oncol. 2004;15(3):440-449.  
    DOI: `10.1093/annonc/mdh097` · 2004 · [link](https://doi.org/10.1093/annonc/mdh097)  
    _Por que é o pivô:_ RCT fase III de doxorrubicina lipossomal peguilada vs doxorrubicina convencional em MBC (eficácia comparável, menor cardiotoxicidade); pivô do agente. — **status: a confirmar**


## Mama — Metastático — Triplo negativo — 1ª linha

- [ ] **[Caso B] `mama-met-tnbc-1l-atezolizumabe-nao-incorporado`** — Atezolizumabe — NÃO INCORPORADO
  - **Referência citada:** nenhuma. **Ação:** confirmar o pivô e baixar o PDF
  - **Explicação:** Protocolo nomeia o estudo (IMpassion131) mas não fornece citação/DOI. Baixar sustenta o registro do porquê da não-incorporação (evidência de alta qualidade apontando ausência de eficácia).
  - **Candidato(s) de pivô (a confirmar):**
    - **IMpassion131** — Primary results from IMpassion131, a double-blind, placebo-controlled, randomised phase III trial of first-line paclitaxel with or without atezolizumab for unresectable locally advanced/metastatic triple-negative breast cancer  
    Miles D, et al. Ann Oncol. 2021;32(8):994-1004.  
    DOI: `10.1016/j.annonc.2021.05.801` · PMID: `34219000` · 2021 · [link](https://doi.org/10.1016/j.annonc.2021.05.801)  
    _Por que é o pivô:_ RCT fase III do atezolizumabe+paclitaxel em TNBC 1ª linha — foi NEGATIVO (sem ganho de PFS/SG, inclusive PD-L1+), motivando a retirada voluntária. É o pivô que documenta a AUSÊNCIA de benefício, coerente com a não-incorporação. — **status: a confirmar**


## Mama — Metastático — Triplo negativo / HER2 negativo

- [ ] **[Caso B] `mama-met-tnbc-bevacizumabe-nao-incorporado`** — Bevacizumabe — NÃO INCORPORADO
  - **Referência citada:** nenhuma. **Ação:** confirmar o pivô e baixar o PDF
  - **Explicação:** Protocolo nomeia os estudos (E2100/AVADO/RIBBON-1) mas não fornece citação/DOI. E2100 é o pivô mais citável.
  - **Candidato(s) de pivô (a confirmar):**
    - **E2100** — Paclitaxel plus bevacizumab versus paclitaxel alone for metastatic breast cancer (E2100)  
    Miller K, et al. N Engl J Med. 2007;357(26):2666-2676.  
    DOI: `10.1056/NEJMoa072113` · PMID: `18160686` · 2007 · [link](https://doi.org/10.1056/NEJMoa072113)  
    _Por que é o pivô:_ RCT fase III (paclitaxel±bevacizumabe) que mostrou ganho de PFS SEM ganho de SG; base da revogação FDA em 2011. Pivô que documenta ausência de benefício de desfecho duro. — **status: a confirmar**
    - **AVADO (Miles 2010, JCO) / RIBBON-1 (Robert 2011, JCO)** — AVADO / RIBBON-1 (bevacizumabe + QT em MBC 1ª linha)  
    Miles DW, 2010 / Robert NJ, 2011.  
    2010 · [link](https://pubmed.ncbi.nlm.nih.gov/?term=AVADO+RIBBON-1+bevacizumab+breast+cancer)  
    _Por que é o pivô:_ RCTs confirmatórios com o mesmo padrão (ganho de PFS sem SG); reforçam a não-incorporação. — **status: a confirmar**

