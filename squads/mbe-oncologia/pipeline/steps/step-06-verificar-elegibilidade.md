---
step: "06"
name: "Verificação de elegibilidade"
type: agent
agent: verificador-elegibilidade
execution: subagent
model_tier: powerful
tasks:
  - confrontar-elegibilidade
depends_on: step-02
---

# Step 06 — Verificação de elegibilidade

## Para o Pipeline Runner
Executar a task `confrontar-elegibilidade` do verificador. Este agente é **adversarial**: ele NÃO confia no que o protocolo afirmou. Ele vai à fonte primária (estudo-pivô + diretriz) e **re-deriva os critérios de inclusão/exclusão do estudo-pivô do zero**, depois compara com o valor afirmado no protocolo.

## Inputs
- `output/regimes-extraidos.json`
- `pipeline/data/eligibility-extraction.md`
- `pipeline/data/fontes-confiaveis.md`

## Output
- `output/verificacao-elegibilidade.json` — para cada regime: `status` (concorda | diverge | indeterminado), `valor_rederivado`, `justificativa`, `fonte`.

## Quality Gate
- [ ] Todo regime processado tem um veredito com justificativa e fonte verificável.
- [ ] Divergências vs. o protocolo estão explicitamente marcadas (não suavizar).
- [ ] Onde a fonte primária não permite concluir, usar `indeterminado` — nunca chutar.
