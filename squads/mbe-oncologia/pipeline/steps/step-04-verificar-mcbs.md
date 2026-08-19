---
step: "04"
name: "Verificação ESMO-MCBS"
type: agent
agent: verificador-beneficio
execution: subagent
model_tier: powerful
tasks:
  - rederivar-mcbs
depends_on: step-02
---

# Step 04 — Verificação ESMO-MCBS

## Para o Pipeline Runner
Executar a task `rederivar-mcbs` do verificador. Este agente é **adversarial**: ele NÃO confia no que o protocolo afirmou. Ele vai à fonte primária (estudo-pivô + diretriz) e **re-deriva a magnitude do benefício clínico do zero**, depois compara com o valor afirmado no protocolo.

## Inputs
- `output/regimes-extraidos.json`
- `pipeline/data/esmo-mcbs-framework.md`
- `pipeline/data/fontes-confiaveis.md`

## Output
- `output/verificacao-mcbs.json` — para cada regime: `status` (concorda | diverge | indeterminado), `valor_rederivado`, `justificativa`, `fonte`.

## Quality Gate
- [ ] Todo regime processado tem um veredito com justificativa e fonte verificável.
- [ ] Divergências vs. o protocolo estão explicitamente marcadas (não suavizar).
- [ ] Onde a fonte primária não permite concluir, usar `indeterminado` — nunca chutar.
