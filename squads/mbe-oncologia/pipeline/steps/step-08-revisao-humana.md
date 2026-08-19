---
step: "08"
name: "Revisão humana"
type: checkpoint
depends_on: step-07
---

# Step 08 — Revisão humana (checkpoint) 🔴 OBRIGATÓRIO

## Para o oncologista
Abrir `output/relatorio-divergencias.md`. Para cada divergência ou incompletude:
- **Aceitar a re-derivação** (o sistema achou algo que o protocolo não refletia) → vira nova versão do regime.
- **Manter o protocolo** (a re-derivação errou ou há contexto local) → registrar o motivo.
- **Escalar para Tumor Board** quando for decisão clínica de fundo.

Nenhum regime é publicado como "confirmado" sem passar por aqui. Este checkpoint é o que mantém o produto do lado "informa, o médico decide" (isento na leitura da ANVISA) e clinicamente responsável.

## Saída
- `output/regimes-consolidados.json` atualizado com `revisado_por`, `revisado_em` e decisão por divergência.

## Ingestão de decisões (`revisao-decisoes.json`) — opcional, sem quebrar o modo interativo
A **Revisão clínica** do app (`app/`, aba **Revisão clínica**) grava os pareceres na tabela única `revisoes` do backend; o admin baixa o pacote via `GET/POST /api/revisao/export` como `revisao-decisoes.json`. Quando esse arquivo é colocado na pasta do run (mesma pasta do `regimes-consolidados.json`, ex.: `output/{run}/v1/`), este checkpoint **ingere as decisões em vez de perguntar** — o oncologista já decidiu na tela.

Schema de cada item de `decisoes[]`: `{regimen_id, content_hash, hash_atual, decisao (aprovado | contestado | ajuste_solicitado), natureza (dado | clinico | null), acao (refutar | excluir | corrigir_referencia | ajustar_elegibilidade | manter_anotar | outro | null), acao_detalhe, triagem_manual, eixo, justificativa, reprocessar, correcao, revisor, data}`. (`remover`, nome antigo de `refutar`, foi migrado no banco — exports novos nunca o trazem; se aparecer num arquivo antigo, tratar como `refutar`.) Usar a decisão **mais recente** por `regimen_id`; se `content_hash` ≠ hash atual do regime, o parecer é de uma versão anterior — registrar, mas tratar como re-revisão pendente.

**Quem roteia o intake é a `acao`** (a `natureza` classifica; a ação DECIDE). Regra de segurança inegociável: `refutar`, `excluir` e `corrigir_referencia` mudam o corpo publicado — **só agir com `acao` setada explicitamente no export; NUNCA deduzir a ação do texto livre da justificativa.** E não confundir os dois lados da moeda: **rejeição clínica (`refutar`) fica visível; só dado errado (`excluir`) sai de fato.**

Fluxo:
1. Ao entrar no Step 08, procurar `revisao-decisoes.json` na pasta do run corrente.
   - **Se não existir** → seguir o checkpoint interativo normal (perguntar divergência a divergência).
   - **Se existir** → carregar e aplicar as decisões, casando ao regime por `regimen_id` (e ao eixo por `eixo`, quando informado).
