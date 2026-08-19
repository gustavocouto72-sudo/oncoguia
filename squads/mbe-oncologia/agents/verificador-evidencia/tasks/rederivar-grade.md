---
task: "Re-derivar GRADE"
order: 1
input:
  - regimes: output/regimes-extraidos.json
  - framework: pipeline/data/grade-framework.md
  - fontes: pipeline/data/fontes-confiaveis.md
output:
  - veredito: output/verificacao-grade.json (status/valor/justificativa/fonte por regime)
---

# Re-derivar GRADE

Re-deriva **a qualidade da evidência e a força da recomendação** de cada regime a partir da fonte primária e confronta com o que o protocolo afirmou.

## Process
1. Para cada regime em `output/regimes-extraidos.json`, localizar o estudo-pivô pela `referencia` (DOI/PMID) e, quando aplicável, a diretriz correspondente.
2. **Antes de concluir `indeterminado` por inacessibilidade, esgotar a escada de APIs abertas** de `pipeline/data/fontes-confiaveis.md` (seção "APIs abertas"): Crossref confirma o DOI → Europe PMC (`DOI:<DOI>`) traz abstract e, se OA, texto completo (`PMC/<PMCID>/fullTextXML`) → Unpaywall/OpenAlex acham a versão OA de artigo em paywall → sem DOI, buscar por termo no Europe PMC/PubMed para obter PMID/DOI e repetir. Só marcar "precisa de acesso institucional" depois de a escada inteira falhar. Usar e-mail de contato real em `email=`/`mailto=`.
3. Avaliar desenho do estudo, risco de viés, consistência, precisão (IC) e magnitude; derivar qualidade (A/B/C) e força (1/2), no formato número+letra.
4. Comparar o valor re-derivado com `afirmado_protocolo` e definir `status`:
   - `concorda` — **só** quando `afirmado_protocolo != null` E o valor re-derivado bate com ele. É o único status que representa confronto real.
   - `diverge` — `afirmado_protocolo != null` e o valor re-derivado **não** bate.
   - `re_derivado` — `afirmado_protocolo == null`: o protocolo não graduou este eixo. Você re-derivou com fonte, mas **não há confronto** — nunca escreva `concorda` aqui.
   - `indeterminado` — a fonte não resolveu (escada de APIs falhou, ou o DOI-fonte não resolve).
5. Escrever `justificativa` (1–3 frases) e `fonte` (DOI/URL/degrau da escada que resolveu — o DOI tem de resolver de fato).
6. Salvar o JSON de saída.

## Output Format
```json
{
  "regimen_id": "mama-adj-her2pos-th",
  "eixo": "a qualidade da evidência e a força da recomendação",
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
- Inventar valor não confirmado pela fonte quando a API não retornar → proibido (é `indeterminado`).
- Citar como `fonte` um DOI que não resolve (HTTP + Crossref) → proibido: confirme o DOI antes; se não resolver, o status é `indeterminado`.

