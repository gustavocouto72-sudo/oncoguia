---
task: "Re-derivar ESMO-MCBS"
order: 1
input:
  - regimes: output/regimes-extraidos.json
  - framework: pipeline/data/esmo-mcbs-framework.md
  - fontes: pipeline/data/fontes-confiaveis.md
output:
  - veredito: output/verificacao-mcbs.json (status/valor/justificativa/fonte por regime)
---

# Re-derivar ESMO-MCBS

Re-deriva **a magnitude do benefício clínico** de cada regime a partir da fonte primária e confronta com o que o protocolo afirmou.

## Process
1. Para cada regime em `output/regimes-extraidos.json`, localizar o estudo-pivô pela `referencia` (DOI/PMID) e, quando aplicável, a diretriz correspondente.
2. **Antes de concluir `indeterminado` por inacessibilidade, esgotar a escada de APIs abertas** de `pipeline/data/fontes-confiaveis.md` (seção "APIs abertas"): Crossref confirma o DOI → Europe PMC (`DOI:<DOI>`) traz abstract (HR, IC, ganho absoluto) e, se OA, texto completo → Unpaywall/OpenAlex acham a versão OA de artigo em paywall → sem DOI, buscar por termo no Europe PMC/PubMed. Conferir o scorecard oficial do ESMO quando existir. Só marcar "precisa de acesso institucional" depois de a escada inteira falhar. Usar e-mail de contato real em `email=`/`mailto=`.
3. Escolher o formulário pelo cenário (curativo → A/B/C; paliativo → 5–1), aplicar os critérios (HR, ganho absoluto, QoL, toxicidade) e, se existir, conferir contra o scorecard oficial do ESMO. Braço único → normalmente `n/a`.
4. Comparar o valor re-derivado com `afirmado_protocolo` e definir `status`:
   - `concorda` — **só** quando `afirmado_protocolo != null` E a nota re-derivada bate com ele.
   - `diverge` — `afirmado_protocolo != null` e a nota re-derivada **não** bate.
   - `re_derivado` — `afirmado_protocolo == null`: o protocolo não deu nota MCBS. Você re-derivou com fonte, mas sem confronto — nunca `concorda`.
   - `indeterminado` — fonte não resolveu / DOI-fonte não resolve. (Braço único legitimamente sem scorecard → `valor_rederivado: n/a`, status `re_derivado` se havia fonte, senão `indeterminado`.)
5. Escrever `justificativa` (1–3 frases) e `fonte` (DOI/URL/degrau da escada que resolveu — o DOI tem de resolver de fato).
6. Salvar o JSON de saída.

## Output Format
```json
{
  "regimen_id": "mama-adj-her2pos-th",
  "eixo": "a magnitude do benefício clínico",
  "afirmado_protocolo": "A",
  "valor_rederivado": "A",
  "status": "concorda",
  "justificativa": "…",
  "fonte": "https://doi.org/…"
}
```

## Veto Conditions
- Marcar `concorda` quando `afirmado_protocolo == null` → proibido: sem afirmação não há confronto; o status é `re_derivado`.
- Concordar sem ter aberto a fonte primária → proibido.
- Preencher `valor_rederivado` copiando o afirmado sem análise → proibido.
- Marcar `indeterminado`/"inacessível" no paywall sem ter tentado a escada de APIs abertas (Europe PMC / Unpaywall / OpenAlex / PubMed) → proibido.
- Inventar nota não confirmada pela fonte quando a API não retornar → proibido (é `indeterminado`).
- Citar como `fonte` um DOI que não resolve (HTTP + Crossref) → proibido: confirme o DOI antes; se não resolver, o status é `indeterminado`.

