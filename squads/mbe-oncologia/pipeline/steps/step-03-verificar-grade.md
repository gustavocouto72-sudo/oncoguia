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
- `pipeline/data/mbe-grade-certeza.md` · `pipeline/data/mbe-indirectness.md` · `pipeline/data/mbe-magnitude-precisao.md` (base metodológica — input declarado desde 2026-09-17)
- `pipeline/data/grade-handbook.md` (índice dos 7 guias MBE da direção, 2026-09-17 — prevalece sobre as fichas) · `pipeline/data/guia-prompts-ebm-grade.md` (protocolo de execução)
- `pipeline/data/fontes-confiaveis.md`

## Output
- `output/verificacao-grade.json` — para cada regime o bloco `grade` **schema 2** (ver a task): `status` (concorda | diverge | re_derivado | indeterminado), `desfecho_critico`, `desenho`, `efeito` (transcrito da fonte), `pivo`, 5 `dominios` com nota e frase, `certeza`, `recomendacao{forca, direcao, base}`, `valor_rederivado` (derivado, compat), `justificativa`, `fonte`.

## Quality Gate
- [ ] Todo regime processado tem um veredito com justificativa e fonte verificável.
- [ ] Divergências vs. o protocolo estão explicitamente marcadas (não suavizar).
- [ ] Onde a fonte primária não permite concluir, usar `indeterminado` — nunca chutar.
- [ ] Portão A (`verificar_dados.py`, check [11]) passa nas 7 regras determinísticas — o modelo preenche, o script barra.
