# Onda 3 — COLO DE ÚTERO (8 regimes) · tabela ANTES → DEPOIS

**Data:** 2026-09-18 · **Regras:** schema 2 + C1–C9 · **Base "antes":** RUN_ATIVO `2026-09-17-intake-revisao-4/v1` · **Saída:**
`onda-3-colo-utero/regimes-consolidados.json` (**não promovido**) · **Portão A:** passou, 8/8 (`portao-saida.txt`) · **DOIs:** 8 fontes + 7 adicionais resolvem.

**Fontes:** 8 DOIs registrados; C4: KEYNOTE-A18 2ª interina de SG (Lancet out/2024), EMPOWER-Cervical 1 SG final (EJC 2025), GOG-240 SG final
(Lancet 2017), GOG-204, JCOG0505; Cochrane: CD005342 (QRT adjuvante, 2016, GRADE), CD008285 (CCCMAC), CD013348 (anti-VEGF, 2021, GRADE),
CD006469 (QT metastática, 2012), CD007583. Transcrições por busca literal (`rederivar_colo_utero.py`).

## Placar

| | antes | **depois** |
|---|---|---|
| 1A | **7** | **2** — pembrolizumabe + QT CPS≥1 (KEYNOTE-826 final), cemiplimabe (EMPOWER final) |
| 1B | 0 | **3** — QRT adjuvante (**C9** Cochrane moderada), INTERLACE, KEYNOTE-A18 (interina) |
| 2A | 0 | **1** — bevacizumabe + QT (GOG-240 final; **não incluído → contra**) |
| 2C | 1 | 0 |
| indeterminado | 0 | **2** — paclitaxel + platina CPS<1 (GOG-169 sem HR/IC, SG NS), monoterapia 2ª/3ª linha (fase 2 braço único, classe de 7) |

Certeza A=3 · B=3 · indet=2. Sobrevivência como 1A: 2/7 (29%).

| # | regime | antes | depois | domínio decisivo | fonte do card |
|---|---|---|---|---|---|
| 1 | `colo-adj-cisplatina-crt` | 1A | **1B** | **C9**: Peters 2000 sem IC no abstract → Cochrane CD005342 (SG HR 0,56; 0,36–0,87; 297 mulheres; **moderada** → teto B). Esquema semanal ≠ cis+5-FU do Peters: tratado como classe (juízo) | Cochrane 2016 |
| 2 | `colo-qrt-induction-interlace` | 1A | **1B** | imprecisão −1: ≈120 óbitos; HR 0,60 (0,40–0,91), IC sup > 0,85 (convenção) | Lancet 2024 |
| 3 | `colo-qrt-io-keynote-a18` | 1A | **1B** | imprecisão −1: 2ª interina (C4), ≈226 óbitos; HR 0,67 (0,50–0,90) | **Lancet out/2024** (C4) |
| 4 | `colo-met-1l-pembrolizumabe-qt-cps1` | 1A | **1A** | nenhum: SG final HR 0,60 (0,49–0,74), efeito grande | JCO 2023 |
| 5 | `colo-met-1l-qt-cps-neg` | 1A | **indet.** | GOG-169: TRO/SLP sem HR/IC, SG NS; GOG-204 e JCOG0505 como adicionais (DECISÃO) | — |
| 6 | `colo-met-cemiplimabe-refrataria` | 1A | **1A** | nenhum: SG final HR 0,67 (0,56–0,80), ≥ 304 óbitos | **EJC 2025** (C4) |
| 7 | `colo-met-bevacizumabe-nao-incluido` | 1A | **2A** (contra) | nenhum rebaixado pelas regras (348 óbitos; HR 0,77; 0,62–0,95). **Divergência**: Cochrane CD013348 gradua o mesmo ensaio como **baixa** (1 estudo, aberto). Não incluído → contra | **Lancet 2017** (C4) |
| 8 | `colo-met-2l-monoterapia` | 2C | **indet.** | McGuire 1996: fase 2 braço único, ORR 17% sem IC, para uma classe de 7 agentes | — |

## Triangulação Cochrane

| regime | onda 3 | Cochrane | leitura |
|---|---|---|---|
| QRT adjuvante | B (C9) | CD005342: SG HR 0,56, **moderada** | é a fonte (C9) |
| bevacizumabe | A | CD013348: SG HR 0,77 (mesmo ensaio), **baixa** | **diverge para baixo** — o Cochrane rebaixou por RoB (aberto) e imprecisão (1 estudo). As regras do squad não rebaixam desfecho duro por cegamento e 348 óbitos passam o OIS. Item de referendo metodológico |
| QT 1L CPS<1 | indet. | CD006469 (2012): SG/SLP "não adequadamente reportadas"; sem comparação com BSC | converge com a incerteza |
| QRT definitiva (classe) | — | CD008285 (CCCMAC): QRT vs RT HR 0,81, sem diferença por esquema de QT | usado só para justificar "classe" no adjuvante (juízo) |
