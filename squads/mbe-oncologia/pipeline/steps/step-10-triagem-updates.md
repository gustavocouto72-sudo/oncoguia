---
step: "10"
name: "Triagem dos candidatos a atualização"
type: checkpoint
depends_on: step-09
---

# Step 10 — Triagem de atualizações (checkpoint)

## Para o oncologista
Revisar `output/candidatos-atualizacao.json`. Para cada candidato: **incorporar** (gera nova versão do regime, com histórico), **descartar** (registrar por quê) ou **marcar para Tumor Board**.

## Saída
- Decisões aplicadas em `output/regimes-consolidados.json`, incrementando `versao` e registrando `atualizado_em`.

## Ingestão de decisões (`revisao-decisoes.json`) — opcional, sem quebrar o modo interativo
O `revisao-decisoes.json` exportado pela **Revisão clínica** do app (`GET/POST /api/revisao/export`, admin; tabela única `revisoes`) carrega os pareceres por protocolo — schema em `step-08`. Quando esse arquivo está na pasta do run (mesma pasta do `regimes-consolidados.json`), este checkpoint usa os pareceres já dados **em vez de perguntar do zero**.

Fluxo:
1. Ao entrar no Step 10, procurar `revisao-decisoes.json` na pasta do run corrente.
   - **Se não existir** → seguir o checkpoint interativo normal (triar candidato a candidato).
   - **Se existir** → para cada candidato de `candidatos-atualizacao.json`, olhar a decisão mais recente do `regimen_id` alvo (**roteando pela `acao`** — schema e regra de segurança no step-08: `refutar`/`excluir`/`corrigir_referencia` só com `acao` explícita, nunca deduzidas de texto livre; `remover` em arquivo antigo = `refutar`):
     - **`acao: "refutar"`** → o regime foi refutado na revisão clínica (Step 08) mas **continua no corpo publicado**, visível como não incorporado (motivo `refutado`). A vigilância **não re-adota automático**: NUNCA limpar a marcação `incorporacao`/flag nem reincorporar por conta própria. Um delta relevante (ex.: trial novo positivo sobre o regime refutado) é exatamente um **sinal para o humano reconsiderar**: apresentar o candidato no checkpoint como `reavaliar_refutado`, com o parecer que refutou (nota_revisao/revisor/data) e o delta lado a lado. Reincorporar, se for o caso, é **decisão humana nova**: quem decide limpa a marcação explicitamente e o registro entra em `historico_versoes[]` (`origem: "atualizacao-vigilancia"`, `decidido_por`) — nunca reintrodução silenciosa.
     - **`acao: "excluir"`** → a entrada saiu do consolidado por erro/duplicata (Step 08): **descartar o candidato** com motivo `regime_excluido_erro_duplicata` — não há o que atualizar.
     - **`acao: "corrigir_referencia"` ou `"ajustar_elegibilidade"`** com `eixo` compatível com o `eixo_afetado` do candidato → o regime já está sinalizado para reprocessamento no Step 08; triar o candidato **junto** desse reprocessamento (a correção do revisor — `acao_detalhe` — tem precedência sobre o delta da vigilância).
     - **`acao: "manter_anotar"`** → o dado está validado com ressalva; o candidato permanece como **proposta pendente** — triar interativamente como no caso `aprovado` abaixo (a nota do revisor entra como contexto na triagem).
     - **`acao: "outro"` ou `acao: null` com `triagem_manual: true` (legado)** → o parecer está na fila de triagem manual/assistida do Step 08; triar o candidato **interativamente**, apresentando parecer e delta juntos ao humano.
     - decisão **`aprovado`** no hash atual → o revisor validou o regime como está; o candidato permanece como **proposta pendente** — triar interativamente (incorporar / descartar / Tumor Board), registrando em `consolidacao.candidatos_triados[]` `{delta, decisao, motivo, revisor, data}` e, ao incorporar, **append** em `historico_versoes[]` `{versao, data, origem: "atualizacao-vigilancia", mudanca (= delta_proposto), eixos_afetados: [eixo], fonte, decidido_por}` + incrementar `versao`/`atualizado_em`.
     - **sem decisão** para o regime → checkpoint interativo normal.
2. Registrar em `meta.triagem_humana` do JSON: `status` (`aplicada`), `data`, `decidido_por`, e o caminho do `revisao-decisoes.json` considerado.

## Princípio
Nada entra no ar automaticamente. A vigilância PROPÕE; o humano DISPÕE — seja no checkpoint interativo, seja pelo `revisao-decisoes.json` exportado na Revisão clínica. Isso mantém a auditabilidade e a segurança.
