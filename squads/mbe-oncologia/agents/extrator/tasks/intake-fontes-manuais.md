---
task: "Intake de fontes manuais e reprocessamento seletivo"
order: 2
condicional: "existe >=1 PDF em data/input/fontes-manuais/"
input:
  - pdfs: data/input/fontes-manuais/*.pdf
  - mapa: data/input/fontes-manuais/fontes-manuais.map.json (opcional)
  - consolidado: output/<run>/v<n>/regimes-consolidados.json (versão corrente)
  - fontes_a_buscar: output/<run>/v<n>/fontes-a-buscar.json
  - frameworks: pipeline/data/{grade-framework,esmo-mcbs-framework,eligibility-extraction,fontes-confiaveis}.md
output:
  - manifesto: output/<run>/v<n+1>/fontes-manuais-intake.json
  - consolidado_novo: output/<run>/v<n+1>/regimes-consolidados.json
---

# Intake de fontes manuais

Reabre **cirurgicamente** os regimes cujo estudo-pivô chegou como PDF baixado à mão, re-deriva o que
dependia dele e acrescenta uma versão. Não toca em nenhum outro regime. É a contraparte de execução
do `pipeline/steps/step-02b-fontes-manuais.md` — leia-o para o fluxo completo.

## Guarda de entrada
Se `data/input/fontes-manuais/` não tem nenhum `.pdf` → **encerrar sem efeito** (nada a fazer).

## Process
1. **Casar** cada PDF a `regimen_id`(s), por precedência: mapa (`aplica_a`) → nome = `regimen_id` →
   nome = DOI (`/`→`_`) contra `referencia.doi` ou contra o DOI de um candidato de `fontes-a-buscar.json`.
   Sufixo `--...` no nome é ignorado no casamento.
2. **Manifesto**: escrever `fontes-manuais-intake.json` com `casados`, `orfaos`, `ambiguos`
   (schema no step-02b). Órfão/ambíguo **não** reprocessa — só registra.
3. **Re-extrair do PDF** (só nos casados): atualizar `referencia` (gravar DOI/estudo reais quando o
   PDF confirma um candidato `a confirmar`), `beneficio`, `toxicidades`. Campo ausente = `null`/`[]`.
4. **Re-derivar** (só nos casados), reusando os frameworks dos steps 03–06 sem editá-los:
   `verificacao.grade` obrigatório (era a lacuna); `esmo_mcbs`/`elegibilidade` se o pivô agora
   fornecer o dado; senão manter.
5. **Reconsolidar** (só nos casados): recomputar `consolidacao` com a `regra_selo` do Step 07;
   remover `grade_sem_estudo_pivo` das `lacunas`/`flags` quando o GRADE virou derivável; recalcular
   `status`/`selo_confianca`.
6. **Versionar**: em cada regime casado, **append** em `historico_versoes[]` uma entrada
   `origem: "fonte-manual"` (com `eixos_afetados`, `fonte` = DOI/arquivo), **incrementar** `versao`,
   preencher `atualizado_em`.
7. **Escrever `v<n+1>`**: copiar `v<n>`; substituir só os regimes casados; manter os demais idênticos;
   atualizar `meta.distribuicao_selo` e `meta.intake_fontes_manuais`; regravar `fontes-a-buscar.*`.

## Veto Conditions
- Alterar qualquer regime **não** casado → proibido (o resto do consolidado é imutável neste step).
- Preencher DOI/HR/toxicidade "de memória" em vez do que o PDF traz → proibido.
- Sobrescrever `historico_versoes` em vez de **append** → proibido.
- Reprocessar PDF órfão/ambíguo por adivinhação → proibido (registrar no manifesto e parar).
