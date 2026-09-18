# PLANO — Intake revisão LOTE 4 (+ 3 regimes de glândula salivar)

**Status: preparação (2026-09-16/17). Nada executado.** `RUN_ATIVO` continua
`2026-09-16-drivers-pulmao/v1`; nenhum run, `backend/data` ou produção foi tocado. Esta pasta
não tem `v1/` → invisível para `build-data.py` e para o Portão A. Intake e publicação só por
comando humano (sexta, 2026-09-18, depois da demo).

Fonte: export `revisao-decisoes (4).json` (exportado 2026-09-17; 334 decisões; cópia em
scratchpad da sessão). Estados: registro 238 · triada_aplicada 47 · aguardando_re_revisao 39 ·
**triada_pendente_execucao 10** · pendente_triagem 0.

## 0. O que o export tem de novo (reconciliação)

| Data | Decisões | Situação |
|---|---|---|
| 16/09 | 103 | 88 aprovados (registro) · 6 do pulmão (`ajustar_elegibilidade`, **já aplicadas em 2026-09-16**, `hash_atual` = hash novo) · **9 pareceres novos de conteúdo** (fila deste lote) |
| 14/09 | 73 | lote 3, tudo fechado exceto **dostarlimabe MSS** (`refutar` × justificativa a favor — triagem aberta desde o lote 3; o revisor NÃO respondeu neste export → segue aberta, nada a fazer) |
| 12–13/09, 08 | 158 | lotes 1–2, fechados |

Os 6 do pulmão e os 27 do lote 2 + 9 do lote 3 têm `aplicada_em` — regra 4 do Portão A cumprida.
Nenhuma decisão do lote 4 tem hash divergente do corpus ativo (`content_hash == hash_atual` nas 10).

## 1. Referências verificadas ao vivo (Crossref · Europe PMC · PubMed · ESMO · FDA · ClinicalTrials.gov) — 2026-09-16

