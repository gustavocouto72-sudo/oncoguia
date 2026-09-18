# Intake revisão — lote 4 + salivar (run `2026-09-17-intake-revisao-4/v1`) — PUBLICADO em 2026-09-17 (autorização por mensagem, após o commit da Rodada C)

Cópia só-dados do run ativo `2026-09-16-drivers-pulmao/v1` + `intake-lote4.py` rodado uma vez
sobre o export `revisao-decisoes.json` de 17/09/2026 (334 decisões) + `intake-salivar.py` rodado
em seguida (item D7). `RUN_ATIVO` intocado. Plano e decisões: `../../2026-09-16-lote4-plano/PLANO-lote4.md`
(§7 = D1–D7, respondidas pelo Gustavo Couto em 17/09); proposta salivar:
`../../2026-09-16-salivar-proposta/` (HANDOFF-para-lote4.md).

## Estado

- Portão A neste run: `python3 squads/mbe-oncologia/verificar_dados.py --check-dois squads/mbe-oncologia/output/2026-09-17-intake-revisao-4`
  → **exit 0** (o aviso "não é o RUN_ATIVO" é esperado). Os 2 WARN (10 tumores sem incompleto;
  ordinal em `prostata-loc-altorisco-ebrt-tda`) são os pré-existentes. [7] 304 = 253 candidatos + 51
  não incorporados. [6] os 43 DOIs de confirmado resolvem. Os 8 DOIs novos (PATTERN, BCIRG-006,
  KRISTINE, Licitra, Nakano, Hong, ASCO 5607, NRG-HN004) resolvem no Crossref (200) em 17/09.
- **304 regimes** (301 + 3 salivar). Placar: re_derivado 182 · incompleto 60 · divergencia 19 ·
  confirmado 43. Cabeça e pescoço 18 → 21 (incompleto 2 → 5).
- Relatórios: `relatorio-intake-lote4.json` (decisões humanas, política de abstract, resultado por
  decisão, triagem resolvida, expirados, re_revisao, vigilância, amostra sorteada, referências
  verificadas, abstracts lidos) e `relatorio-intake-salivar.json`.

## O que o lote 4 executou (9 pareceres de 16/09)

| Regime | Ação | Executado como | Hash |
|---|---|---|---|
| ovario-recidiva-platina-resistente-monoterapia | manter_anotar | nota; PLD já constava — sigla grafada por extenso no `nome` | intacto |
| sarcoma-ntrk-larotrectinibe-nao-incorporado | manter_anotar | nota (concorda com o card) | intacto |
| mama-adj-her2neg-act-docetaxel | manter_anotar | nota (revisor confirma a divergência); pergunta "retirar ramo N0?" em re_revisao | intacto |
| cp-cec-def-cetuximabe-rt | manter_anotar | **D6**: nota literal dos critérios (= NRG-HN004 §3.2, verificado no protocolo) + NRG-HN004 como complementar + re_revisao (regra computável, 3 primitivos desenhados em `meta.revisao_humana.primitivos_desenhados_nao_aplicados`) | intacto |
| colo-qrt-io-keynote-a18 | ajustar_elegibilidade | regra → `colo_utero ∧ figo_iii_iva ∧ pdl1_cps1` (primitivos existentes; labels ajustados); eixo mais_estreito (III–IVA = rótulo FDA/EMA; CPS≥1 = decisão do revisor) | **muda** |
| mama-adj-her2neg-carbo-paclitaxel | corrigir_referencia | **D4**: pivô PATTERN (Yu 2020, esquema idêntico, fase 3); Du 2020 (DOI do revisor; fase II, q21/AUC 5) secundário; GRADE 2C→1B; MCBS n/a→B; elegibilidade diverge→re_derivado (mais_amplo: N0 ≤10 mm); **selo divergencia→re_derivado** | **muda** (o `aprovado` de 16/09 expira — ciente) |
| mama-neo-her2pos-ct1c-tch | corrigir_referencia | **D5**: pivô BCIRG-006 (volta); KRISTINE + TRAIN-2 em `pivos`; Loibl 2017 (revisão) e BrUOG 2021 (outro esquema) como complementares; GRADE C→1B; MCBS n/a→B; elegibilidade segue diverge (cT1c sem N); selo divergencia | **muda** |
| ovario-resistente-bevacizumabe-nao-incluido | corrigir_referencia | **D2+D3**: abstract ASCO 2026 (JCO 44(16_suppl):5607; retrospectivo PSM n=149) verificado → complementar `abstract_congresso` + flag `evidencia_emergente` + vigilância; pivô AURELIA, selo e hash intactos; incorporação em 2L → re_revisao | intacto |
| cp-naso-toripalimabe-nao-incluido | refutar | **D1 caminho A**: mantido FORA; card atualizado (JUPITER-02 final OS HR 0,63; **ESMO-MCBS oficial 4 (scorecard 354) → eixo diverge do protocolo 3**; Anvisa RE 3.085 06/08/2026); `incorporacao` = motivo `custo`, `motivo_publico` política institucional, `alcada_motivo` [gestor, revisor, auditor, admin]; **selo confirmado→divergencia** | **muda** |

