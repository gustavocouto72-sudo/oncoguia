# Re-derivação GRADE — Etapa 1: Fundação

**Data:** 2026-09-17 · **Escopo:** método e portão, **nenhum valor tocado** · **Fora do escopo:** RUN_ATIVO,
`backend/data`, app, produção, tela/selos (rodada separada) · **Status:** PARADO ao fim da etapa, aguardando ok
para o piloto (renal).

Origem: `output/2026-09-17-auditoria-grade/RELATORIO-auditoria-grade.md` §4.1 (schema + 7 regras).

---

## 1a. Task reescrita — `agents/verificador-evidencia/tasks/rederivar-grade.md` (schema 2)

O eixo deixa de ser `valor_rederivado` + frase e vira bloco estruturado:

| campo | conteúdo | vocabulário |
|---|---|---|
| `desfecho_critico` | o desfecho que a certeza avalia | duros `SG · mortalidade · SLD · iDFS · SLE · SLR · controle_local`; substitutos `SLP · SLPr · ORR · RCp · MFS · TTP · DoR · outro_substituto` |
| `desenho` | `{tipo, cegamento, n, descricao}` | parte de **A**: `rct_fase3 · rct_fase2_3 · meta_analise_rct`; parte de **C**: `rct_fase2 · fase2_braco_unico · basket · observacional · serie_casos` |
| `efeito` | `{medida, valor, ic95[lo,hi], sentido_beneficio, eventos, transcricao, fonte_transcricao}` — **transcrito** da fonte | medida `HR · RR · OR · diferenca_absoluta · diferenca_medianas`; fonte `europepmc_abstract · europepmc_fulltext · pubmed_abstract · oa_pdf · crossref_abstract` |
| `pivo` | `{intervencao[], comparador, comparador_padrao_epoca, comparador_padrao_atual, primario_positivo, sustenta, por}` + opcionais `intervencao_nao_cobre`, `referencia_proposta` | booleanos obrigatórios |
| `dominios` | 5 × `{nota, por}` — `por` obrigatório **inclusive com nota 0** | `risco_vies · inconsistencia · indireta · imprecisao · vies_publicacao`; nota `0 · -1 · -2` |
| `elevacoes[]` | só inicial C **e sem rebaixamento** | `magnitude_grande +1 · magnitude_muito_grande +2 · dose_resposta +1 · confusao_oposta +1` |
| `certeza` | aritmética: inicial + Σ notas + Σ elevações, piso D | `A · B · C · D` |
| `substituto_excecao` | levanta o teto B da regra 2, sempre listado no WARN | `crossover_documentado · substituto_validado_no_tumor` + `por` |
| `pivo_nao_sustenta` | bool derivado (o portão confere) | |
| `recomendacao` | `{forca, direcao, base, sem_mcbs_por}` | `forte · condicional` × `a_favor · contra` |
| `valor_rederivado` | **derivado** (`1`/`2` + letra) — compat com tela e `content_hash` | |
| `status`, `justificativa`, `fonte`, `motivo_indeterminado` | como antes; `indeterminado` zera certeza/recomendação/valor | |

Decisões de desenho tomadas aqui (para o referendo saber que foram escolhas, não fatos):

- **Certeza é aritmética, sem "contrapartida".** A §4.1 do relatório dizia "nenhum domínio em −1 sem
  contrapartida declarada"; eu fechei em "A = todos os domínios em 0". Motivo: GRADE não compensa
  rebaixamento em RCT, e uma válvula de "contrapartida" seria o próximo atalho.
- **`valor_rederivado` continua número+letra sem direção** (`2B` para "condicional contra"). A direção
  está em `recomendacao.direcao`; como a tela é rodada separada, não inventei notação nova (`2B↓`) que a
  app não lê. Consequência: **até a rodada da tela, um "forte contra" ainda aparece como `1x`** —
  exatamente o problema do PALETTE; por isso esta rodada não publica.
- **`fonte` = DOI do regime.** Trocar referência (casos 07 e 14 da auditoria) é `pivo.referencia_proposta`
  → WARN → decisão do revisor. O verificador não muda o eixo `referencia` por conta própria.