| Parecer | Referência fornecida | Resolve para | Achado que muda o plano |
|---|---|---|---|
| ovário beva | `asco.org/abstracts-presentations/258162` | **Sousa Filho CS et al. (A.C. Camargo, SP). J Clin Oncol 2026;44(16_suppl):5607 — DOI `10.1200/jco.2026.44.16_suppl.5607`** (ASCO 2026). Retrospectivo unicêntrico, PSM 1:2, n=149 | Números do revisor CONFEREM com o abstract (PFS 7,79 vs 4,37, HR 0,49; OS 23,06 vs 10,45, HR 0,47; rechallenge OS HR 0,54, p=0,09). É **abstract de congresso, retrospectivo** — não pode virar pivô no lugar do AURELIA (fase 3). |
| colo A18 | (sem referência nova) | KEYNOTE-A18: Lorusso, Lancet 2024;403:1341 (PFS, PMID 38521086) e Lancet 2024 (OS, PMID 39288779). **FDA 12/01/2024 restringiu a FIGO 2014 III–IVA** porque IB2–IIB N+ teve PFS HR 0,91 (0,63–1,31) vs III–IVA HR 0,59 (0,43–0,82) | Restrição por estádio = rótulo regulatório (FDA/EMA). Restrição por **CPS ≥1 é além do rótulo**: CPS<1 foi ~5% do ensaio (n≈50), benefício não avaliável — decisão clínica do revisor, computável (`pdl1_cps1` já existe). |
| cetuximabe-RT | (critérios em texto) | **NRG-HN004** (NCT03258554, protocolo v. 09/03/2022, §3.2): contraindicação a cisplatina = ClCr >30 e <60 mL/min (Cockcroft-Gault) **ou** neuropatia periférica pré-existente grau ≥1 **ou** perda auditiva (uso de aparelho ou queda ≥25 dB em 2 frequências contíguas) **ou** PS 2 **ou** ≥70 anos c/ comorbidade | Os 3 critérios do revisor são **transcrição literal** do NRG-HN004 (faltam PS 2 e idade/comorbidade, que o texto do protocolo institucional já cita). Fonte para a nota. |
| toripalimabe | (números em texto) | **JUPITER-02 final OS — Mai HQ, JAMA 2023;330:1961 (PMID 38015220)** = o pivô que o card JÁ cita (DOI reparado em 07/22). Abstract: seguimento 36 m, OS HR 0,63 (0,45–0,89), p=0,008, mediana NR vs 33,7 m; benefício consistente em PD-L1 alto e baixo. Taxas 1/2/3 anos (90,9/87,1 · 78,0/65,1 · 64,5/49,2%) confirmadas no corpo do artigo via dossiê WHO EML 2025 | **ESMO-MCBS scorecard 354 (v2.0, atualizado 02/07/2025): score final 4**, Form 2a, desfecho avaliado OS (Nat Med 2021 + JAMA 2023) — o revisor está certo; o card diz 3 (concorda c/ protocolo) e a justificativa de GRADE fala em "SLP modesto": **o card contradiz a própria referência**. **Anvisa: Zytorvi (toripalimabe), Dr. Reddy's, registro novo por RE 3.085, DOU 06/08/2026** (O Tempo 07/08/2026; TribeMD) — página gov.br não lida diretamente. Card também diz "PD-L1+" no texto do protocolo; o ensaio foi all-comers. |
| NTRK | (sem referência) | — | Nota concorda com o card (GRADE 2C, evidência não randomizada). |
| ACT-docetaxel | (sem referência) | — | Revisor **confirma** a divergência apontada pelo squad (ramo N0 de alto risco não coberto por PACS 01/B-28/CALGB 9344; FEC ≠ AC). Não diz se retira o ramo. |
| TCH | PMID 27939064; DOI 10.1007/s10549-021-06266-9; PMID 29175149 | **27939064 = Loibl & Gianni, Lancet 2017 — Seminar (revisão)**, não BCIRG-006. **s10549-021-06266-9 = Lopresti 2021, BCRT — BrUOG fase II, paclitaxel semanal + carbo + trastuzumabe + pertuzumabe** (bloqueio duplo, paclitaxel), n=30, pCR 77%. **29175149 = KRISTINE (Hurvitz, Lancet Oncol 2018) ✓** — TCHP ×6 vs T-DM1+P, neoadjuvante, EC II–III | Nenhuma das 3 é o TCH (bloqueio simples) neoadjuvante. O ensaio do TCH que o revisor descreve é o **BCIRG-006 (Slamon, NEJM 2011; DOI 10.1056/NEJMoa0910383, PMID 21991949) — que é a `referencia_anterior` do próprio card**, trocada por TRAIN-2 a pedido dele em 08/18. Abstract confere: n=3.222, DFS 5 a 81% (TCH) vs 84% (AC-TH) vs 75% (AC-T); OS 91/92/87%; menos cardiotoxicidade. TRYPHAENA (citado) não foi enviado. |
| carbo+pacli | DOI 10.1007/s10549-020-05648-9 | **Du F et al., BCRT 2020;182:67 (PMID 32394350)** — fase **II** randomizado de não-inferioridade, n=308, TNBC adjuvante: **TP = docetaxel 75 ou paclitaxel 175 D1 + carboplatina AUC 5 D1, q21 ×6** vs EC×4→T×4; DFS 5 a 84,4 vs 85,8% (não-inferior); OS 93,5 vs 94,4% | Tema certo, **esquema diferente** do card (que é paclitaxel 80 + carbo AUC 2 D1,8,15 q28 ×6) e é fase II, não "fase III". O ensaio que bate **exatamente** com o esquema do card é o **PATTERN — Yu KD et al., JAMA Oncol 2020 (DOI 10.1001/jamaoncol.2020.2965, PMID 32789480)**: fase 3, n=647, TNBC operável adjuvante (N+ ou N0 >10 mm), PCb vs CEF-T, DFS 5 a 86,5 vs 80,3% (HR 0,65; p=0,03), OS HR 0,71 (NS). |
| ovário mono (PLD) | (sem referência) | — | **PLD já está no card**: nome "Monoterapia (topotecano / PLD / gemcitabina / docetaxel)" e esquema "doxorrubicina lipossomal peguilada 40 mg/m²". O revisor provavelmente não reconheceu a sigla. |

