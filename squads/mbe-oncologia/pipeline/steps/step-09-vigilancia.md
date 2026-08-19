---
step: "09"
name: "Vigilância"
type: agent
agent: vigilancia
execution: subagent
model_tier: powerful
tasks:
  - buscar-atualizacoes
depends_on: step-08
---

# Step 09 — Vigilância de atualizações

## Para o Pipeline Runner
Executar a task `buscar-atualizacoes` do Vitor. Para cada regime já consolidado, procurar evidência NOVA que possa mudar algum eixo: novo RCT/meta-análise, atualização de scorecard ESMO-MCBS, nova versão de diretriz (NCCN/ASCO/ESMO/SBOC), alerta de segurança/bula.

## Inputs
- `output/regimes-consolidados.json`
- `pipeline/data/fontes-confiaveis.md`

## Output
- `output/candidatos-atualizacao.json` — por regime: o que mudou, fonte, qual(is) eixo(s) afeta, e o "delta" proposto (ex.: MCBS de A→B, novo esquema preferencial).

## Cadência sugerida
Rodar só este trecho (09→10) semanal ou mensal, por tumor. É o que mantém o protocolo vivo.