- **Fase II parte de C e nunca chega a A** (também `rct_fase2` randomizado). É operacionalização do
  squad — o handbook só distingue RCT × observacional. Se o revisor quiser fase II randomizado
  partindo de B, é 1 linha em `DESENHO_INICIAL`.
- **Efeito grande** (para dispensar os 300 eventos) = RRR ≥ 30% **e** limite superior do IC ≤ 0,85.
  Calibrado nos casos da auditoria: Zhang NPC (0,43; 0,24–0,77) e PRODIGE 4 (0,57; 0,45–0,73) passam;
  COUGAR-02 (0,67; 0,49–0,92) e HIMALAYA (0,78; 0,65–0,93) não — como o relatório julgou.

Edições de fiação que acompanham (sem elas o schema 2 morreria no caminho):

- `agents/consolidador/tasks/consolidar.md` — o Step 07 **achatava** o eixo em `{status, valor,
  justificativa, fonte}`; agora transporta o bloco `grade` inteiro.
- `pipeline/steps/step-03-verificar-grade.md` — inputs e output atualizados; quality gate ganha "Portão A
  check [11] passa".
- `pipeline/data/grade-framework.md` — nota no topo apontando para a task (o resumo conceitual fica).

## 1b. Inputs declarados

- As 3 fichas (`mbe-grade-certeza`, `mbe-indirectness`, `mbe-magnitude-precisao`) são input declarado
  no front-matter e no step-03.
