---
step: "03"
name: "Verificação GRADE"
type: agent
agent: verificador-evidencia
execution: subagent
model_tier: powerful
tasks:
  - rederivar-grade
depends_on: step-02
---

# Step 03 — Verificação GRADE

## Para o Pipeline Runner
Executar a task `rederivar-grade` do verificador. Este agente é **adversarial**: ele NÃO confia no que o protocolo afirmou. Ele vai à fonte primária (estudo-pivô + diretriz) e **re-deriva a qualidade da evidência e a força da recomendação do zero**, depois compara com o valor afirmado no protocolo.

## Inputs
- `output/regimes-extraidos.json`
- `pipeline/data/grade-framework.md`
- `pipeline/data/fontes-confiaveis.md`

## Output
- `output/verificacao-grade.json` — para cada regime: `status` (concorda | diverge | indeterminado), `valor_rederivado`, `justificativa`, `fonte`.

## Quality Gate
- [ ] Todo regime processado tem um veredito com justificativa e fonte verificável.
- [ ] Divergências vs. o protocolo estão explicitamente marcadas (não suavizar).
- [ ] Onde a fonte primária não permite concluir, usar `indeterminado` — nunca chutar.