Registro dos 88 aprovados de 16/09 em `consolidacao.aprovacoes` (lote 4). Os 6 do pulmão (já
aplicados em 16/09) só conferidos. Dostarlimabe MSS (triagem do lote 3) intocado — segue sem resposta.

Pareceres que expiram pela execução (hash novo): A18, TCH, toripalimabe (os próprios), carbo+pacli
(o próprio **e o `aprovado` de 16/09** — D4, ciente; o revisor re-aprova).

## Salivar (D7) — `intake-salivar.py`

3 regimes inseridos como estão (`cp-salivar-met-cap`, `-carboplatina-paclitaxel`,
`-cisplatina-vinorelbina`), hashes = `meta.hashes_previstos` da proposta (189729d195cdad9b ·
78fef43af32a8ba5 · 8979b74cdff473bb). Vocabulário `cabeca-pescoco`: `tumor += glandula_salivar`
(com rótulo) + `histologia_salivar` (enum; `nao_informada` indeterminado; registrado, não
condiciona regra). 0 hashes existentes mudaram, 0 aprovações expiraram. 7 pendências de
referendo em `re_revisao`. Decisão fora do fluxo registrada em `meta.revisao_humana.salivar`.

## Código que acompanha (aplicado na publicação)

- `app-pendente/motivo-por-alcada.patch` — `app/index.html`: `INCORP_MOTIVO_META.politica_institucional`,
  `motivoNaAlcada()`, `incorporacao()` respeita `incorporacao.motivo_publico`/`alcada_motivo`/`texto_publico`
  (cache `__inc` invalida na troca de perfil), `notasRevisaoDe()` devolve vazio fora da alçada
  (as notas deste card discutem custo). Aplica limpo sobre `67da748` **e** sobre o working tree
  de 17/09 (conferido com `git apply --check`); lógica testada por perfil em node contra o dado
  do run (oncologista/secretaria → "política institucional", 0 notas; gestor/revisor/auditor/admin
  → "custo" + nota; PARP e AURELIA inalterados).
  Aplicar sexta com `git apply squads/mbe-oncologia/output/2026-09-17-intake-revisao-4/v1/app-pendente/motivo-por-alcada.patch`
  quando a árvore estiver limpa/commitada pela outra frente.
  **Limite:** a alçada é de apresentação (client-side); `evidencia.json` continua servindo o bloco
  `incorporacao` inteiro a todo perfil. Filtrar no servidor (`evidencia.service.ts`, por perfil do
  token: fora de `alcada_motivo`, remover `motivo`, `nota_revisao`, `citacao_verificada`,
  `regulatorio_br`, `esmo_mcbs_oficial` e as `notas_revisao` do card) é pendência **alocada à
  rodada do GRADE** (decisão do Gustavo Couto, 2026-09-17).
