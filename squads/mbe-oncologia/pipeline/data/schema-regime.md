# Schema do regime (dado computável)

Cada regime extraído/consolidado segue este formato. É o contrato entre o squad e a
aplicação (o app consome exatamente isto). Espelha as tabelas propostas no Supabase:
`protocol_regimens`, `regimen_axis_evaluations`, `regimen_versions`.

```json
{
  "regimen_id": "mama-adj-her2pos-th",
  "tumor": "mama",
  "cenario": "adjuvancia",
  "subtipo": "HER2 positivo",
  "nome": "TH",
  "esquema": "Paclitaxel 80 mg/m² + Trastuzumabe semanal por 12 semanas → Trastuzumabe 6 mg/kg 21/21 dias (1 ano total)",
  "farmacos": [
    {"nome": "Paclitaxel", "dose": "80 mg/m²", "via": "EV", "frequencia": "semanal x12"},
    {"nome": "Trastuzumabe", "dose": "8→6 mg/kg", "via": "EV", "frequencia": "21/21 dias, 1 ano"}
  ],
  "elegibilidade_protocolo": "Câncer de mama invasivo, HER2+, T ≤3 cm, N0 + função cardíaca preservada",
  "elegibilidade": {
    "criterios": [
      {
        "id": "funcao_cardiaca_preservada",
        "label": "Função cardíaca preservada (FEVE ≥50%)",
        "expr": {"gte": ["feve", 50]}
      }
    ],
    "regra": {
      "and": [
        {"eq": ["her2", "positivo"]},
        {"lte": ["tamanho_cm", 3]},
        {"eq": ["n", "N0"]},
        {"ref": "funcao_cardiaca_preservada"}
      ]
    }
  },
  "referencia": {
    "citacao": "Tolaney SM et al. Adjuvant paclitaxel and trastuzumab for node-negative, HER2-positive breast cancer. N Engl J Med. 2015;372(2):134-141.",
    "doi": "10.1056/NEJMoa1406281",
    "pmid": "25564897",
    "estudo": "APT trial",
    "ano": 2015
  },
  "afirmado_protocolo": { "grade": null, "esmo_mcbs": null, "nccn_affordability": null },
  "beneficio": {
    "desfecho_principal": "↑ sobrevida livre de doença invasiva (iDFS) em 3 anos",
    "magnitude": "iDFS 98,7% em 3 anos (braço único, sem comparador)",
    "fonte": "10.1056/NEJMoa1406281"
  },
  "toxicidades": [
    {"nome": "Neuropatia periférica", "severidade": "moderada", "conduta": "reduzir/suspender paclitaxel conforme grau", "fonte": "Bula/ficha técnica: Paclitaxel"},
    {"nome": "Disfunção cardíaca (queda de FEVE)", "severidade": "grave", "conduta": "monitorar FEVE; suspender trastuzumabe se queda significativa", "fonte": "Bula/ficha técnica: Trastuzumabe"}
  ],
  "verificacao": {
    "grade":        { "status": "", "valor_rederivado": "", "justificativa": "", "fonte": "" },
    "esmo_mcbs":    { "status": "", "valor_rederivado": "", "justificativa": "", "fonte": "" },
    "nccn_affordability": { "status": "", "valor_rederivado": "", "justificativa": "", "fonte": "" },
    "elegibilidade": {
      "criterios_inclusao": [ {"campo": "her2", "operador": "=", "valor": "positivo"},
                              {"campo": "tstage", "operador": "<=", "valor": "cT1c"},
                              {"campo": "node", "operador": "=", "valor": "N0"} ],
      "criterios_exclusao": [ {"campo": "feve", "operador": "<", "valor": 50} ],
      "divergencia_vs_protocolo": ""
    }
  },
  "consolidacao": { "status": "", "selo_confianca": "", "flags": [] },
  "versao": 1,
  "atualizado_em": null,
  "revisado_por": null,
  "historico_versoes": [
    {
      "versao": 1,
      "data": "2026-07-17",
      "origem": "extracao-inicial",
      "mudanca": "Primeira consolidação do regime a partir do protocolo institucional.",
      "eixos_afetados": [],
      "fonte": null,
      "decidido_por": null
    }
  ],
  "flags": []
}
```

## Notas
- `cenario`: adjuvancia | neoadjuvancia | metastatico | manutencao | localmente-avancado.
- `status` de cada eixo: `concorda` | `re_derivado` | `diverge` | `indeterminado` (e `estimativa`, exclusivo do eixo de custo). Semântica:
  - `concorda`: **havia valor afirmado pelo protocolo** (`afirmado_protocolo != null`; na elegibilidade, `elegibilidade_protocolo != null`) **E** a re-derivação bateu com ele. É o único status que representa confronto real bem-sucedido.
  - `diverge`: havia afirmação do protocolo e a re-derivação **não** bateu.
  - `re_derivado`: o protocolo **não afirmou nada** neste eixo. A avaliação é própria (own assessment), sólida e com fonte, mas **não houve confronto** — nunca marcar `concorda` aqui.
  - `indeterminado`: faltou fonte (a escada de APIs não resolveu, ou o DOI-fonte não resolve).
  - `estimativa` (só custo): valor derivado por composição de custo **sem fonte primária resolvível** (ex.: "estimativa qualitativa"). Não é `concorda` e **não conta como confronto** para o selo.
