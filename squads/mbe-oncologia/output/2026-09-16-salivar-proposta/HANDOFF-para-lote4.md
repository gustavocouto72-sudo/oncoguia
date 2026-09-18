# HANDOFF — salivar → sessão do lote 4 (item D7), 2026-09-17

**Decisão do Gustavo Couto (17/09):** uma mão só. A sessão do lote 4 aplica os 3 regimes de
glândula salivar como item **D7**, no **mesmo run** de sexta (`2026-09-18-intake-revisao-4/v1`),
em **sequência, depois** do `intake-lote4.py`, com script separado. A sessão que preparou a proposta
(`oncoguia-2d`) encerrou; ninguém mais mexe nesta pasta.

## O que está aprovado (17/09, "como está")
- `regimes-propostos-salivar.json` — `regimes[]` = os 3 regimes já no formato do corpus, prontos
  para inserir sem edição: `cp-salivar-met-cap`, `cp-salivar-met-carboplatina-paclitaxel`,
  `cp-salivar-met-cisplatina-vinorelbina`. `meta.vocabulario_cabeca_pescoco` = a opção
  `glandula_salivar` no enum `tumor` + o campo `histologia_salivar` (definição completa, com
  `indeterminado`/`rotulos`; registrado, NÃO condiciona regra). `meta.decisao_fora_do_fluxo` =
  registro no formato do precedente cabozantinibe. `meta.referencias_verificadas`,
  `meta.pendencias_referendo` (7) e `meta.hashes_previstos` prontos para o `meta.revisao_humana`
  do run.
- `gerar-proposta.py` — gera esse JSON e confere contra o run ativo (ids livres, vocabulário,
  hash calculável via `bd.content_hash`, nenhuma regra existente de C&P dispara para
  `glandula_salivar`). Reaproveitar as asserts no `intake-salivar.py`.
- `PROPOSTA-salivar.md` — §7 tem o roteiro; §6 as 7 pendências → fila do revisor.

## Como aplicar (D7)
1. Depois do lote 4 rodar, **re-ler** `cabeca-pescoco/v1/regimes-consolidados.json` do run (o
   lote 4 pode ter tocado o vocabulário de C&P — item 4/D6), e só então anexar `glandula_salivar`
   às `opcoes` de `tumor` e o campo `histologia_salivar` ao `campos_primitivos`.
2. Inserir os 3 regimes no agregado e na fatia (datas de `atualizado_em`/`historico_versoes`
   podem ir para o dia do intake; `versao` 1; `origem` do histórico `intake-salivar:outro (regime
   novo)` ou o nome do lote — escolha da sessão, o conteúdo hashado não muda).
3. `meta`: total 301+3 (+ o que o lote 4 acrescentar), `por_tumor` cabeca-pescoco 18 → 21 com 3
   `incompleto` a mais, `distribuicao_selo`, `revisao_humana.regimes_novos` (3),
   `referencias_verificadas` (+6), `pendencias_referendo` (+7), `decisao_fora_do_fluxo`.
   `content-hashes.json` regravado — os 3 hashes têm de bater com `meta.hashes_previstos`
   (189729d195cdad9b · 78fef43af32a8ba5 · 8979b74cdff473bb); se não baterem, algo do conteúdo
   revisável foi alterado na inserção.
4. Invariantes esperados no Portão A: 0 hashes existentes mudam, 0 aprovações expiram, 0 código
   de app (enum com `indeterminado`/`rotulos` já é suportado desde `94dc6cd`). `--check-dois`: os
   3 DOIs de pivô (`10.1093/oxfordjournals.annonc.a010684`, `10.3109/00016489.2016.1170876`,
   `10.1002/hed.24933`) resolvem no Crossref (conferidos 16/09).
5. Portão B: paciente `cabeca-pescoco` com `tumor=glandula_salivar` + `metastatico=true` vê os 3
   cards pendentes; paciente `cec_cabeca_pescoco` não vê nenhum deles.
6. Fila do revisor após publicar: +3 em *Pendente*; as 7 pendências vão na `re_revisao` do relatório.