## 2. Como o selo lida com abstract de congresso (proposta de política — confirmar)

Hoje o corpus não distingue abstract de artigo: o DOI de suplemento (`10.1200/JCO.<ano>.<vol>.16_suppl.<n>`)
resolve no Crossref e passa no `--check-dois` como qualquer outro. Precedentes: RUBY-TFST (ASCO 2025)
verificado e **não** incorporado (lote 3); DeLLphi-304 (artigo completo) entrou como
`referencias_complementares` sem mexer em selo/hash. Proposta, para valer deste lote em diante:

1. **Abstract nunca é pivô** (`referencia.doi`) e **nunca re-deriva eixo**: ESMO-MCBS só pontua
   publicação revisada por pares (regra da própria ESMO); GRADE de abstract seria no mínimo
   rebaixado por relato incompleto. Se o parecer pedir `corrigir_referencia` com abstract, o
   intake **não troca** — vira `triagem_manual` com balde proposto (abaixo).
2. Entra em `consolidacao.referencias_complementares[]` com campos novos:
   `tipo: "abstract_congresso"`, `congresso` ("ASCO 2026"), `desenho` (RCT/retrospectivo/PSM…),
   `verificado_em`, `status_publicacao: "aguardando_periodico"`.
3. Flag visível no card: `evidencia_emergente: <congresso ano> — abstract (<desenho>, n=…); não altera
   selo nem eixos; reavaliar quando publicado`. A app já mostra flags; não precisa de código.
4. **Selo e hash intactos** (referências complementares ficam fora do `content_hash`) → o parecer
   não expira sozinho. Por isso a vigilância é explícita: item em `meta.revisao_humana.vigilancia[]`
   `{regimen_id, doi_abstract, gatilho: "publicação em periódico", aberto_em}`. Quando publicar,
   vira `corrigir_referencia` normal num lote seguinte.
5. Portão A (proposta para `verificar_dados.py`, não para sexta): WARN se `referencia.doi` de
   qualquer regime contiver `_suppl` (abstract como pivô).
6. Retrospectivo + abstract (caso do ovário): mesmo publicado, não destrona um fase 3 — no máximo
   contexto. A pergunta de incorporação é política, não de dado.

## 3. Triagem dos 9 pareceres

Legenda: **E** = executável direto · **P** = precisa de primitivo/mecânica nova · **H** = decisão humana.
"Hash" = se o `content_hash` muda (e portanto se pareceres do regime expiram).

