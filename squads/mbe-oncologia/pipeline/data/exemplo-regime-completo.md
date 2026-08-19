# Exemplo ponta-a-ponta — regime consolidado (referência de qualidade)

Caso real usado como padrão de qualidade pelos agentes. É deliberadamente um caso de
**divergência**, porque divergência é o produto do squad. Regime: **TH (paclitaxel +
trastuzumabe)** em mama HER2+ adjuvância, baseado no estudo APT (Tolaney 2015).

Pontos didáticos que este exemplo ensina:
- Estudo de **braço único** (fase II sem comparador) → ESMO-MCBS = `n/a` (não graduável).
- Se o protocolo afirma um GRADE forte (`1A`) sobre um braço único, o verificador **diverge** e devolve algo como `2B`.
- Elegibilidade `mais_amplo`: o protocolo não fixa FEVE mínima que o estudo exigia (≥50%).
- Selo final = `divergencia` (há ≥1 eixo que diverge), vai ao topo do relatório humano.

## 1. Extração (Elisa) → `regimes-extraidos.json`
`afirmado_protocolo` é capturado como o PDF diz, sem julgamento.

```json
{
  "regimen_id": "mama-adj-her2pos-th",
  "tumor": "mama", "cenario": "adjuvancia", "subtipo": "HER2 positivo", "nome": "TH",
  "esquema": "Paclitaxel 80 mg/m² EV semanal x12 + Trastuzumabe (8→6 mg/kg) → Trastuzumabe 6 mg/kg 21/21d por 1 ano",
  "elegibilidade_protocolo": "Mama invasiva HER2+, T ≤3 cm, N0, função cardíaca preservada",
  "referencia": { "citacao": "Tolaney SM et al. NEJM 2015;372(2):134-141.",
    "doi": "10.1056/NEJMoa1406281", "pmid": "25564897", "estudo": "APT trial", "ano": 2015 },
  "afirmado_protocolo": { "grade": "1A", "esmo_mcbs": "A", "nccn_affordability": null }
}
```

## 2. Quatro vereditos adversariais

```json
// verificacao-grade.json (Gael)
{ "regimen_id": "mama-adj-her2pos-th", "eixo": "GRADE", "afirmado_protocolo": "1A",
  "valor_rederivado": "2B", "status": "diverge",
  "justificativa": "APT é fase II de braço único (sem randomização): não sustenta qualidade 'alta'. Recomendação amplamente adotada (força condicional-a-forte), mas qualidade moderada-baixa → 2B.",
  "fonte": "https://doi.org/10.1056/NEJMoa1406281" }

// verificacao-mcbs.json (Bruna)
{ "regimen_id": "mama-adj-her2pos-th", "eixo": "ESMO-MCBS", "afirmado_protocolo": "A",
  "valor_rederivado": "n/a", "status": "diverge",
  "justificativa": "Formulário 1 (curativo) exige comparação randomizada. APT é braço único → não graduável. O 'A' afirmado não é sustentável pela metodologia MCBS.",
  "fonte": "https://www.esmo.org/guidelines/esmo-mcbs" }

// verificacao-custo.json (Caio)
{ "regimen_id": "mama-adj-her2pos-th", "eixo": "NCCN Affordability", "afirmado_protocolo": null,
  "valor_rederivado": 3, "status": "indeterminado",
  "justificativa": "Paclitaxel genérico (baixo custo) + trastuzumabe biológico/biossimilar por 1 ano (alto custo) + infusões e monitorização cardíaca → sustentabilidade média. Protocolo não afirmou nota, sem base para 'concorda/diverge'.",
  "fonte": "NCCN Evidence Blocks (referência EUA)" }

// verificacao-elegibilidade.json (Elton) — NÃO é nota, são listas computáveis
{ "regimen_id": "mama-adj-her2pos-th", "eixo": "elegibilidade", "status": "diverge",
  "criterios_inclusao": [
    {"campo": "her2", "operador": "=", "valor": "positivo"},
    {"campo": "tstage", "operador": "<=", "valor": "cT2"},
    {"campo": "node", "operador": "=", "valor": "N0"},
    {"campo": "feve", "operador": ">=", "valor": 50} ],
  "criterios_exclusao": [ {"campo": "cardiopatia_significativa", "operador": "=", "valor": true} ],
  "amplitude": "mais_amplo",
  "divergencia_vs_protocolo": "APT exigiu FEVE ≥50% na inclusão; o protocolo pede apenas 'função cardíaca preservada' (qualitativo). O app deve fixar o corte FEVE ≥50% para não indicar fora da população estudada.",
  "justificativa": "Critérios de Methods/eligibility do APT.",
  "fonte": "https://doi.org/10.1056/NEJMoa1406281" }
```

