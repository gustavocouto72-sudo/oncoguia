---
task: "Consolidar"
order: 1
input:
  - regimes: output/regimes-extraidos.json
  - vereditos: output/verificacao-*.json (4 arquivos)
output:
  - consolidado: output/regimes-consolidados.json
  - relatorio: output/relatorio-divergencias.md
---

# Consolidar

Une os quatro vereditos por regime, aplica o selo de confiança e escreve o relatório humano.

## Process
1. Para cada regime, anexar os 4 vereditos ao bloco `verificacao` do schema:
   - **grade / esmo_mcbs / nccn_affordability** → mapear `{status, valor_rederivado, justificativa, fonte}` de cada verificação.
   - **elegibilidade** → NÃO é uma nota: transportar as listas `criterios_inclusao` / `criterios_exclusao` (formato `{campo, operador, valor}`) e `divergencia_vs_protocolo` do `verificacao-elegibilidade.json` para `verificacao.elegibilidade` do schema. É o campo que o app consome — não resumir nem achatar em texto.
2. **Validar cada DOI-fonte (HTTP + Crossref).** Antes de selar, resolver todo DOI citado como fonte (referência do pivô e fontes dos eixos). Se algum não resolver (404) → `flag: doi_nao_resolvido: <DOI>` e o regime não pode ser `confirmado`.
3. Selo (confronto real; ver a precedência completa em `pipeline/steps/step-07-consolidar.md`):
   - `confirmado` **só** quando ≥1 eixo `concorda` (protocolo afirmou E bateu), nada `diverge`, nenhum `indeterminado` crítico (grade/elegibilidade) e todos os DOIs resolvem. Custo em `estimativa` não conta como confronto e não sustenta `confirmado` sozinho.
   - `divergencia` se ≥1 `diverge` (pesa mais que lacuna; se houver `diverge` E `indeterminado`, selo é `divergencia` e ambos entram em `flags`).
   - `incompleto` se ≥1 `indeterminado` crítico ou `doi_nao_resolvido`.
   - `re_derivado` quando não há nenhum `concorda` mas a avaliação própria é sólida em todos os eixos (nada diverge, nada indeterminado crítico): sólido, porém sem confronto.
   - Nunca marcar `confirmado` só porque "o protocolo não afirmou e a re-derivação é sólida" — isso é `re_derivado`.
4. Preencher `flags` com o resumo do que precisa de olho humano (inclui `amplitude: mais_amplo` da elegibilidade, que é risco de indicação fora da evidência, e `doi_nao_resolvido`).
4. Escrever `relatorio-divergencias.md`: primeiro as `divergencia`, depois `incompleto`, em linguagem clínica, com fonte.
5. Incrementar `versao` se o conteúdo mudou vs. a versão anterior.

## Output
Cada item de `regimes-consolidados.json` segue o schema completo (ver `pipeline/data/schema-regime.md`), com o bloco `consolidacao` preenchido.