| # | Regime | Ação registrada | Classe | O que o intake faz | Hash | Selo |
|---|---|---|---|---|---|---|
| 1 | `ovario-recidiva-platina-resistente-monoterapia` | manter_anotar | **E** | Nota do revisor no card + `nota_squad` "PLD = doxorrubicina lipossomal peguilada, já consta no esquema"; **grafar por extenso no `nome`** (campo fora do hash) para a sigla não confundir de novo. | não | re_derivado (mantém). Aprovação de 14/09 continua válida. |
| 2 | `sarcoma-ntrk-larotrectinibe-nao-incorporado` | manter_anotar | **E** | Nota incorporada (concorda com GRADE 2C e não-incorporação); flag `nota_revisor:` curta. | não | confirmado (mantém) |
| 3 | `mama-adj-her2neg-act-docetaxel` | manter_anotar | **E** + pergunta | Nota do revisor (que **confirma** a análise do squad). Eixo elegibilidade segue `diverge` (ramo N0 de alto risco = extrapolação). `re_revisao`: "retirar o ramo `alto_risco_tumoral` (ajustar_elegibilidade → selo vira re_derivado) ou mantê-lo como extensão clínica documentada (eixo passa a `decisao_revisor`, mais_amplo explícito, como abiraterona no lote 2)?" | não | divergencia (mantém) |
| 4 | `cp-cec-def-cetuximabe-rt` | manter_anotar | **E** (literal) + **P** (se quiser computável) | Ação diz manter_anotar, texto pede "acrescentar critérios para aprovar o paciente" = pedido embutido de elegibilidade (precedente FOLFOX-NEC, lote 3). **Recomendo executar literal**: nota com os 3 critérios + `nota_squad` "transcrição do NRG-HN004 §3.2 (ClCr >30 e <60; aparelho auditivo ou ≥25 dB em 2 freq. contíguas; neuropatia ≥G1); o ensaio ainda lista PS 2 e ≥70 a c/ comorbidade" + flag `pedido_embutido_nao_executado` + `re_revisao`. Se o humano preferir computável já: 3 primitivos novos em `cabeca-pescoco` — `clearance_creatinina` (numérico, mL/min), `perda_auditiva_clinica` (bool; label = definição NRG), `neuropatia_grau` (ordinal 0–4) — e critério nomeado `inelegivel_cisplatina_criterios = clcr<60 ∨ perda_auditiva ∨ neuropatia≥1 ∨ inelegivel_cisplatina` (o booleano existente fica como "outro motivo" para PS/idade/cardio). | não (literal) / sim (computável) | re_derivado |
| 5 | `colo-qrt-io-keynote-a18` | ajustar_elegibilidade | **E** | Regra → `tumor=colo_utero ∧ estadio_iii_iv_locavancado ∧ pdl1_cps1=true`; label do primitivo de estádio explicitado "FIGO 2014 III–IVA (localmente avançado)". Eixo elegibilidade re-derivado: `mais_estreito` que o ensaio (que incluiu IB2–IIB N+ e CPS<1) — direção segura; estádio = rótulo FDA/EMA; CPS ≥1 = decisão do revisor além do rótulo (CPS<1 ~5% do ensaio, HR não estimável). `elegibilidade_protocolo` intocado (diz III e IV). | **sim** (regra + eixo) | re_derivado (mantém). O próprio parecer expira pela execução (como ASCENT); recebe `aplicada_em`. |
| 6 | `mama-adj-her2neg-carbo-paclitaxel` | corrigir_referencia | **E com escolha de pivô** (confirmar) | O DOI do revisor (Du 2020) é fase II q21 com AUC 5 — esquema ≠ card. **Proposta: pivô = PATTERN (Yu 2020, JAMA Oncol) — esquema idêntico, fase 3 —, Du 2020 em `referencia.pivos[]` como secundário (não-inferioridade, esquema q21)**; CALGB 40603 vai para `referencia_anterior`. Re-derivar: GRADE 2C → **1B** (RCT fase 3, DFS primário positivo, OS NS, aberto, população chinesa), ESMO-MCBS n/a → **Form 1 (curativo): B** (DFS HR 0,65 sem OS — a confirmar na execução), elegibilidade `diverge` → `re_derivado` com `amplitude: mais_amplo` (regra admite N0 ≤10 mm, que o PATTERN excluiu) + flag. Cenário passa a bater (adjuvante). | **sim** | divergencia → **re_derivado** |
| 7 | `mama-neo-her2pos-ct1c-tch` | corrigir_referencia | **E com escolha de pivô** (confirmar) | As 3 refs do revisor não são o TCH (revisão; BrUOG paclitaxel+HP; KRISTINE TCHP). O ensaio que ele descreve é o **BCIRG-006 = `referencia_anterior`**. **Proposta: pivô volta a BCIRG-006 (verificado), `pivos[]`: KRISTINE (TCHP neoadjuvante, verificado) + TRAIN-2 (neoadj., bloqueio duplo — fica como secundário, não some)**; Loibl 2017 e BrUOG 2021 em `referencias_complementares` (contexto). Re-derivar: GRADE C → **1B** (RCT fase 3 adjuvante com DFS+OS; −1 por indireção de cenário neoadj.), MCBS → **Form 1: A** (a confirmar), elegibilidade **segue `diverge`**: BCIRG-006 exigiu N+ ou N0 de alto risco (>2 cm, RH−, G2–3, <35 a); KRISTINE T≥2 cm ou N+; a regra `cT1c` sem N admite cT1 N0 sem fator de risco. Corrige a contradição interna do card ("validado apesar de não ter estudo"). | **sim** | divergencia (mantém — só elegibilidade) |
| 8 | `ovario-resistente-bevacizumabe-nao-incluido` | corrigir_referencia (abstract ASCO 2026) | **triagem** (balde ≠ ação) + **H** na pergunta de incorporação | Não trocar pivô (§2). **Balde proposto: manter_anotar + referência complementar `abstract_congresso` (Sousa Filho 2026, retrospectivo PSM n=149, unicêntrico BR) + flag `evidencia_emergente` + vigilância.** `re_revisao` ao revisor: "considerar em 2ª linha platino-resistente" = pedido de incorporação de um não-incluído — decisão de política (mesmo trilho do toripalimabe, evidência bem mais fraca); o squad não decide. | não | confirmado (mantém) |
| 9 | `cp-naso-toripalimabe-nao-incluido` | refutar | **H — DECISÃO HUMANA (Gustavo + revisor)** | Contradição interna igual à do dostarlimabe: ação `refutar` (= manter fora) × texto "não colocar como não incorporada / discutir". Refutar nunca é executado por dedução; **nada roda sem decisão**. Ver §4. | depende | depende |

