# Squad Memory: MBE Oncologia — Fábrica de Evidência

## Estilo de Escrita
- Relatório de divergências em linguagem clínica, priorizando o que muda conduta, com fonte à mão.

## Design Visual

## Estrutura de Conteúdo
- Um tumor por lote na fase inicial (lotes revisáveis pelo oncologista).
- Saída principal: JSON por regime no schema de `pipeline/data/schema-regime.md`, versionado.

## Proibições Explícitas
- Nos checkpoints humanos (Steps 08 e 10), permitir explicitamente o estado "pendente": o revisor pode NÃO decidir as divergências/candidatos e adiar para um oncologista de referência. Nada é aceito nem rejeitado; registra-se `pendente_oncologista_referencia` na trilha, sem confirmar a re-derivação do sistema. Não pressionar por decisão clínica. (Preferência do Gustavo, run 2026-07-18-141255.)
- Nunca aceitar o valor afirmado pelo protocolo sem confrontar na fonte primária (verificação circular).
- Nunca inventar dado (dose/DOI/HR/nota): sem fonte = `indeterminado`/`null`.
- Nada entra no ar (confirmado/atualizado) sem checkpoint humano (Steps 08 e 10).
- O squad informa e sinaliza; conduta e exceções são do oncologista (mantém o produto isento na leitura da ANVISA).

## Técnico (específico do squad)
- Quatro eixos obrigatórios: GRADE, ESMO-MCBS, NCCN Affordability, elegibilidade.
- Eixo de elegibilidade emite listas `{campo, operador, valor}` (não uma nota) — é o output que o app consome.
- Selo determinístico: `confirmado` | `divergencia` | `incompleto`; precedência diverge > indeterminado.
- Estudo de braço único → ESMO-MCBS `n/a` (não graduável).
- Toda mudança aprovada em checkpoint acrescenta entrada em `historico_versoes[]` (nunca sobrescreve).
- O PDF do protocolo (`data/input/Protocolos de Oncologia 2025 N.pdf`) é VETORIAL: texto desenhado como curvas, sem camada de texto e sem imagens raster. `pdfplumber`/extract_text retorna vazio. Para ler: instalar poppler (`brew install poppler`) e usar o Read de PDF por páginas (renderiza como imagem para leitura visual). O capítulo de mama fica nas pp. 10-27 do arquivo "...2025 1.pdf".
