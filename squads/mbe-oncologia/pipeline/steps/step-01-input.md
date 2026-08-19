---
step: "01"
name: "Seleção do lote a processar"
type: checkpoint
outputFile: output/lote.md
---

# Step 01 — Entrada (checkpoint)

## Para o usuário
Definir o que será processado nesta execução:
- **Tumor / capítulo** (ex.: `mama`, `pulmão-nsclc`, `colorretal`).
- **Arquivo(s) fonte**: caminho(s) do(s) PDF(s) do protocolo institucional.
- **Escopo**: todos os cenários (adjuvância, neoadjuvância, metastático…) ou um subconjunto.

## Saída
- `output/lote.md` com: tumor, caminho do PDF, cenários a processar, data.

## Observação
Rodar um tumor por vez dá lotes revisáveis pelo oncologista. Não tente processar os 9 grupos numa única execução na primeira rodada.