2. Para cada decisão, conforme `decisao` + `acao`:
   - **`aprovado`** → registrar a validação humana: `consolidacao.decisao_revisao = "aprovado_revisao_clinica"`, com `revisado_por` (= `revisor`) e `revisado_em` (= `data`). Não altera valores; o selo do squad permanece (a aprovação humana se sobrepõe sem reescrever a evidência).
   - **`acao: "refutar"`** → rejeição clínica — **o regime NÃO sai do corpo publicado**: continua no `regimes-consolidados.json` e na tela, só **fora da lista de candidatos selecionáveis**. Marcar no regime (top-level) `incorporacao: { status: "nao_incorporado", motivo: "refutado", nota_revisao (= justificativa), revisor (= revisor), data (= data) }`, adicionar o flag `nao_incorporado` em `consolidacao.flags` **e** no `flags` top-level (o app lê os dois), e `consolidacao.decisao_revisao = "refutado_revisao_clinica"`. **Sem reprocessar e sem apagar nada**: semáforo, evidência (`verificacao`) e pivô (`referencia`) ficam intactos — o regime aparece na seção recolhida **"Avaliados — não incorporados"** com o motivo `refutado`, a justificativa do revisor e revisor/data. Manter a informação é prova da completude da avaliação: a soma-invariante (**total = candidatos + não incorporados**) não muda. Runs futuros **preservam a marcação** — nenhum step re-deriva a incorporação de um regime refutado sem decisão humana nova. (O campo legado `removido: true` está aposentado; se aparecer em dado antigo, converter para esta marcação.)
   - **`acao: "excluir"` (exceção estreita — erro/duplicata)** → o dado está **errado** (entrada duplicada, regime inexistente), não é rejeição clínica: **remover a entrada de vez** do `regimes-consolidados.json`. Registrar em `meta.revisao_humana.excluidos[]` `{regimen_id, erro (= acao_detalhe), justificativa, revisor, data}` para rastreabilidade. **NUNCA usar `excluir` para discordância clínica** — para isso existe `refutar`, que mantém o regime visível.
   - **`acao: "corrigir_referencia"`** → trocar o estudo-pivô/DOI pela referência em `acao_detalhe` e **re-derivar apenas o eixo afetado** (o `eixo` do parecer; sem eixo → a verificação completa do regime) partindo da fonte nova; a nova versão **passa de novo pelo portão de verificação** e só é publicada se voltar por esta revisão. Registrar `consolidacao.decisao_revisao = "contestado_reprocessar"` com `correcao` (= `acao_detalhe`). Enquanto não reprocessado, o regime permanece pendente (não confirmado).
   - **`acao: "ajustar_elegibilidade"`** → aplicar a regra computável descrita em `acao_detalhe` (spec do revisor), **re-validar órfãos + estadiamento** e recomputar o que dela depende; mesma trilha de reprocessamento e re-verificação do item anterior (`decisao_revisao = "contestado_reprocessar"`, `correcao` = `acao_detalhe`).
   - **`acao: "manter_anotar"`** → **não muda dado nenhum**: anexar a `justificativa` ao regime como contexto visível (`consolidacao.nota_revisao`) e marcar `consolidacao.decisao_revisao = "revisado_com_ressalva"`, com `revisado_por`/`revisado_em`. Não incrementa versão, não altera valores/selo, não reprocessa.
   - **`acao: "outro"`** → **fila de triagem manual**: registrar `consolidacao.decisao_revisao = "triagem_manual"` e apresentar ao humano no checkpoint; **não roteia automático nunca**.
   - **`acao: null` em contestado/ajuste (legado, `triagem_manual: true`)** → ver o passo 3.
3. **Triagem assistida do legado** (decisões antigas escritas só em texto livre, sem `acao`): **não agir automaticamente**. Para cada uma, ler a `justificativa` e **propor** um balde — "RETIRAR/remover o regime" ou rejeição clínica → `refutar` (fica visível); "é duplicata / entrada errada / esse regime não existe" → `excluir`; "usar esta referência/o DOI correto é X" → `corrigir_referencia`; "pode aprovar do jeito que está / manter o protocolo" → `manter_anotar`; refino de critério computável → `ajustar_elegibilidade`; resto → `outro` — e **apresentar a lista (parecer → balde proposto) para o humano confirmar ou corrigir, item a item, ANTES de executar qualquer coisa**. Nada é excluído/alterado sem confirmação explícita; só após a confirmação aplicar o roteamento do passo 2.
4. Registrar em `meta.revisao_humana` do JSON: `status` (`aplicada` quando houve ingestão), `data`, `decidido_por`, e o caminho do `revisao-decisoes.json` ingerido. Listar os `regimen_id` sinalizados para reprocessamento em `meta.revisao_humana.reprocessar[]` (com `acao`, `natureza`, `eixo` e `correcao`), os refutados em `meta.revisao_humana.refutados[]` (`{regimen_id, nota_revisao, revisor, data}` — continuam no corpo, marcados), os excluídos por erro/duplicata em `meta.revisao_humana.excluidos[]` (`{regimen_id, erro, justificativa, revisor, data}`) e os triados do legado em `meta.revisao_humana.triagem_legado[]` (`{regimen_id, balde_proposto, balde_confirmado, confirmado_por}`) para rastreabilidade.

Princípio inegociável mantido: **nada entra no ar (confirmado/atualizado) sem uma decisão humana explícita** — seja no checkpoint interativo, seja no `revisao-decisoes.json` exportado pelo admin na Revisão clínica. A interface só coleta o parecer; é aqui que ele é aplicado.