Amostra/portão: itens 5, 6, 7 exercitam Crossref+PubMed nos DOIs novos (PATTERN, BCIRG-006, KRISTINE) — os
3 já resolveram hoje. Item 8 exercita a política de abstract (§2).

## 4. Toripalimabe — o que está em jogo e os dois caminhos prontos

Fatos verificados (§1): o pivô do card (JAMA 2023) é a análise final com **OS positiva**; ESMO-MCBS
oficial = **4** (scorecard 354, jul/2025); **Anvisa registrou Zytorvi em 06/08/2026**. O card hoje diz
"SLP modesto, MCBS 3, não incluído" — desatualizado em dois eixos e na base regulatória. O que fica
de motivo é **custo** (o revisor mesmo diz "discutir devido a custo caro"); o protocolo institucional
2025 não o inclui.

**Caminho A — manter fora, atualizar a verdade do card** (executável no lote 4, sem primitivo novo):
- eixo ESMO-MCBS re-derivado 4 com `afirmado_protocolo` 3 → `diverge` (visível; Portão C decide);
  GRADE 1A mantido com justificativa reescrita (OS final); `beneficio` reescrito (OS HR 0,63…);
  flag `nao_incluido:` reescrita para "custo (registro Anvisa 08/2026; MCBS 4; OS positiva)";
  `regulatorio_br: Anvisa RE 3.085 06/08/2026` como flag; nota do revisor no card.
- Consequência: hash muda; selo **confirmado → divergencia**; card continua em "Avaliados — não
  incorporados". `re_revisao`: "motivo passa a custo? pedir incorporação?".

**Caminho B — incorporar** (precisa de mecânica nova: não há precedente de não-incluído virando vigente):
- A app deriva "não incorporado" do sufixo do id / flag `nao_incluido:` / nome → o card atual não
  pode "virar" incorporado; nasce **regime novo** `cp-naso-met-1l-toripalimabe-gp` (toripalimabe
  240 mg + gemcitabina + cisplatina q21 ×6 → manutenção até 2 a; regra `tumor=nasofaringe ∧
  metastatico` — sem PD-L1, como o ensaio), selo re_derivado, `rederivado_aguarda_revisao` (nasce
  pendente, vira vigente só com autorização — política de seleção já vigente).