- `backend-pendente/1790208000000-AplicadaEmLote4.ts` — `aplicada_em = 2026-09-18` nos 9 pareceres
  (predicado regimen_id + acao + janela UTC de 16/09; conferido: alcança exatamente 1 linha cada no
  export). Timestamp posterior à `JustificativaSolicitante1790121600000` da outra frente. Instalar em
  `backend/src/database/migrations/` SÓ junto com a publicação (regra 4 do Portão A).

## Para publicar (sexta, por comando humano — na ordem)

1. `git status`: as mudanças da outra frente (justificativa do solicitante) commitadas ou
   reconhecidas; nunca duas sessões na área app/backend. Portão A com caminho de novo se algo
   tiver mudado neste run.
2. `RUN_ATIVO` → `2026-09-17-intake-revisao-4/v1`; `python3 app/build-data.py` (esperar 304 regimes);
   rebuild + restart do backend (3005).
3. Portão A sem caminho + `--check-dois` (Corpus = RUN_ATIVO, sem `!!! ATENÇÃO`) + amostra viva
   (PATTERN 32789480, BCIRG-006 21991949, Hong 29044862) + cheiro de placar (re_derivado 182 domina).
4. Aplicar `app-pendente/motivo-por-alcada.patch`; Portão B em browser isolado:
   - toripalimabe: como oncologista → "🚫 Não incorporado — política institucional", sem notas;
     como gestor → "custo" + nota + "Decisão de revisão clínica"; Revisão clínica mostra eixo
     ESMO-MCBS diverge (3 × 4);
   - colo III com CPS<1 → A18 🔴/🟡; CPS≥1 → verde; IB2–IIB N+ → 🔴;
   - paciente salivar metastático vê 3 cards pendentes; CEC não vê nenhum; `histologia_salivar`
     aparece com "Não informada" e não trava nada;
   - TCH mostra BCIRG-006 como pivô; carbo+pacli mostra PATTERN e selo re_derivado;
   - ovário beva com nota do revisor + nota do squad (abstract) e card ainda "não incluído";
   - consoles limpos; `portao-b.js`, `portao-simulador.js`, `portao-drivers-pulmao.js` ×2.
5. Instalar a migration; commit com paths explícitos (run + `RUN_ATIVO` + `backend/data/*` +
   migration + `app/index.html` + este README + plano + proposta salivar) → deploy backend → deploy
   app (`cd app && vercel --prod --yes`; conferir com `curl -L`) — um de cada vez, nunca junto com
   outro deploy.
6. Pós-deploy: Portão A sem caminho; `/revisao/export` mostra os 9 com `aplicada_em = 2026-09-18`;
   fila do revisor: +3 salivar em Pendente, A18/TCH/carbo+pacli/toripalimabe em Aguardando
   re-revisão; `_memory/runs.md`.

## Pendências abertas ao revisor (`re_revisao` do relatório)

ACT-docetaxel (retirar ramo N0?) · TCH (regra cT1c sem N) · cetuximabe (regra computável? janela
ClCr; PS 2/idade) · ovário beva (incorporar em 2L? evidência observacional, não publicada) ·
toripalimabe (política: custo × incorporar — caminho B no PLANO §4; Portão C: MCBS 4 × 3) · 7 do
salivar · dostarlimabe MSS (14/09, sem resposta) · 39 regimes em *Aguardando re-revisão* (+4 deste lote).

## Publicação (2026-09-17, autorizada por mensagem — "Rodada C commitou")

1. Pré-condição conferida: `9e24db1 feat(rodada-c)` no HEAD, área app/backend limpa; o que restava
   modificado era da rodada do GRADE (pipeline/docs + `verificar_dados.py` com o check [11] só para
   schema 2 — SKIP neste corpus, 304 legado). Rodada C já tinha deployado backend e app (conferido
   em produção: oncologista recebe 200 em `/importacao/vocabulario`; `justificativa_solicitante` na
   app publicada) antes dos deploys deste lote.
