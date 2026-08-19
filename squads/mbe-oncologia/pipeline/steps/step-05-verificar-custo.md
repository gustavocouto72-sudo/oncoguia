---
step: "05"
name: "Verificação NCCN Evidence Blocks"
type: agent
agent: verificador-custo
execution: subagent
model_tier: powerful
tasks:
  - rederivar-affordability
depends_on: step-02
---

# Step 05 — Verificação NCCN Evidence Blocks

## Para o Pipeline Runner
Executar a task `rederivar-affordability` do verificador. Este agente é **adversarial**: ele NÃO confia no que o protocolo afirmou. Ele vai à fonte primária (estudo-pivô + diretriz) e **re-deriva a sustentabilidade/affordability do zero**, depois compara com o valor afirmado no protocolo.

## Inputs
- `output/regimes-extraidos.json`
- `pipeline/data/nccn-evidence-blocks.md`
- `pipeline/data/fontes-confiaveis.md`

## Output
- `output/verificacao-custo.json` — para cada regime: `status` (concorda | diverge | indeterminado), `valor_rederivado`, `justificativa`, `fonte`.

## Quality Gate
- [ ] Todo regime processado tem um veredito com justificativa e fonte verificável.
- [ ] Divergências vs. o protocolo estão explicitamente marcadas (não suavizar).
- [ ] Onde a fonte primária não permite concluir, usar `indeterminado` — nunca chutar.