- `selo_confianca`: `confirmado` | `re_derivado` | `divergencia` | `incompleto`. Semântica:
  - `confirmado`: **houve confronto real** — ao menos um eixo `concorda` — **e** nada `diverge`, nenhum `indeterminado` crítico (grade/elegibilidade) e o DOI-fonte resolve (HTTP + Crossref). Só isso é "carimbo verde".
  - `re_derivado`: avaliação própria sólida em todos os eixos, mas **sem nenhum confronto** (nenhum `concorda`). Confiável, mas o protocolo não deu o que confrontar.
  - `divergencia`: ≥1 eixo `diverge`. Vai ao topo do relatório humano.
  - `incompleto`: ≥1 eixo `indeterminado` crítico, **ou** o DOI-fonte não resolve (`doi_nao_resolvido`) — nesse caso o regime **não pode** ser `confirmado`.
- `elegibilidade_protocolo` (topo): **texto literal** do protocolo, mantido intacto — é o que o Verificador de Elegibilidade confronta contra o estudo-pivô. Não mexer neste campo.
- `elegibilidade` (objeto novo, ver abaixo): a **regra computável** que o app avalia para decidir "entra / não entra", mais os critérios nomeados (com `label` humano) que a app usa para explicar o porquê. Substitui a antiga lista `{campo, operador, valor}` por uma expressão booleana sobre campos primitivos.

## Elegibilidade computável (`campos_primitivos` + `elegibilidade`)

A elegibilidade deixa de ser texto opaco ou compostos sem definição. Passa a ter duas partes:

### 1. `campos_primitivos` — vocabulário por tumor (nível do lote)
Emitido **uma vez** no topo do `regimes-extraidos.json` (o lote é de um tumor só). É o contrato de
**inputs** que a app renderiza: cada campo que uma regra de elegibilidade pode citar. A app lê esta
lista para saber que widget mostrar (enum → select, number → campo numérico, boolean → toggle,
score → campo numérico que o oncologista digita).

Cada entrada:
```json
{ "campo": "ki67", "tipo": "number", "unidade": "%", "label": "Ki-67" }
{ "campo": "her2", "tipo": "enum", "opcoes": ["positivo", "negativo", "baixa_expressao"], "label": "HER2" }
{ "campo": "linfonodos_pos", "tipo": "integer", "label": "Nº de linfonodos positivos" }
{ "campo": "pcr", "tipo": "boolean", "label": "Resposta patológica completa (pCR)" }
{ "campo": "cps_eg", "tipo": "score", "score_clinico": true, "faixa": [0, 6], "label": "Escore CPS+EG" }
```
- `tipo`: `enum` | `number` | `integer` | `boolean` | `score`.
- `opcoes`: obrigatório para `enum` (e `integer` quando é escala fechada, ex.: grau `[1,2,3]`).
- `unidade`, `faixa`: opcionais (metadados de UI/validação).
- `score` + `score_clinico: true`: **exceção prevista** — um escore clínico que **não se decompõe** em
  primitivos mais simples (ex.: CPS+EG, PD-L1 CPS). O oncologista **digita** o valor; nunca vira critério
  derivado. Um `boolean` que o oncologista responde diretamente (ex.: `crise_visceral`) também é primitivo,
  não derivado.

### 2. `elegibilidade` — regra por regime
Objeto por regime, ao lado de `elegibilidade_protocolo`:
```json
"elegibilidade": {
  "criterios": [ { "id": "...", "label": "Alto risco — grupo B", "expr": { ...expr... } } ],
  "regra": { ...expr... }
}
```
- `regra`: a expressão booleana que é o **portão final** (entra ⇔ `regra` avalia `true`). Pode referenciar
  critérios nomeados via `{"ref": "id"}`. `null` quando o protocolo não declara critério algum além do
  subtipo/cenário já codificados na própria `regra`.
- `criterios[]`: subexpressões **nomeadas e rotuladas** — os "compostos" clínicos (alto risco, doença
  residual, endócrino-sensível…) que valem uma explicação na UI. Cada um tem `id`, `label` humano e `expr`.
- **Nenhum composto opaco.** Todo critério derivado — `CRITERIO_*`, `alto_risco*`, `DOENCA_RESIDUAL_*` — tem
  `expr` sobre primitivos. Se um "alto risco" **não vem definido** no protocolo, ele **não** é derivado:
  vira um primitivo `boolean` (`alto_risco_clinico`) que o oncologista responde — mesma lógica do score.