- O card `-nao-incluido` precisa de destino: proposta = **novo estado `incorporacao.status:
  "incorporado_por_revisao"` + `substituido_por`**, sai do consolidado publicado? Não — `excluir` é
  só para erro. Melhor: fica no consolidado com o novo estado e a app o esconde da seção de não
  incorporados (**código de app novo**, pequeno, em `incorporacao()`), preservando a trilha.
- Consequências: +1 regime, +1 pendente na fila, deploy de app. Decisão fora do fluxo registrada
  (canal/decidido_por/texto/efeito), como cabozantinibe e salivar.

Recomendação do squad: **A no lote 4** (corrige erro factual do card hoje, sem decidir política);
**B só com a palavra do revisor e do Gustavo**, e aí como pacote próprio (pode ser no mesmo run se
a decisão vier antes de sexta).

## 5. Os 3 regimes de glândula salivar (proposta pronta em `../2026-09-16-salivar-proposta/`)

Já verificados e propostos pela sessão paralela (PROPOSTA-salivar.md, §2–§7): `cp-salivar-met-cap`
(Licitra 1996 / Dreyfuss 1987; Laurie 2011 = RS, contexto), `cp-salivar-met-carboplatina-paclitaxel`
(Nakano 2016, retrospectivo, dose `null`), `cp-salivar-met-cisplatina-vinorelbina` (Hong 2018 +
Airoldi 2001). Vocabulário `cabeca-pescoco`: `tumor += glandula_salivar`, `histologia_salivar` novo
(registrado, não condiciona). 0 hashes existentes mudam, 0 aprovações expiram, 0 código de app.
Nascem `incompleto` / pendentes (+3 na fila). 7 pendências de referendo já listadas lá.

Encaixe: **mesmo run, script separado** (§6). O vocabulário de `cabeca-pescoco` é tocado pelos dois
lotes só se o item 4 for computável — por isso o salivar roda **depois** do lote 4 e re-lê o arquivo.

## 6. Roteiro do intake (sexta, por comando humano — não executar antes)

1. `git status` limpo (a pasta salivar e esta são untracked — ok); sessão única na área app/backend.
2. Copiar (só dados) `2026-09-16-drivers-pulmao/v1` → `2026-09-17-intake-revisao-4/v1`; colocar o
   export 4 como `revisao-decisoes.json` do run.
3. `intake-lote4.py` (a escrever, a partir do `intake-lote3.py`): asserts de reconciliação (10
   pendentes = 9 + dostarlimabe intocado; 6 pulmão com `aplicada_em`; hashes conferem), `VERIFICADAS`
   com as transcrições da §1, executa itens 1–7 conforme a §3 e as decisões da §7, item 8 pelo
   balde confirmado, item 9 pelo caminho decidido; `relatorio-intake-lote4.json` (placar, rehash,
   expirados, re_revisao, triagem, vigilância, amostra sorteada).
4. `intake-salivar.py` (a escrever a partir de `gerar-proposta.py`) sobre o mesmo run: vocabulário +
   3 regimes + `meta` (`regimes_novos`, `decisao_fora_do_fluxo`, `pendencias_referendo`).
5. Consequências previstas: **301 → 304 regimes** (305 se caminho B). Hashes que mudam: A18,
   carbo+pacli, TCH (+ toripalimabe se A; + cetuximabe se computável). Pareceres que expiram:
   **o `aprovado` de 16/09 do carbo+pacli** (mesmo dia, mesmo hash da crítica — esperado, ele
   re-aprova) e os próprios pareceres executados dos itens 5–7 (mecânica ASCENT). Placar previsto:
   divergencia 19 → 18 (carbo+pacli sai) [→ 19 se toripalimabe A]; incompleto 57 → 60 (salivar);
   confirmado 44 → 43 se A.
