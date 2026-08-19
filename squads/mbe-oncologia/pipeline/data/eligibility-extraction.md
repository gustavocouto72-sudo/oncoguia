# Framework — Extração e confronto de critérios de elegibilidade

Objetivo: transformar os critérios de inclusão/exclusão do **estudo-pivô** em regras
computáveis e confrontar com a elegibilidade escrita no protocolo. É o que alimenta o
"entra / não entra" do app.

## Formato computável
Cada critério vira `{campo, operador, valor}`:
- `{"campo": "feve", "operador": ">=", "valor": 55}`
- `{"campo": "ecog", "operador": "<=", "valor": 1}`
- `{"campo": "tstage", "operador": "<=", "valor": "cT1c"}`
- `{"campo": "node", "operador": "=", "valor": "N0"}`
- `{"campo": "her2", "operador": "=", "valor": "positivo"}`
- `{"campo": "clcr", "operador": ">=", "valor": 60}`

Campos padronizados (vocabulário): idade, ecog, feve, clcr, bilirrubina, plaquetas,
neutrofilos, her2, rh, tstage, node, mstage, biomarcador_x, comorbidade_y…
(alinhar depois com mCODE/FHIR na fase de app).

## Processo
1. Abrir o estudo-pivô (methods / eligibility).
2. Extrair inclusão e exclusão em `{campo, operador, valor}`.
3. Comparar com `elegibilidade_protocolo`:
   - **mais estreito**: o protocolo exige algo que o estudo não exigia (ok, mas sinalizar).
   - **mais amplo**: o protocolo permite paciente que o estudo excluiu → **divergência importante** (risco de indicação fora da evidência).
4. Registrar `divergencia_vs_protocolo` em texto claro.

## Saída
Listas `criterios_inclusao` / `criterios_exclusao` (computáveis) + `divergencia_vs_protocolo`.