### Gramática das expressões (`expr`)
Formato avaliável por máquina, árvore de nós:
- Lógicos: `{"and": [expr, …]}` · `{"or": [expr, …]}` · `{"not": expr}`
- Comparações `{op: [campo, valor]}`, `op` ∈ `eq` · `ne` · `gt` · `gte` · `lt` · `lte`
- Pertinência: `{"in": [campo, [v1, v2, …]]}`
- Referência a critério nomeado: `{"ref": "id_do_criterio"}`

O primeiro elemento de uma comparação é sempre o `campo` (um primitivo de `campos_primitivos`); o segundo é
o literal. Exemplo — alto risco grupo B do monarchE:
```json
{"and": [
  {"in": ["linfonodos_pos", [1, 2, 3]]},
  {"or": [ {"eq": ["grau", 3]}, {"gte": ["ki67", 20]}, {"gte": ["tamanho_cm", 5]} ]}
]}
```

### `beneficio` (dado descritivo, derivado do estudo-pivô — não graduado)
**Origem: o estudo-pivô da `referencia`** (o protocolo institucional em geral não traz o desfecho quantificado).
Captura, sem julgamento, o **desfecho de eficácia** do estudo-pivô. É insumo para o Verificador de Benefício
(Bruna), não o veredito ESMO-MCBS (esse fica em `verificacao.esmo_mcbs`).
- `desfecho_principal`: o desfecho reportado, com direção (ex.: `"↑ sobrevida livre de doença"`, `"↑ sobrevida global"`, `"↑ sobrevida livre de progressão"`).
- `magnitude`: o tamanho do efeito como aparece na fonte (ex.: `"DFS HR ~0,74; SG HR ~0,69"`, `"ganho absoluto de SLP 4,2 meses"`, `"pCR 64,8% vs 51,2%"`). Só o que a fonte reporta — nada calculado de cabeça.
- `fonte`: DOI (ou URL) do estudo-pivô. Se o protocolo trouxer o desfecho, pode ser fonte alternativa.
- Sem estudo-pivô com desfecho quantificável → `beneficio: null` e sinalizar em `flags`. Nunca inventar HR ou número.

### `toxicidades` (lista descritiva, derivada dos fármacos — não graduada)
**Origem: os fármacos que compõem o regime** (`farmacos[]`) — bula/ficha técnica de cada droga — **e a
tabela de segurança do estudo-pivô**. O PDF do protocolo **não** é a fonte (não lista toxicidades). Lista as
principais toxicidades dos fármacos do regime; a app as exibe para apoiar a decisão clínica.
- Cada item: `{nome, severidade, conduta?, fonte}`.
- `severidade`: `grave` | `moderada` | `leve` (eventos grau ≥3 comuns na bula/estudo → `grave`).
- `conduta`: manejo padrão (ex.: "monitorar FEVE", "G-CSF profilático"); `null` se não aplicável.
- `fonte`: de onde a toxicidade foi derivada — `"Bula/ficha técnica: <fármaco>"` ou DOI do estudo-pivô. Baseie-se em **fonte primária/bula**; nada inventado.
- Regime cujo(s) fármaco(s) o protocolo **não especifica** (ex.: "quimioterapia a critério") → sem base para derivar → `toxicidades: []` **e** sinalizar em `flags` (ex.: `"toxicidades_sem_base: fármaco não especificado"`).

## Versionamento (`historico_versoes[]`)
Espelha a tabela `regimen_versions` do Supabase. Toda mudança aceita num checkpoint humano
(Step 08 revisão, ou Step 10 triagem de atualização) **acrescenta** uma entrada — nunca sobrescreve.
Cada entrada registra:
- `versao`: inteiro incremental (bate com o `versao` do topo, que aponta para a versão corrente).
- `data`: quando a versão passou a valer (YYYY-MM-DD).
- `origem`: `extracao-inicial` | `revisao-humana` | `atualizacao-vigilancia` | `fonte-manual`.
- `mudanca`: descrição clínica do que mudou (1 frase).
- `eixos_afetados`: subconjunto de `["grade","esmo_mcbs","nccn_affordability","elegibilidade"]`.
- `fonte`: DOI/URL que motivou a mudança (ou `null` na extração inicial).
- `decidido_por`: oncologista que aprovou no checkpoint (`null` até a primeira revisão humana).

Regra: o Consolidador cria a `versao 1` (`origem: extracao-inicial`); os checkpoints 08 e 10
acrescentam versões seguintes. O app sempre lê a versão corrente (`versao` do topo) mas pode
auditar toda a trilha por `historico_versoes`.

O intake de fontes manuais (Step 02b) acrescenta versões com `origem: fonte-manual` — quando um
estudo-pivô que faltava é baixado à mão (`data/input/fontes-manuais/`), o regime correspondente é
reprocessado e ganha uma nova versão; os demais regimes ficam intactos. Ver
`pipeline/steps/step-02b-fontes-manuais.md`.
