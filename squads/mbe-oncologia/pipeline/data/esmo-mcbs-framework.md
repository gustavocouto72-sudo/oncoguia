# Framework — ESMO-MCBS (magnitude do benefício clínico)

Mede o **tamanho** do benefício (complementa o GRADE, que mede a confiança).

## Escolha do formulário pelo cenário
- **Curativo / (neo)adjuvante → Formulário 1.** Notas em letra: **A / B / C**. `A` e `B` = benefício substancial.
- **Não-curativo / paliativo / avançado → Formulários 2–3.** Notas em número: **5 / 4 / 3 / 2 / 1**. `5` e `4` = benefício substancial.

## Insumos da nota
- Hazard ratio (OS/PFS/DFS) e **limite inferior do IC**.
- **Ganho absoluto** (meses de OS/PFS; ganho em sobrevida livre de doença).
- Qualidade de vida e toxicidade (podem subir/descer a nota).

## Regras práticas
- **Estudo de braço único** (fase II sem comparador) normalmente **não é graduável** → `n/a` com justificativa (a escala exige comparação randomizada). Ex.: esquema TH/APT.
- Quando existir **scorecard oficial do ESMO** para a indicação, conferir contra ele e citar.
- O protocolo Orizonti já traz vários `ESMO-MCBS score = A`; o verificador confirma ou diverge, não copia.

## Saída
`status` + `valor_rederivado` (ex.: `A`, `4`, `n/a`) + `justificativa` (HR/ganho/QoL) + `fonte` (scorecard/estudo).

> Referência da metodologia: ESMO-MCBS v1.1 (Annals of Oncology, 2017) e scorecards em esmo.org. Hematologia usa a variante ESMO-MCBS:H.