## 3. Consolidação (Consuelo) → `regimes-consolidados.json`
Selo = `divergencia` (GRADE e MCBS divergem). Flags sobem o que precisa de olho humano.

```json
{
  "regimen_id": "mama-adj-her2pos-th", "tumor": "mama", "cenario": "adjuvancia",
  "subtipo": "HER2 positivo", "nome": "TH",
  "afirmado_protocolo": { "grade": "1A", "esmo_mcbs": "A", "nccn_affordability": null },
  "verificacao": {
    "grade": { "status": "diverge", "valor_rederivado": "2B", "justificativa": "Braço único não sustenta 1A.", "fonte": "https://doi.org/10.1056/NEJMoa1406281" },
    "esmo_mcbs": { "status": "diverge", "valor_rederivado": "n/a", "justificativa": "Braço único não é graduável.", "fonte": "esmo.org/guidelines/esmo-mcbs" },
    "nccn_affordability": { "status": "indeterminado", "valor_rederivado": 3, "justificativa": "Custo médio; protocolo não afirmou.", "fonte": "NCCN Evidence Blocks (EUA)" },
    "elegibilidade": {
      "criterios_inclusao": [ {"campo":"her2","operador":"=","valor":"positivo"}, {"campo":"tstage","operador":"<=","valor":"cT2"}, {"campo":"node","operador":"=","valor":"N0"}, {"campo":"feve","operador":">=","valor":50} ],
      "criterios_exclusao": [ {"campo":"cardiopatia_significativa","operador":"=","valor":true} ],
      "divergencia_vs_protocolo": "Protocolo não fixa FEVE mínima (mais_amplo vs. APT)." }
  },
  "consolidacao": { "status": "divergencia", "selo_confianca": "divergencia",
    "flags": ["grade_afirmado_1A_insustentavel_braco_unico", "mcbs_afirmado_A_mas_nao_graduavel", "elegibilidade_mais_ampla_feve", "custo_contexto_BR_a_confirmar"] },
  "versao": 1, "atualizado_em": null, "revisado_por": null,
  "historico_versoes": [ { "versao": 1, "data": "2026-07-17", "origem": "extracao-inicial",
    "mudanca": "Primeira consolidação; 2 eixos divergem do afirmado.", "eixos_afetados": ["grade","esmo_mcbs"], "fonte": null, "decidido_por": null } ],
  "flags": ["revisao_prioritaria"]
}
```

## 4. Trecho do `relatorio-divergencias.md` (para o oncologista)

> ### 🔴 TH (mama HER2+ adjuvância) — DIVERGÊNCIA
> - **Evidência (GRADE):** protocolo afirma **1A**; re-derivação = **2B**. Motivo: APT é fase II de braço único, não sustenta qualidade "alta". Conduta permanece consagrada, mas o rótulo de força precisa de correção. [Tolaney 2015, NEJM]
> - **Benefício (ESMO-MCBS):** protocolo afirma **A**; escala **não se aplica** (n/a) a braço único. Sugerir remover o score ou anotar "não graduável".
> - **Elegibilidade:** protocolo pede "função cardíaca preservada"; o estudo exigiu **FEVE ≥50%**. Recomenda-se fixar o corte para o motor do app (evita indicação fora da evidência).
> - **Custo (NCCN):** estimado 3/5; confirmar contexto SUS/ANS (trastuzumabe incorporado).
>
> **Decisão do oncologista:** ☐ aceitar re-derivação ☐ manter protocolo ☐ escalar Tumor Board
```
