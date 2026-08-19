# v2 — Reclassificação de selos (confronto real)

**Data:** 2026-07-22 · **Base:** `../v1/regimes-consolidados.json` (295 regimes)

Recálculo determinístico dos **status por eixo** e do **selo de confiança**, motivado pela auditoria
que mostrou o selo `confirmado` superdimensionado (79% dos "confirmados" eram "concorda" contra valor
`null`; custo 100% estimativa sem fonte; elegibilidade "concorda" sem veredito de match; um DOU de
confirmado retornando 404).

**Nada de conteúdo foi inventado ou reescrito.** `valor_rederivado`, `justificativa`, `fonte` e os
critérios de elegibilidade são idênticos ao v1 (verificado por diff). Só mudaram: `status` de cada eixo,
`consolidacao.selo_confianca`/`status`, `flags`, e o DOI do CheckMate 816.

## Regras aplicadas

**Status por eixo**
- `concorda` — só quando o protocolo afirmou um valor (`afirmado_protocolo != null`; na elegibilidade,
  `elegibilidade_protocolo != null` **e** `amplitude == "equivalente"`) **E** a re-derivação bateu.
- `diverge` — havia afirmação e não bateu (inclui elegibilidade `mais_amplo`/`mais_estreito`).
- `re_derivado` — o protocolo não afirmou nada: avaliação própria com fonte, mas sem confronto.
- `indeterminado` — faltou fonte (ou o DOI-fonte não resolve).
- `estimativa` — exclusivo do custo: número por composição qualitativa sem fonte primária resolvível.
  Não conta como confronto.

**Selo** (precedência): `divergencia` (≥1 diverge) → `confirmado` (≥1 `concorda`, sem diverge, sem
indeterminado crítico em grade/elegibilidade, e DOIs resolvem) → `incompleto` (indeterminado crítico
ou `doi_nao_resolvido`) → `re_derivado` (sólido, sem nenhum confronto).

**Validação de DOI (HTTP + Crossref)** — 218 DOIs distintos checados; **13 não resolvem** (404 em Crossref
e doi.org). Todo regime que cita um deles recebe `flag: doi_nao_resolvido` e não pode ser `confirmado`.

## Correções pontuais
- **CheckMate 816** (pulmão): DOI-fantasma `10.1056/NEJMoa2306893` (404) → `10.1056/NEJMoa2202170`
  (Forde, NEJM 2022, verificado 200). `flag: doi_corrigido`.

## Distribuição do selo

| Selo         | v1  | v2  |
|--------------|-----|-----|
| confirmado   | 248 | 50  |
| re_derivado  | —   | 158 |
| divergencia  | 10  | 19  |
| incompleto   | 37  | 68  |

Dos 50 `confirmado`: 40 têm confronto de ESMO-MCBS (protocolo declarou a nota e ela bateu) e 15 têm
elegibilidade `amplitude=equivalente` (5 têm ambos). GRADE e custo nunca sustentam `confirmado` sozinhos
(o protocolo não gradua GRADE; custo é sempre `estimativa`).

## DOIs mortos (13) — regimes afetados precisam de referência corrigida no próximo run
`10.1001/jama.2014.13346` · `10.1016/S0022-5347(05)64273-3` · `10.1016/S1470-2045(18)30572-X` ·
`10.1016/S1470-2045(20)30539-3` · `10.1016/S1470-2045(21)00027-3` · `10.1023/A:1008208307280` ·
`10.1056/NEJMoa021959` · `10.1056/NEJMoa043642` · `10.1056/NEJMoa060099` · `10.1056/NEJMoa2306073` ·
`10.1056/NEJMoa2309820` (ALINA) · `10.1200/JCO.2012.45.6414` · `10.1056/NEJMoa2306893` (CheckMate 816 — já corrigido).
