---
step: "02"
name: "Extração dos regimes"
type: agent
agent: extrator
execution: subagent
model_tier: powerful
tasks:
  - extrair-regimes
depends_on: step-01
---

# Step 02 — Extração dos regimes

## Para o Pipeline Runner
Executar a task `extrair-regimes` da Elisa. Ela lê o PDF do protocolo e produz um registro estruturado por regime, **sem julgar** a evidência — só captura fielmente o que o documento diz (incluindo o que o protocolo AFIRMA de GRADE/ESMO-MCBS/custo, para depois ser confrontado).

## Inputs
- `output/lote.md`
- PDF(s) do protocolo
- `pipeline/data/schema-regime.md` (schema de saída)

## Output
- `output/regimes-extraidos.json`

## Quality Gate
- [ ] Cada regime tem: tumor, cenário, subtipo, nome, esquema (fármacos/doses), elegibilidade_protocolo, referencia (citação + DOI/PMID quando houver).
- [ ] O que o PDF afirmou de GRADE/MCBS/affordability foi capturado em `afirmado_protocolo` (ou `null` se ausente).
- [ ] `beneficio` (desfecho_principal + magnitude + fonte) derivado do **estudo-pivô**; ausente = `null` + flag.
- [ ] `toxicidades` (nome + severidade + conduta? + fonte) derivadas dos **fármacos do regime** (bula) + tabela de segurança do estudo-pivô — **não** do PDF do protocolo. Fármaco não especificado → `[]` + flag.
- [ ] Nenhum dado inventado: benefício sem base no estudo-pivô e toxicidade sem base na bula/estudo = `null`/`[]` com flag, nunca "de cabeça".