- **Handbook GRADE: chegou durante a etapa.** A sessão paralela `oncoguia-dc` copiou os 7 guias da
  direção para `pipeline/data/` (`grade-handbook.md` = índice com mapa *campo do schema 2 → guia/seção*,
  `guia-prompts-ebm-grade.md` = protocolo de execução, + 5 guias por domínio). Conferi no disco e li o
  índice, o guia de prompts e o "Mapeamento ao schema 2" dos guias de certeza, indireta e magnitude:
  **consistentes** com as regras; os limiares numéricos (0,95 · RRR 30% · MCBS ≥ 3) e a direção
  institucional são reconhecidos como operacionalização do squad (o próprio índice diz isso).
  Integrei na task: front-matter (`handbook` + `protocolo`), base metodológica ("guias prevalecem
  sobre as fichas"), citações de seção nos passos 3/5/6 e a **nota de comunicação** do §8 ("nunca
  'não há evidência'"). Os 8 arquivos estão **untracked** (não commitados) — são da outra sessão.
- **Regra nova vinda do guia de prompts (§7, passo 3):** *elevação só se não houve rebaixamento*. Não
  estava nas 7; entrou na task e no portão (caso sintético 09).

## 1c. Portão A — check [11] em `verificar_dados.py`

- Helper `eh_nao_incorporado(r)` extraído do check [7] (mesma regra da app: `incorporacao.status`,
  flag `nao_*`, sufixo do id) e reutilizado pela regra 5.
- `check_grade_schema2(r, bugs, warns)` aplica as 7 regras + forma. **Só julga blocos `schema: 2`**;
  legado é contado e ignorado → o portão do RUN_ATIVO (301 legados) continua passando: `~ [11] SKIP`.
- `parse_mcbs()` lê os 16 formatos reais do eixo ESMO-MCBS (`'4 (ribo); 3 (palbo)'` → 4;
  `'2-3'` → 2, faixa = piso; `'A (curativo)'` → A; `n/a…` → None). Tabela completa conferida.
- `_num_no_texto()` casa `0.72` / `0,72` / `0·72` (Lancet) / `0.720`, e rejeita `1.72` e `10.72`.
- FALHAS fecham o portão (exit 1). Exceções declaradas (`substituto_excecao`, `intervencao_nao_cobre`,
  `referencia_proposta`, pivô que não sustenta) saem num **WARN nominal** — é a lista que o referendo lê.

## 1d. Casos sintéticos — o portão barra cada regra

Pasta `fundacao/casos-sinteticos/` (`gerar_casos.py` → `regimes-consolidados.json` de clones de regimes
reais com **só** o bloco `grade` trocado por blocos inventados; `matriz_casos.py` → `resultado-casos.md`;
`portao-saida.txt` = saída crua do `verificar_dados.py` na pasta, exit 1). **Nada ali é evidência.**

| caso | regra | o portão disse | ok |
|---|---|---|---|
| 00 controle (RCT f3, SG, HR 0,68 0,55–0,84, 420 eventos, incorporado, MCBS 4) | — | passou limpo | ✓ |
| 01 A com HR 0,78 (0,65–0,93), eventos ausentes | 1 | "certeza A exige eventos ≥ 300 ou efeito grande — eventos=None" | ✓ |
| 02 SLP como crítico, indireta 0, certeza A | 2 | "indireta tem de ser ≤ −1"; "teto B (está A)" | ✓ |
| 03 `rct_fase2` + elevação +2 (aritmética fecha em A) | 3 | "parte de C — nunca A" | ✓ |
| 04 HR 0,82 (0,67–1,00), imprecisão 0, certeza B (RoB −1) | 4 | "imprecisão tem de ser ≤ −1 (limite superior 1.0 > 0,95)" | ✓ |
| 05a clone de não-incorporado, forte a favor | 5 | "regime NÃO incorporado com direção a_favor" | ✓ |
| 05b incorporado com MCBS 2, forte a favor | 5 | "forte a favor com ESMO-MCBS 2 — exige ≥ 3" | ✓ |
| 06a pivô sem o axitinibe do regime | 6 | "fármaco ausente: ['axitinibe']"; "sustenta=True contradiz"; "certeza ≤ B" | ✓ |
| 06b primário negativo, `sustenta: true`, A | 6 | "contradiz … (calculado False)"; "certeza ≤ B até trocar a referência" | ✓ |
| 07a valor 0,53 com transcrição dizendo 0,68 | 7 | "valor=0.53 NÃO aparece na transcrição" | ✓ |
| 07b transcrição vazia, status re_derivado | 7 | "sem transcrição da fonte o status é indeterminado" | ✓ |
| 09 observacional, RoB −1 **e** elevação +2 | 3 (§7) | "elevação com domínio rebaixado" | ✓ |
| 08 imprecisão −1 e certeza A | forma | "certeza A ≠ aritmética B" | ✓ |

`python3 matriz_casos.py` → exit 0 ("todos os casos se comportaram como esperado").
`python3 verificar_dados.py` (RUN_ATIVO) → continua **passou**, com `~ [11] SKIP … 301 legado`.

## O que o piloto vai esbarrar (para decidir antes, não durante)

1. **MCBS `n/a` em 111/301 regimes** (renal: sunitinibe, pazopanibe, não-claras). Com a regra 5, forte a
   favor nesses exige `recomendacao.sem_mcbs_por`. É o comportamento pedido — mas o volume é grande.
2. **Faixa `'2-3'` lida como 2** (piso). Conservador de propósito; 2 regimes no corpus.
3. **Casamento de fármaco é por grafia** (substring normalizada, sem sinônimos). A task manda o modelo
   escrever `pivo.intervencao` com a grafia dos `farmacos[].nome`; "5-FU" vs "fluorouracil" cai na
   regra 6 e precisa de `intervencao_nao_cobre` ou grafia igual.
4. **`content_hash`**: `valor_rederivado` muda → aprovações expiram (§4.4 da auditoria). Nesta rodada
   nada é promovido, então nada expira; o desenho do referendo em lote continua pendente da direção.

## Estado do disco

Modificados (não commitados, desta sessão): `verificar_dados.py`, `agents/verificador-evidencia/tasks/
rederivar-grade.md`, `agents/consolidador/tasks/consolidar.md`, `pipeline/steps/step-03-verificar-grade.md`,
`pipeline/data/grade-framework.md`. Novos: `output/2026-09-17-rederivacao-grade/fundacao/**`.
Untracked de outra sessão: `pipeline/data/grade-handbook.md` + 7 `guia-*.md`.
**RUN_ATIVO, backend/data, app, produção: intocados.**
