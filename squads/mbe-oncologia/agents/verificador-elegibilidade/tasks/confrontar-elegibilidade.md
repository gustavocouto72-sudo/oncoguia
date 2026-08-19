---
task: "Confrontar elegibilidade"
order: 1
input:
  - regimes: output/regimes-extraidos.json
  - framework: pipeline/data/eligibility-extraction.md
  - fontes: pipeline/data/fontes-confiaveis.md
output:
  - veredito: output/verificacao-elegibilidade.json (status/valor/justificativa/fonte por regime)
---

# Confrontar elegibilidade

Re-deriva **os critérios de inclusão/exclusão do estudo-pivô** de cada regime a partir da fonte primária e confronta com o que o protocolo afirmou.

## Process
1. Para cada regime em `output/regimes-extraidos.json`, localizar o estudo-pivô pela `referencia` (DOI/PMID) e, quando aplicável, a diretriz correspondente.
2. **PRIORIZAR ClinicalTrials.gov (API v2) para este eixo.** Antes de tentar extrair elegibilidade do PDF/abstract, buscar o ensaio em `https://clinicaltrials.gov/api/v2/studies?query.term=<nome do estudo> <tumor>&format=json` (ou por NCT, se conhecido) e ler `protocolSection.eligibilityModule` — `eligibilityCriteria` (texto de inclusão/exclusão), `sex`, `minimumAge`, `maximumAge`. É a fonte que traz os critérios já estruturados, muitas vezes ausentes do abstract. Ver a escada completa em `pipeline/data/fontes-confiaveis.md`.
3. Se ClinicalTrials.gov não cobrir o ensaio, seguir a escada de APIs abertas para chegar ao texto do estudo-pivô: Crossref confirma o DOI → Europe PMC (`DOI:<DOI>`, e `PMC/<PMCID>/fullTextXML` se OA) → Unpaywall/OpenAlex acham a versão OA → sem DOI, buscar por termo no Europe PMC/PubMed. Só marcar `indeterminado`/"acesso institucional" depois de a escada inteira falhar. Usar e-mail de contato real em `email=`/`mailto=`.
4. Extrair os critérios de inclusão/exclusão em formato computável (campo, operador, valor) e comparar com a `elegibilidade_protocolo`; apontar onde o protocolo é mais amplo ou mais estreito que a população estudada.
5. Definir `status`:
   - `concorda` — **só** quando o protocolo declara elegibilidade (`elegibilidade_protocolo != null`) E a população re-derivada do estudo-pivô bate com ela (amplitude `equivalente`).
   - `diverge` — o protocolo declara elegibilidade e a re-derivada é `mais_amplo` ou `mais_estreito` de forma relevante.
   - `re_derivado` — `elegibilidade_protocolo == null`: o protocolo não declara critérios. Você extraiu os do estudo-pivô, mas **não há afirmação a confrontar** — nunca `concorda`.
   - `indeterminado` — a fonte não permite extrair critérios computáveis (nem ClinicalTrials.gov nem a escada resolveram).
6. Escrever `justificativa` (1–3 frases) e `fonte` (NCT/DOI/URL/degrau da escada que resolveu — o DOI tem de resolver de fato).
7. Salvar o JSON de saída.

## Output Format
Diferente dos outros três eixos: aqui `valor_rederivado` NÃO é uma nota única —
é a **estrutura computável** que o app consome. Emitir as listas `{campo, operador, valor}`.

```json
{
  "regimen_id": "mama-adj-her2pos-th",
  "eixo": "os critérios de inclusão/exclusão do estudo-pivô",
  "status": "diverge",
  "criterios_inclusao": [
    {"campo": "her2", "operador": "=", "valor": "positivo"},
    {"campo": "tstage", "operador": "<=", "valor": "cT1c"},
    {"campo": "node", "operador": "=", "valor": "N0"},
    {"campo": "feve", "operador": ">=", "valor": 50}
  ],
  "criterios_exclusao": [
    {"campo": "doenca_cardiaca_sintomatica", "operador": "=", "valor": true}
  ],
  "amplitude": "mais_amplo",
  "divergencia_vs_protocolo": "O protocolo aceita T ≤3 cm; o estudo-pivô (APT) incluiu apenas T ≤3 cm E N0. Sem divergência de T, mas o protocolo não fixa FEVE mínima que o estudo exigia (≥50%).",
  "justificativa": "Critérios extraídos de Methods/eligibility do estudo APT.",
  "fonte": "https://doi.org/10.1056/NEJMoa1406281"
}
```

- `status`: `concorda` (protocolo declara E = população do estudo) | `diverge` (protocolo declara e é mais amplo/estreito de forma relevante) | `re_derivado` (protocolo **não** declara elegibilidade — critérios extraídos do estudo, sem confronto) | `indeterminado` (fonte não permite extrair).
- `amplitude`: `mais_amplo` | `mais_estreito` | `equivalente` — `mais_amplo` é a divergência crítica (indicação fora da evidência).

## Veto Conditions
- Marcar `concorda` quando `elegibilidade_protocolo == null` → proibido: sem afirmação do protocolo não há confronto; o status é `re_derivado`.
- Marcar `concorda` quando a **referência é diretriz/consenso** (ESMO/NCCN/PCDT) sem população de ensaio discreta → proibido: é `re_derivado` (flag `fonte_diretriz`).
- Marcar `concorda` quando o **esquema exato ou a população** do regime **não constam do pivô citado** → proibido: é `re_derivado` (flag `indirectness_regime`). Política conservadora: na dúvida, rebaixe.
- Concordar sem ter aberto a fonte primária → proibido.
- Emitir nota única (`"A"`) em vez das listas `{campo, operador, valor}` → proibido: este eixo alimenta o motor de match do app.
- `amplitude: mais_amplo` sem apontar exatamente qual critério o protocolo afrouxou → proibido.
- Marcar `indeterminado` por elegibilidade sem critérios computáveis sem ter consultado ClinicalTrials.gov (`eligibilityModule`) nem a escada de APIs abertas → proibido.
- Inventar critério não confirmado pela fonte quando as APIs não retornarem → proibido (é `indeterminado`).