2. `RUN_ATIVO` → `2026-09-17-intake-revisao-4/v1`; `app/build-data.py` → 304 regimes, 265
   primitivos (264 + `histologia_salivar`). Migration `AplicadaEmLote41790208000000` instalada e
   registrada em `database.module.ts` (a lista é explícita — só copiar o arquivo não basta); rebuild
   + restart do backend: rodou no dev (0 linhas, como esperado — o dev não tem os pareceres de 16/09).
3. Portão A no ativo (sem caminho): exit 0, `Corpus` = `RUN_ATIVO`, sem `!!! ATENÇÃO`; [6] os 43 DOIs
   de confirmado resolvem; os 2 WARN pré-existentes; [11] SKIP (schema 2 ausente). Amostra viva no
   PubMed: PATTERN 32789480, BCIRG-006 21991949, Hong 29044862, JUPITER-02 38015220 — DOI do card =
   DOI do registro nos 4. Cheiro: re_derivado 182 domina.
4. Patch `app-pendente/motivo-por-alcada.patch` aplicado em `app/index.html` (aplica limpo sobre
   `9e24db1`). Portão B: `portao-b.js` 89 (tudo passou; visão "Tudo" = 304 cards) ·
   `portao-simulador.js` 50/50 · `portao-drivers-pulmao.js` 25/25 ×2 (agora lê o `RUN_ATIVO` em vez
   de fixar 301/drivers) · **`portao-lote4.js` (novo, 30 checks, somente leitura) 30/30**: A18 por
   estádio × CPS; 3 salivar 🟢 para glândula salivar metastática e 🔴 para CEC; `histologia_salivar`
   "Não informada" não trava; toripalimabe — oncologista vê "Não incorporado — política
   institucional" sem notas, revisor vê "custo" + nota (Anvisa, MCBS 4); PARP/AURELIA inalterados;
   TCH "Fonte: BCIRG-006"; carbo+pacli "Fonte: PATTERN" e selo re_derivado; ovário beva ainda
   não incluído com a nota do abstract; zero escrita; consoles limpos. Um FAIL de 429 na primeira
   rodada do drivers = limite de login (5/min), repetido após a janela: 25/25.
   Aprendizado do portão: no simulador booleano não marcado vale `false` (🔴), não 🟡 — 🟡 só
   existe para enum com `indeterminado`; "Custo 4/5" é o rótulo do eixo NCCN, presente em todo
   card — o check de alçada olha o bloco de incorporação, não o card inteiro.
5. Commit `dfc1c50` (48 arquivos, paths explícitos; a rodada do GRADE ficou intocada na árvore) →
   deploy do backend (`vercel --prod` em backend/, alias oncoguia-backend.vercel.app) → deploy da app
   (`vercel --prod` em app/, alias oncoguia-app.vercel.app; `motivoNaAlcada` presente na página publicada).
   A Rodada C já estava em produção antes (deploys dela conferidos).
6. Pós-deploy: `/evidencia` de prod = 304 regimes, fonte este run, vocabulário salivar; **`/revisao/export`
   de prod mostra os 9 com `aplicada_em = 2026-09-18`** (dia UTC do boot — 21h30 BRT), 4 em
   *Aguardando re-revisão* (A18, TCH, carbo+pacli, toripalimabe; o `aprovado` do carbo+pacli também
   expirou, como previsto) e 5 em *triada_aplicada*; dostarlimabe segue `null`. `portao-lote4.js`
   contra produção (app publicada + API, só leitura): **30/30**. Portão A sem caminho: `Corpus` =
   `RUN_ATIVO`, exit 0. O export de prod já tinha 347 decisões (13 novas desde o export 4: 3
   `triada_pendente_execucao` novas + dostarlimabe) — fila do **lote 5**.
7. Fila do revisor em prod: +3 salivar em *Pendente*; 44 em *Aguardando re-revisão* (39 anteriores
   + 4 deste lote + 1 do próprio trabalho dele).
