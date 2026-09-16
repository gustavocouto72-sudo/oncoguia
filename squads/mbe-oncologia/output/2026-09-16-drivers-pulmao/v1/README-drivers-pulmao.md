# Ajuste dos drivers de pulmão (run `2026-09-16-drivers-pulmao/v1`) — EXECUTADO EM DEV em 2026-09-16, NÃO publicado

Cópia (só dados) do run ativo `2026-09-15-intake-revisao-3/v1` + `intake-drivers-pulmao.py` rodado
uma vez. Origem: decisão clínica do revisor Gustavo Drummond Pinho Ribeiro (WhatsApp, 16/09/2026,
transmitida por Gustavo Couto) + adendo do escamoso; proposta técnica (Fase B) aprovada integralmente
em 16/09/2026. **Não veio pelo export da Mesa**: os pareceres da Fase A (6 regimes,
`ajuste_solicitado/ajustar_elegibilidade`) ainda serão gravados em produção com a mesma origem —
gravar ANTES de publicar este run, para a trilha ler "aprovado 14/09 → ajuste 16/09 → corpus muda →
re-revisão".

## O que mudou

- **Vocabulário de `pulmao-nsclc`** (17 → 14 campos): sai `egfr_alk, egfr_mutado, egfr_negativo,
  egfr_exon20, alk_positivo, ros1_positivo, mutacao_acionavel`; entra `histologia`
  {nao_escamoso, escamoso}, `egfr_status` {nao_testado, negativo, mutado_sensibilizante,
  mutado_exon20, mutado_outra}, `alk_status` e `ros1_status` {nao_testado, negativo, rearranjado}.
  Todos `estavel:true` (seção "Biologia molecular"), com `rotulos` (apresentação) e
  `indeterminado: ["nao_testado"]` — o motor trata o token como não informado → 🟡, nunca verde.
  `nao_testado` é a primeira opção = default do simulador; `nao_escamoso` idem (o lado que exige mais).
- **Critério nomeado do tumor** `drivers_negativos_ou_escamoso` = `histologia=escamoso ∨
  (egfr∧alk∧ros1 = negativo)`, definido em `elegibilidade.criterios` dos regimes que o referenciam
  (CheckMate 816, KEYNOTE-671, IMpower010, KEYNOTE-024).
- **14 regras reescritas** (6 de conteúdo + 8 só de vocabulário; texto-fonte `elegibilidade_protocolo`
  intocado) — antes/depois em `relatorio-intake-drivers-pulmao.json`. PACIFIC ficou inline e fiel ao
  texto (`escamoso ∨ egfr_status=negativo`).
- **KEYNOTE-189/407 separados**: `nsclc-met-io-qt-pdl1baixo` fica com o KEYNOTE-189 (não-escamoso,
  pemetrexede + platina, drivers negativos); nasce `nsclc-met-io-qt-pdl1baixo-escamoso` = KEYNOTE-407
  (escamoso, carboplatina + (nab-)paclitaxel, sem drivers), referência verificada no Crossref + PubMed
  (Paz-Ares, NEJM 2018;379:2040-51, PMID 30280635), benefício e PFS 6,4 m transcritos do abstract;
  GRADE/ESMO-MCBS transcritos da derivação já existente do squad para o componente 407.
- **Consequências**: 301 regimes; 14 hashes mudaram (exatamente os previstos; nenhum fora do lote);
  14 aprovações de 14/09 expiram (voltam a `pendente_re_revisao` em produção); 2 selos
  `confirmado → re_derivado` (MARIPOSA, PAPILLON — eixo elegibilidade re-derivado; o intake nunca
  reatribui `confirmado`); 407 nasce `re_derivado` e pendente na fila.

## Código que acompanha (árvore de trabalho, não commitado)

- `app/index.html`: `_indet()` no `evalExpr`/`firedLeaves`/`missingFields` (token indeterminado →
  null); `optLabel()` (rótulo de opção declarado no dado) nos 4 widgets, na importação e nos chips;
  `or` já satisfeito não lista "faltam".
- `backend/src/evidencia/semaforo.ts`: mesma mudança (`indet`, `optLabel`, `or` curto-circuito);
  `evidencia.service.ts`: `/importacao/vocabulario` passa `indeterminado` e `rotulos`.
- `scripts/portao-drivers-pulmao.js` (novo, 25 checks, somente leitura).

## Portões (DEV, 2026-09-16)

- Portão A no candidato (com caminho): exit 0, `!!! ATENÇÃO` esperado. Com `RUN_ATIVO` apontado
  para este run na árvore: `Corpus` = `RUN_ATIVO`, exit 0, zero órfãos, agregado × fatia idênticos,
  [6] todos os DOIs de confirmado resolvem; os 2 WARN são os pré-existentes do lote 3.
- Amostra viva: KEYNOTE-024 (PMID 27718847), KEYNOTE-189 (29658856), KEYNOTE-407 (30280635) — DOI +
  frase de elegibilidade do abstract conferidas; CheckMate 816, KEYNOTE-671, PACIFIC, IMpower010
  resolvem no Crossref para o estudo certo.
- Tabela de verdade do `semaforo.ts` compilado: 20 casos, todos conforme (não testado → 🟡; positivo →
  🔴; escamoso → passa; 407/189 por histologia; FLAURA por `mutado_sensibilizante`).
- `portao-b.js` 89/89 ×2 · `portao-importacao.js` 74/74 ×2 (sequenciado com a sessão `oncoguia-6d`,
  que dividia o banco de dev) · `portao-simulador.js` 50/50 ×2 · `portao-drivers-pulmao.js` 25/25 ×2
  (inclui paridade app × servidor em 30 combinações e zero escrita no simulador). Limpeza provada
  pelos próprios portões.
- Avaliações antigas em DEV: 0 de pulmão, 0 snapshots com campo aposentado (conferido antes).

## Para publicar (comando humano, sequenciado DEPOIS do deploy da importação)

1. Fase A gravada em produção (6 pareceres) — antes deste passo.
2. Commit: run + `RUN_ATIVO` + `backend/data/*` + código acima + este README.
3. Deploy do backend (evidencia.json novo + semaforo.ts) e deploy do app (motor) — o motor é
   retrocompatível (só age quando a spec declara `indeterminado`/`rotulos`), então a ordem entre os
   dois não importa; mas **não** junto com outro deploy.
4. Portão A sem caminho + `portao-drivers-pulmao.js` apontando para produção (`PORTAO_API`) só em
   leitura; conferir na Mesa: 14 em *Aguardando re-revisão*, 407 em *Pendente*.
5. Regra 4 do Portão A (`aplicada_em`): quando os pareceres da Fase A existirem, migration de
   backfill por `regimen_id` + `acao=ajustar_elegibilidade` + janela de `criado_em` (16/09) → só
   depois de publicado.

## Pendências de referendo do revisor (anotadas nos pareceres e no `meta.revisao_humana`)

ROS1 nos metastáticos (024/189 excluíram só EGFR/ALK) · ROS1/ALK nos curativos (816/671 herdam o
critério único; PACIFIC só EGFR) · 407 mantém `pdl1_alto=false`? (o ensaio incluiu qualquer PD-L1) ·
PACIFIC sem `pdl1_pos` na regra · `mutado_outra` em FLAURA/ADAURA (hoje 🔴) · card mono cita
"EMPOWER-Lung 3" (é o de combinação; mono é o 1).