6. Portão A com caminho (esperar `!!! ATENÇÃO`) + `--check-dois`; `content-hashes.json` regravado.
7. `RUN_ATIVO` → run novo; `app/build-data.py`; backend rebuild+restart (3005); Portão A sem caminho +
   amostra viva (PATTERN, BCIRG-006, KRISTINE, Hong 2018); cheiro de placar (re_derivado domina).
8. Portão B em browser isolado: paciente de colo III com CPS<1 fica 🔴/🟡 na A18 e CPS≥1 verde;
   paciente salivar metastático vê 3 cards pendentes e CEC não vê nenhum; card do TCH mostra
   BCIRG-006 como pivô e os `pivos`; ovário beva mostra flag `evidencia_emergente`; toripalimabe
   conforme o caminho; consoles limpos; `portao-b.js`, `portao-simulador.js`, `portao-drivers-pulmao.js`
   (paridade app×servidor) ×2.
9. Migration `AplicadaEmLote4` (backfill por `regimen_id` + `acao` + janela `criado_em` 16/09) para
   os pareceres executados — salivar não tem parecer na Mesa (nada a marcar). Se caminho B ou item
   4 computável: gravar antes em produção o parecer próprio do revisor (precedente Fase A do pulmão).
10. Commit com paths explícitos (run + `RUN_ATIVO` + `backend/data/*` + migration + READMEs) → deploy
    backend (+ app só se caminho B) → Portão A/B contra produção (leitura) → fila do revisor conferida
    (+3 pendentes salivar, +expirados) → `_memory/runs.md`.

## 7. Decisões que precisam de você (Gustavo) antes de sexta

| # | Decisão | Recomendação do squad |
|---|---|---|
| D1 | **Toripalimabe**: caminho A (manter fora, atualizar card, MCBS 4 diverge) ou B (incorporar: regime novo + código de app) — com o revisor | A agora; B como pacote próprio quando o revisor e você decidirem |
| D2 | **Política de abstract de congresso** (§2): aprovar para valer neste lote | aprovar |
| D3 | **Ovário beva**: confirmar balde (manter_anotar + complementar + vigilância) em vez de trocar o pivô; pergunta de incorporação vai ao revisor | confirmar |
| D4 | **Carbo+pacli**: PATTERN como pivô, Du 2020 como secundário (o DOI do revisor é outro esquema) | confirmar |
| D5 | **TCH**: BCIRG-006 volta como pivô; KRISTINE + TRAIN-2 em `pivos`; refs do revisor como contexto | confirmar |
| D6 | **Cetuximabe-RT**: nota literal + re_revisao, ou computável já (3 primitivos novos, hash muda) | literal; primitivos prontos para o lote 5 se o revisor confirmar |
| D7 | **Salivar** no mesmo run, script separado, depois do lote 4 | sim |

Abertos para o **revisor** (vão em `re_revisao` do relatório): ACT-docetaxel (retirar ramo N0?), TCH
(regra cT1c sem N), cetuximabe (critérios computáveis?), ovário beva (incorporar em 2ª linha?),
toripalimabe (motivo custo / incorporar?), dostarlimabe MSS (segue sem resposta desde 14/09), +
7 pendências salivar, + 39 regimes em *Aguardando re-revisão* (14 do pulmão).

## 8. Execução montada (2026-09-17) — decisões D1–D7 recebidas

Run candidato `2026-09-17-intake-revisao-4/v1` criado e rodado (lote 4 + salivar), Portão A com
caminho exit 0, 304 regimes. Migration e patch da app preparados dentro do run (`backend-pendente/`,
`app-pendente/`), não instalados. Roteiro de sexta: `README-lote4.md` do run. `RUN_ATIVO` intocado.
