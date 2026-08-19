---
task: "Re-derivar affordability"
order: 1
input:
  - regimes: output/regimes-extraidos.json
  - framework: pipeline/data/nccn-evidence-blocks.md
  - fontes: pipeline/data/fontes-confiaveis.md
output:
  - veredito: output/verificacao-custo.json (status/valor/justificativa/fonte por regime)
---

# Re-derivar affordability

Re-deriva **a sustentabilidade (NCCN Evidence Blocks)** de cada regime a partir da fonte primária e confronta com o que o protocolo afirmou.

## Process
1. Para cada regime em `output/regimes-extraidos.json`, localizar o estudo-pivô pela `referencia` (DOI/PMID) e, quando aplicável, a diretriz correspondente.
2. Estimar o Affordability (1–5) do NCCN Evidence Blocks pela composição de custo (droga, administração, suporte, manejo de toxicidade); sinalizar divergência provável no contexto BR sem inventar número local.
3. Definir `status`:
   - `estimativa` — **caso padrão deste eixo**: o número saiu de composição de custo qualitativa, sem fonte primária resolvível (NCCN Evidence Blocks não versionado por regime, "estimativa qualitativa", portaria/PCDT sem link resolvível). `estimativa` não é `concorda` e **não conta como confronto** para o selo.
   - `concorda` / `diverge` — só quando houver, de fato, um Affordability afirmado pelo protocolo (`afirmado_protocolo != null`) **e** uma fonte resolvível (DOI/URL/NCCN citável) para confrontar: bate → `concorda`, não bate → `diverge`.
   - `indeterminado` — nem estimar foi possível.
4. Escrever `justificativa` (1–3 frases) e `fonte` (DOI/URL consultado; se for só composição qualitativa, dizê-lo — não maquiar como fonte primária).
5. Salvar o JSON de saída.

## Output Format
```json
{
  "regimen_id": "mama-adj-her2pos-th",
  "eixo": "a sustentabilidade (NCCN Evidence Blocks)",
  "afirmado_protocolo": "A",
  "valor_rederivado": "A",
  "status": "concorda",
  "justificativa": "…",
  "fonte": "https://doi.org/…"
}
```

## Veto Conditions
- Marcar `concorda` sem Affordability afirmado pelo protocolo E sem fonte resolvível → proibido: o status é `estimativa`.
- Rotular composição de custo qualitativa como se fosse fonte primária (ex.: "estimativa qualitativa" apresentada como confronto) → proibido.
- Concordar sem ter aberto a fonte primária → proibido.
- Preencher `valor_rederivado` copiando o afirmado sem análise → proibido.

