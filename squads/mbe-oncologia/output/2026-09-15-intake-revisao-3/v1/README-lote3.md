# Intake revisão — lote 3 (run `2026-09-15-intake-revisao-3/v1`) — PUBLICADO em 2026-09-15

Cópia do run ativo `2026-09-13-intake-revisao-2/v1` + `intake-lote3.py` rodado uma vez
sobre o export `revisao-decisoes.json` de 15/09/2026 (231 decisões). `RUN_ATIVO` intocado.

## Estado

- Portão A neste run: `python3 squads/mbe-oncologia/verificar_dados.py --check-dois squads/mbe-oncologia/output/2026-09-15-intake-revisao-3`
  → **exit 0** (o aviso "não é o RUN_ATIVO" é esperado: valida o run candidato de propósito).
  Os 2 WARN (10 tumores sem incompleto; ordinal em `prostata-loc-altorisco-ebrt-tda`) são
  idênticos no run ativo — pré-existentes.
- 300 regimes (295 + 4 novos de HT isolada + o de pênis do lote 2). Placar: re_derivado 178 ·
  incompleto 57 · confirmado 46 · divergencia 19.
- Relatório completo: `relatorio-intake-lote3.json` (placar, resultado por decisão, triagem,
  expirados, amostra sorteada, re_revisao, verificação do DeLLphi-304).

## O que falta para fechar (na ordem)

1. Frente da secretária libera o backend.
2. Humano autoriza a publicação.
3. `RUN_ATIVO` → `2026-09-15-intake-revisao-3/v1`; `python3 app/build-data.py`; restart do
   backend (porta 3005); Portão A sem caminho + Portão B (fluxos: card com nota do revisor,
   4 regimes novos de mama HR+ na lista e no simulador, ASCENT com eixo diverge).
4. Migrations de `aplicada_em` (`backend-pendente/`): a do lote 2 pode ir antes (lote 2 já
   está no ar); a do lote 3 só JUNTO com a publicação deste run.
5. Só depois disso o intake do lote 3 conta como concluído (regra 4 do Portão A).

## Publicação (2026-09-15, autorizada por mensagem)

1. `RUN_ATIVO` → `2026-09-15-intake-revisao-3/v1`; `app/build-data.py` → 300 regimes, 267
   primitivos, fonte = este run.
2. Portão A no ativo (sem caminho): exit 0, sem `!!! ATENÇÃO`, placar re_derivado 178 ·
   incompleto 57 · confirmado 46 · divergencia 19; **[6] os 46 DOIs de confirmado resolvem no
   Crossref**; os 2 WARN são os pré-existentes.
3. Portão B: `portao-b` 89 (tudo passou) + fluxos deste README clicados em browser isolado:
   4 regimes novos de mama HR+ no simulador **e** na lista de protocolos de um paciente de
   mama; ASCENT com eixo ESMO-MCBS = diverge na tela; card do tarlatamabe (pulmao-sclc) com a
   nota "manter e anotar · 2026-09-14" na Revisão clínica; consoles limpos.
4. Migrations de `aplicada_em` instaladas em `backend/src/database/migrations/` (os dois
   arquivos de `backend-pendente/`, timestamps mantidos — livres depois da
   `PerfilSecretaria1789430400000`). Blocos A **e** B do lote 2 incluídos por decisão humana.
   - No **dev** (branch sem os pareceres de 12–14/09): lote 2 alcança 0, lote 3 alcança as 2
     de 16/08 (ht-isolada, ascent) → `aplicada_em = 2026-09-15`. Mecânica confirmada.
   - Sobre o **export de produção** deste run (231 decisões), os mesmos predicados alcançam
     **27/27** (lote 2: 17 + 10, exatamente uma linha cada) e **9/9** (lote 3). A única
     crítica que fica sem `aplicada_em` é `endometrio-met-dostarlimabe-mss-nao-incluido`
     (refutar, 14/09) — triagem_manual, fila de trabalho de verdade.
5. Deploy do backend (evidencia.json novo + as duas migrations no boot). App não muda.

**Decisões que recebem `aplicada_em` (regra 4 do Portão A):** lote 2 → `2026-09-13` nas 27
listadas em `1789603200000-AplicadaEmLote2.ts` (blocos A e B); lote 3 → `2026-09-15` nas 9
listadas em `1789689600000-AplicadaEmLote3.ts`. Pendências abertas ao revisor: `re_revisao`
e `triagem_manual` em `relatorio-intake-lote3.json`.
