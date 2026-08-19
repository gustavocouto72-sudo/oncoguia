---
task: "Extrair regimes"
order: 1
input:
  - lote: output/lote.md (tumor, PDF, cenários)
  - schema: pipeline/data/schema-regime.md
output:
  - regimes: output/regimes-extraidos.json (lista de regimes no schema)
---

# Extrair regimes

Lê o PDF do protocolo e transcreve cada regime para o schema, com fidelidade total e zero julgamento de evidência.

## Process
1. Ler `output/lote.md` (tumor, caminho do PDF, cenários).
2. Percorrer o capítulo do tumor. Para cada **cenário** (adjuvância, neoadjuvância, metastático, manutenção…) e cada **subtipo** (ex.: HER2+, triplo-negativo), identificar os regimes listados (a, b, c…).
3. Para cada regime, preencher o schema de `pipeline/data/schema-regime.md`: `tumor`, `cenario`, `subtipo`, `nome`, `esquema` (fármacos + doses + ciclos), `elegibilidade_protocolo` (texto literal), `referencia` (citação + DOI/PMID + estudo + ano), e `afirmado_protocolo` (GRADE/ESMO-MCBS/NCCN que o PDF declara, ou `null`).
4. Estruturar a **elegibilidade computável** (ver seção "Elegibilidade computável" do schema):
   - Emitir **uma vez** no topo do output a lista `campos_primitivos` — o vocabulário de campos primitivos do tumor (com `tipo` e, para `enum`/`integer` fechado, `opcoes`; `unidade`/`faixa` quando útil). É o contrato de inputs que a app renderiza. Para mama, o núcleo é: `her2`, `rh`, `grau`, `ki67`, `tamanho_cm`, `t`, `n`, `linfonodos_pos`, `m`, `cenario`, `pcr`, `menopausa`, `feve`, `ecog`, `clcr`, `linhas_previas` (mais os primitivos que os critérios do lote exigirem — biomarcadores, exposições prévias, scores).
   - Para cada regime, preencher `elegibilidade = {criterios, regra}`. A `regra` é a expressão booleana (gramática `and`/`or`/`not`/`eq`/`ne`/`gt`/`gte`/`lt`/`lte`/`in`/`ref`) que decide "entra/não-entra", só sobre primitivos. Manter o texto literal em `elegibilidade_protocolo` intacto — a `regra` é a versão avaliável dele (mais o subtipo/cenário que a seção do PDF já fixa).
   - **Nenhum composto opaco.** Todo critério derivado (`CRITERIO_*`, `alto_risco*`, `DOENCA_RESIDUAL_*`) entra em `criterios[]` com `id`, `label` humano e `expr` sobre primitivos, e é referenciado na `regra` por `{"ref": "id"}`. Exceção: escore clínico que não se decompõe (ex.: CPS+EG, PD-L1 CPS) vira primitivo `score` (`score_clinico: true`), o oncologista digita — não vira derivado. Um "alto risco" que o protocolo **não define** também não é derivado: vira primitivo `boolean` (ex.: `alto_risco_clinico`).
   - Se o protocolo não declara critério algum além do subtipo/cenário, `regra` codifica só esses (ou `null` se nada); nunca inventar limiar não escrito na fonte (ex.: "função cardíaca preservada" → operacionalizar como `feve ≥ 50` num critério nomeado rotulado, deixando claro o mapeamento).
5. **Derivar** `beneficio` e `toxicidades` (não sair do PDF do protocolo — ele não traz esses dados):
   - `beneficio` = `{desfecho_principal, magnitude, fonte}` — **do estudo-pivô** (o da `referencia`): o desfecho de eficácia (com direção) e o tamanho do efeito **exatamente como o estudo traz** (HR, ganho absoluto, mediana, pCR…), com o DOI/URL como `fonte`. Ex.: CALGB 9741 → `"DFS HR ~0,74; SG HR ~0,69"`. É captura fiel do estudo, **não** julgamento de benefício (isso é da Bruna). Sem estudo-pivô com desfecho quantificável → `beneficio: null` e sinalizar em `flags`.
   - `toxicidades` = lista de `{nome, severidade, conduta?, fonte}` — **derivada dos fármacos do regime** (`farmacos[]`, via bula/ficha técnica) **e da tabela de segurança do estudo-pivô**. Liste as principais toxicidades de cada fármaco que compõe o regime. Ex.: AC-T → cardiotoxicidade (antraciclina), neutropenia febril, alopecia, náusea, neuropatia (taxano). `severidade` ∈ `grave|moderada|leve` (grau ≥3 comum → `grave`); `conduta` = manejo padrão ou `null`; `fonte` = `"Bula/ficha técnica: <fármaco>"` ou DOI do estudo. Baseie-se em **fonte primária/bula; nada inventado**. Se o protocolo **não especifica o(s) fármaco(s)** (ex.: "quimioterapia a critério") → `toxicidades: []` e sinalizar em `flags` (ex.: `"toxicidades_sem_base: fármaco não especificado"`).
6. Campos sem informação no PDF/estudo = `null` (ou `[]` para `toxicidades`). Ambiguidades → `flags`.
7. Salvar `output/regimes-extraidos.json`.

## Veto Conditions
- Regime sem `esquema` ou sem `referencia` → marcar `flags: ["referencia_ausente"]`, não descartar.
- Qualquer dose/DOI "preenchido de memória" → proibido.
- `beneficio.magnitude` (HR/número) sem base no estudo-pivô da `referencia`, ou `toxicidades` sem base na bula do fármaco/tabela de segurança do estudo → proibido. Campo sem base = `null`/`[]` **com flag**.
- `toxicidades` derivada do PDF do protocolo (ele não lista toxicidades) → origem errada: derivar sempre dos `farmacos[]` (bula) + estudo-pivô.
- Critério de elegibilidade derivado (`alto_risco*`, `DOENCA_RESIDUAL_*`, `CRITERIO_*`) sem `expr` sobre primitivos → proibido: ou define sobre primitivos em `criterios[]`, ou (se não decompõe) vira primitivo `score`/`boolean`.
- `regra` ou `expr` citando `campo` que não está em `campos_primitivos` → proibido.
- Limiar numérico em `expr` que não está escrito no protocolo/estudo, fora de operacionalizações-padrão explicitadas no `label` (ex.: FEVE ≥50%) → proibido.

