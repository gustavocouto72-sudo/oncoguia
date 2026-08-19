# Lote de processamento

**Tumor:** mama
**Arquivo fonte:** `data/input/Protocolos de Oncologia 2025 1.pdf` (capítulo de mama, páginas 10–27)
**Cenários:** todos — adjuvância, neoadjuvância, hormonioterapia adjuvante, metastático
**Escopo do lote:** somente mama nesta execução
**Data:** 2026-07-18

## Instruções do usuário
- Extrair cada regime para o schema (`pipeline/data/schema-regime.md`).
- Capturar: fármacos/doses, critérios de *Elegibilidade*, referência com DOI, e o que o protocolo **afirma** de GRADE / ESMO-MCBS.
- Campo ausente = `null`. Nada inventado.
