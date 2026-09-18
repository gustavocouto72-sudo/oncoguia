---
task: "Re-derivar GRADE"
order: 1
input:
  - regimes: output/regimes-extraidos.json
  - framework: pipeline/data/grade-framework.md
  - certeza: pipeline/data/mbe-grade-certeza.md
  - indireta: pipeline/data/mbe-indirectness.md
  - imprecisao: pipeline/data/mbe-magnitude-precisao.md
  - handbook: pipeline/data/grade-handbook.md   # índice dos 7 guias MBE da direção (2026-09-17) — prevalece sobre as fichas mbe-*.md
  - protocolo: pipeline/data/guia-prompts-ebm-grade.md
  - fontes: pipeline/data/fontes-confiaveis.md
output:
  - veredito: output/verificacao-grade.json (bloco `grade` schema 2 por regime — ver "Output Format")
schema: 2
---

# Re-derivar GRADE (schema 2 — estruturado, por domínio)

Re-deriva, **por desfecho crítico e com a fonte aberta**, a **certeza da evidência** (A/B/C/D) e a
**recomendação** (força + direção) de cada regime, e confronta com o que o protocolo afirmou.

Esta versão substitui o campo livre `valor_rederivado` + frase por um bloco estruturado. A razão está
na auditoria de 2026-09-17 (`output/2026-09-17-auditoria-grade/RELATORIO-auditoria-grade.md`): sem
checklist obrigatório, 177/301 regimes viraram `1A` pelo atalho *"fase 3 + ganho de SG → 1A"*, sem
nenhum domínio de rebaixamento avaliado, e o número passou a ser lido como "qualidade do ensaio" em vez
de força/direção da recomendação (inclusive em regimes que a instituição **não** incorpora).

**Divisão de trabalho:** o modelo **preenche** o bloco; o Portão A (`verificar_dados.py`, check [11])
**barra** o que não fecha. Nenhuma das regras abaixo é "sugestão": um bloco que viola qualquer uma
não passa do portão e volta para o agente.

## Base metodológica (inputs declarados)

1. `pipeline/data/mbe-grade-certeza.md` — regra-mestra `certeza = inicial − rebaixamentos + elevações`,
   **por desfecho**, 5 domínios.
2. `pipeline/data/mbe-indirectness.md` — 4 cenários de indireta (população / intervenção / comparador /
   desfecho); **desfecho substituto é indireta**.
3. `pipeline/data/mbe-magnitude-precisao.md` — imprecisão: IC cruzando limiar, OIS, **< 300 eventos**;
   priorizar efeito absoluto; efeito frágil não sustenta "benefício substancial".
4. `pipeline/data/grade-handbook.md` — índice dos **7 guias MBE da direção** (2026-09-17), com o mapa
   *campo do schema 2 → guia/seção*. `guia-prompts-ebm-grade.md` é o protocolo de execução (PICO → RoB
   → GRADE passo-a-passo → output); `guia-grade-certeza`, `guia-grade-indiretas`,
   `guia-grade-aplicabilidade`, `guia-magnitude-precisao`, `guia-revisoes-sistematicas`,
   `guia-dano-observacional` são as fichas de consulta por domínio. **Em conflito, os guias prevalecem
   sobre as fichas `mbe-*.md`**, que ficam como lembrete de bolso.
5. `pipeline/data/fontes-confiaveis.md` — escada de APIs abertas (Crossref → Europe PMC → Unpaywall /
   OpenAlex → PubMed). É **a única** forma de abrir a fonte.

## Process

1. Para cada regime, resolver o **pivô** pela `referencia.doi`: Crossref confirma o DOI (título, ano,
   periódico) → Europe PMC (`DOI:<DOI>`, `resultType=core`) traz o `abstractText` e, se OA, o texto
   completo → Unpaywall/OpenAlex para versão OA de paywall → sem DOI, busca por termo e volta ao início.
2. **Transcrever, não lembrar.** Copiar do abstract/texto a frase que traz o desfecho crítico com
   N, HR (ou medida equivalente), IC 95% e, se houver, nº de eventos — para `efeito.transcricao`.
   Memória do modelo **nunca** é fonte. Fonte inacessível depois da escada inteira = `indeterminado`,
   sem exceção e sem "valor provável".
3. **Escolher o desfecho crítico** (o que o paciente valoriza e o protocolo usa para indicar o regime):
   SG quando demonstrada; senão o desfecho duro disponível (SLD/iDFS/SLE/SLR, controle local,
   mortalidade); senão o substituto (SLP/SLPr/ORR/RCp/MFS) — **declarado como substituto**
   (classificação obrigatória *patient-important* × *surrogate*: `guia-prompts-ebm-grade.md` §2;
   substituto é indireta por natureza: `guia-grade-indiretas.md` §3).
4. **Conferir se o pivô sustenta** o regime (bloco `pivo`): a intervenção do ensaio contém todos os
   `farmacos[]` do regime (escrever `pivo.intervencao` com a **mesma grafia** dos `farmacos[].nome` —
   o portão casa por substring normalizada, não por sinônimo); o comparador era o padrão da época (e é, ou não, padrão atual); o desfecho
   primário foi positivo. Ensaio negativo no primário, comparação de esquemas usada como "vs padrão",
   ou fármaco do regime ausente do braço experimental = **pivô não sustenta** — declarar, não contornar.
5. **Avaliar os 5 domínios**, cada um com nota `0 | -1 | -2` **e uma frase** (`por`) — inclusive quando
   a nota é 0 (dizer *por que* não rebaixou é parte do veredito). Desenho define a certeza inicial;
   a certeza final é aritmética (o portão recalcula). Passo-a-passo em `guia-prompts-ebm-grade.md` §7
   (baseline → domínios com justificativa específica → **elevação só quando não houve rebaixamento** →
   síntese); critério de cada domínio no mapa do `grade-handbook.md`.
6. **Recomendação**: força (`forte` | `condicional`) e direção (`a_favor` | `contra`) a partir de
   benefício × dano, certeza, magnitude (ESMO-MCBS já derivado no eixo vizinho), valores/custo **e a
   decisão institucional** — regime não incorporado tem direção `contra` por definição (a instituição
   não o recomenda), com `base` dizendo o motivo. Balança benefício-risco + valores:
   `guia-prompts-ebm-grade.md` §8; NNT ≈ NNH = intervenção marginal, nunca `forte`:
   `guia-magnitude-precisao.md` §3.
7. `status` como antes: `concorda` **só** com `afirmado_protocolo != null` e valor batendo; `diverge`
   quando afirmado e não bate; `re_derivado` quando o protocolo não graduou; `indeterminado` quando a
   escada falhou ou a fonte não traz o efeito.
8. Gerar `valor_rederivado` **derivado** (`1`/`2` + letra) só para compatibilidade com a tela e o
   `content_hash`; nunca preenchê-lo antes de fechar certeza e força.
9. Salvar o JSON.

## As 7 regras determinísticas (o portão barra)

| # | regra | o que o portão faz |
|---|---|---|
| 1 | **Certeza `A`** exige: desenho que parte de A (RCT / meta-análise de RCT) **e** desfecho crítico duro **e** IC exclui nulo **e** (eventos ≥ 300 **ou** efeito grande) **e** todos os 5 domínios em 0. **"Efeito grande" = RRR ≥ 30% com limite superior do IC ≤ 0,85 — CONVENÇÃO DO SQUAD sujeita a referendo, não regra GRADE canônica** (o GRADE fala em "efeito grande" sem número fechado) | FALHA se `certeza=A` sem qualquer uma delas |
| 2 | **Substituto sem SG** (SLP/SLPr/ORR/RCp/MFS/TTP/DoR como desfecho crítico) → `indireta ≤ −1` e **teto B**. **C8:** em cenário **curativo** (adjuvância, neoadjuvância, localmente avançado/QRT definitiva, localizado) **SLD/iDFS/SLE/SLR/controle local são desfecho crítico DURO**, não substituto — primário aceito por agência; esperar SG leva uma década. Em doença **metastática** só SG/mortalidade são duros, e declarar SLD/iDFS num regime metastático é FALHA. Exceção só declarada em `substituto_excecao` (`crossover_documentado` \| `substituto_validado_no_tumor`) com `por` — e o portão lista todas as exceções para o referendo | FALHA se teto violado sem exceção; WARN nominal com exceção |
| 3 | **RCT parte de A independente da fase** (C5) — fase II randomizado cai por imprecisão (−2 quando cumpre os critérios da ficha). **Braço único / basket / observacional** → inicial **C**; sobe só por `elevacoes` (e só sem rebaixamento), **nunca A** | FALHA se desenho de inicial C está em `A`, ou `B` sem `elevacoes`; FALHA se há elevação com domínio rebaixado |
| 4 | **Imprecisão automática** (−1): IC de 95% com limite superior > 0,95 (benefício < 1) ou inferior < 1,05 (benefício > 1); IC reportado a outro nível que **não exclui o nulo** (C3: o colchão 0,95 só vale para IC de exatamente 95% — um IC 99,8% que exclui o nulo é evidência mais segura); diferença absoluta com IC incluindo 0; eventos < 300 sem efeito grande; **análise interina sem versão mais madura** (C4). **Muito séria** (−2, C5): eventos < 300 **e** IC que não exclui o nulo a 95% (ou reportado abaixo de 95%) | FALHA se `imprecisao` acima do mínimo exigido |
| 5 | **Força `forte` a favor** exige: certeza ≥ B **e** ESMO-MCBS ≥ 3 (escala paliativa) ou A/B (curativa) — ou MCBS `n/a` com `recomendacao.sem_mcbs_por` — **e** regime incorporado. **Não incorporado → `direcao = contra`** (forte ou condicional) | FALHA em qualquer combinação fora disso |
| 6 | **Pivô tem de sustentar**: `pivo.intervencao` ⊇ `farmacos[]` do regime, `comparador_padrao_epoca = true`, `primario_positivo = true`. Se não sustenta: `pivo_nao_sustenta = true`, certeza ≤ B, e a recomendação não pode ser `forte a_favor` até trocar a referência. Comparador obsoleto (`comparador_padrao_atual = false`) rebaixa **só quando muda a decisão de hoje** (C2): declarar `comparador_muda_decisao` e dizer por quê em `pivo.por` (ex.: vs IFN-α em 1ª linha — ninguém escolhe contra IFN em 2026 → rebaixa; everolimo em 2ª linha pós-TKI, indicação idêntica → não) | FALHA se algum `farmacos[].nome` não aparece em `pivo.intervencao` (exceto `intervencao_nao_cobre` com `indireta ≤ −1`), se `sustenta` contradiz os 3 campos, se pivô não sustenta com `certeza=A` / `forte a_favor`, se comparador obsoleto sem `comparador_muda_decisao`, ou se `muda_decisao=true` com `indireta=0` |
| 7 | **Efeito transcrito**: `efeito.transcricao` é frase literal da fonte e contém `valor`, `ic95[0]`, `ic95[1]` e `ic_nivel` quando ≠ 95 (aceita `.`, `,` ou `·`); `fonte_transcricao` é um degrau da escada. **Eventos** (C1): em algarismo na transcrição **ou** deduzidos do publicado (N × taxa, medianas atingidas, tabela) com o cálculo em `eventos_por = "deduzido de <x>"` — rebaixar porque o número não estava escrito é avaliar a redação, não a evidência. Sem transcrição → `status = indeterminado` | FALHA se não indeterminado e a transcrição falta / não contém os números; FALHA se `eventos` não está na transcrição e `eventos_por` não começa com "deduzido de" |

Regras de forma que acompanham (também no portão): 5 domínios sempre presentes, nota ∈ {0, −1, −2},
`por` não vazio; `certeza` = aritmética (inicial + Σ notas + Σ elevações, piso D); `elevacoes` só quando
a inicial é C **e nenhum domínio foi rebaixado** (prompts §7, passo 3); `valor_rederivado` = número+letra
derivado de `recomendacao.forca` + `certeza`;
`fonte` é o DOI do regime (trocar referência = `pivo.referencia_proposta` + WARN, decisão do revisor).

## Calibração de 2026-09-17 (decisões da direção após o piloto renal)

| # | decisão | razão | onde vive |
|---|---|---|---|
| C1 | eventos dedutíveis **contam** (`efeito.eventos` numérico + `eventos_por: "deduzido de <cálculo>"`) | se o número se deduz do publicado, o dado existe; rebaixar pela redação do artigo é avaliar o texto, não a evidência | regra 7; portão lista cada dedução no WARN |
| C2 | comparador obsoleto rebaixa **só quando muda a decisão de hoje** (`pivo.comparador_muda_decisao` + porquê) | comparador que era padrão na época e segue referência não leva segunda punição | regra 6 |
| C3 | IC além de 95% **não rebaixa por si** (`ic_nivel` é fato da fonte; avaliar a exclusão do nulo normalmente) | IC 99,8% que exclui o nulo é evidência mais segura, não menos | regra 4 |
| C4 | usar sempre a **publicação mais madura do mesmo estudo** (`pivo.referencia_atualizada {doi, por}` — a `fonte` do veredito passa a ser ela); se só há interina, `efeito.analise = interina` → −1 obrigatório | atualizar a versão do mesmo estudo não é trocar de estudo | regras 4 e 6 |
| C5 | fase II randomizado: **ortodoxo** — RCT parte de A e cai por imprecisão (−2 quando cumpre os critérios da ficha) | substitui o "fase II parte de C" da fundação | regra 3 e 4 |
| C6 | direção clínica controversa fica **`pendente_revisor`** (Portão C), o método não decide | mérito clínico é do revisor | `recomendacao.direcao` |
| C9 | quando o valor depende de um **corpo de evidência** (Cochrane / meta-análise / RS que sustenta o regime), a revisão entra como `pivo.referencia_corpo {doi, tipo, comparacao, certeza_declarada, por}`: o `efeito` é o agregado da revisão, `desenho.tipo = meta_analise_rct`, a `fonte` passa a ser a revisão, e a certeza é avaliada sobre ela — **nunca acima da que a revisão declara** (revisão sem grau → teto B). Corpo **alegado** no texto sem `referencia_corpo` continua rebaixando (A é FALHA; abaixo, WARN) | resolve "classe agregada no Cochrane vs ensaio único" e os limítrofes 05/15 da auditoria — onde o valor está certo mas a fonte registrada não prova | regras 1, 6 e 7 |
| C8 | em cenário curativo, SLD/iDFS/SLE/SLR/controle local são desfecho crítico **duro**; regra 2 (teto B) vale para SLP/ORR em doença metastática | é o desfecho primário aceito por agência em adjuvância; esperar SG leva uma década; tratar como substituto rebaixaria em bloco os 46 regimes adjuvantes | regra 2; portão barra desfecho curativo em regime metastático |
| — | limiar de "efeito grande" (RRR ≥ 30% e IC sup ≤ 0,85) **mantido como convenção do squad**, sujeito a referendo | não é regra GRADE canônica | regra 1 |
| C7 | referências propostas entram como **adicionais** (`pivo.referencias_adicionais[] {doi, papel}`), nunca substituem | só a versão madura do mesmo estudo (C4) substitui | regra 6 |

## Output Format

```json
{
  "regimen_id": "pancreas-met-nabpac-gem-nao-incorporado",
  "eixo": "a qualidade da evidência e a força da recomendação",
  "schema": 2,
  "status": "re_derivado",
  "afirmado_protocolo": null,

  "desfecho_critico": "SG",
  "desenho": {
    "tipo": "rct_fase3",
    "cegamento": "aberto",
    "n": 861,
    "descricao": "MPACT — nab-paclitaxel + gemcitabina vs gemcitabina, fase 3 aberto, 861 pacientes"
  },
  "efeito": {
    "medida": "HR",
    "valor": 0.72,
    "ic95": [0.62, 0.83],
    "sentido_beneficio": "menor",
    "eventos": null,
    "eventos_por": null,
    "analise": "final",
    "transcricao": "The median overall survival was 8.5 months in the nab-paclitaxel-gemcitabine group as compared with 6.7 months in the gemcitabine group (hazard ratio for death, 0.72; 95% confidence interval [CI], 0.62 to 0.83; P<0.001).",
    "fonte_transcricao": "europepmc_abstract"
  },
  "pivo": {
    "intervencao": ["nab-paclitaxel", "gemcitabina"],
    "comparador": "gemcitabina",
    "comparador_padrao_epoca": true,
    "comparador_padrao_atual": false,
    "comparador_muda_decisao": true,
    "primario_positivo": true,
    "sustenta": true,
    "por": "braço experimental = regime; gemcitabina era o padrão em 2013; primário (SG) positivo; hoje a escolha é vs FOLFIRINOX, não vs gem — comparador muda a decisão (C2)",
    "referencias_adicionais": []
  },
  "dominios": {
    "risco_vies":      {"nota": 0,  "por": "aberto, mas desfecho crítico duro (SG) — cegamento não afeta"},
    "inconsistencia":  {"nota": 0,  "por": "ensaio único, sem contradição posterior"},
    "indireta":        {"nota": -1, "por": "comparador (gem isolada) não é mais padrão atual — FOLFIRINOX/mFOLFIRINOX"},
    "imprecisao":      {"nota": 0,  "por": "IC 0,62–0,83 exclui nulo com folga; efeito grande (RRR 28%) e N=861"},
    "vies_publicacao": {"nota": 0,  "por": "registro prévio; sem sinal"}
  },
  "elevacoes": [],
  "certeza": "B",
  "substituto_excecao": null,
  "pivo_nao_sustenta": false,
  "recomendacao": {
    "forca": "condicional",
    "direcao": "contra",
    "base": "não incorporado: preferência institucional por FOLFIRINOX; padrão para inelegíveis a FOLFIRINOX",
    "sem_mcbs_por": null
  },
  "valor_rederivado": "2B",
  "justificativa": "RCT fase 3 aberto, SG HR 0,72 (0,62–0,83), N=861; −1 indireta pelo comparador (gemcitabina isolada não é padrão atual). Não incorporado → condicional contra.",
  "fonte": "https://doi.org/10.1056/NEJMoa1304369",
  "motivo_indeterminado": null
}
```

### Vocabulários fechados

- `desfecho_critico`: **duros** `SG` · `mortalidade` · `SLD` · `iDFS` · `SLE` · `SLR` · `controle_local`;
  **substitutos** `SLP` · `SLPr` · `ORR` · `RCp` · `MFS` · `TTP` · `DoR` · `outro_substituto`.
- `desenho.tipo`: parte de **A** → `rct_fase3` · `rct_fase2_3` · `rct_fase2` · `meta_analise_rct`; parte de **C** →
  `fase2_braco_unico` · `basket` · `observacional` · `serie_casos`.
- `efeito.analise`: `final` · `atualizada` · `interina` (interina sem versão madura → imprecisão ≤ −1, C4).
- `efeito.eventos_por`: "transcrito" ou `"deduzido de <cálculo sobre números da fonte>"` (C1).
- `pivo.comparador_muda_decisao`: obrigatório quando `comparador_padrao_atual = false` (C2).
- `pivo.referencia_atualizada`: `{doi, pmid, por}` — versão madura do mesmo estudo (C4); `pivo.referencias_adicionais`: `[{doi, papel}]` (C7).
- `pivo.referencia_corpo`: `{doi, tipo: cochrane|meta_analise|revisao_sistematica, comparacao, certeza_declarada: alta|moderada|baixa|muito_baixa|null, por}` (C9) — com ela, `efeito` = estimativa agregada transcrita do abstract da revisão e `desenho.tipo = meta_analise_rct`.
- `desenho.cegamento`: `duplo_cego` · `aberto` · `nao_informado`.
- `efeito.medida`: `HR` · `RR` · `OR` · `diferenca_absoluta` · `diferenca_medianas`;
  `efeito.sentido_beneficio`: `menor` · `maior`.
- `efeito.fonte_transcricao`: `europepmc_abstract` · `europepmc_fulltext` · `pmc_fulltext` (manuscrito de
  autor em `ncbi.nlm.nih.gov/pmc/articles/<PMCID>/` — funciona quando o `fullTextXML` do Europe PMC dá 500) ·
  `pubmed_abstract` · `oa_pdf` · `crossref_abstract` · `pdf_fornecido_revisor` (ver "Fonte inacessível").
- `efeito.ic_nivel`: nível do IC **como a fonte reporta** (omitir = 95). Fase II com IC 80%, interinas com
  98,89%/99,8% são fatos da fonte, não falhas: transcrever o nível; < 95 força `imprecisao ≤ −1` e barra A;
  > 95 é conservador (IC mais largo que o de 95%) e o portão usa os limites como estão.
- `dominios.*.nota`: `0` · `-1` · `-2`.
- `elevacoes[].tipo`: `magnitude_grande` (+1) · `magnitude_muito_grande` (+2) · `dose_resposta` (+1) ·
  `confusao_oposta` (+1) — cada um com `por`.
- `certeza`: `A` · `B` · `C` · `D`.
- `substituto_excecao.tipo`: `crossover_documentado` · `substituto_validado_no_tumor` (+ `por`).
- `recomendacao.forca`: `forte` · `condicional`; `recomendacao.direcao`: `a_favor` · `contra` · `pendente_revisor` (C6).
- `status`: `concorda` · `diverge` · `re_derivado` · `indeterminado`.

### Fonte inacessível — protocolo (adendo da direção, 2026-09-17)

1. O abstract do Europe PMC costuma bastar (N, HR, IC, desfecho primário). Texto completo só quando o
   abstract não traz eventos/IC — ordem: `fullTextXML` → página PMC do manuscrito de autor → Unpaywall/
   OpenAlex (`url_for_pdf`; editores como NEJM/Wiley devolvem 403 ao bot — é o esperado).
2. Se nem assim o dado essencial aparecer: `status = indeterminado`, `motivo_indeterminado` começa com
   `fonte_inacessivel:` e nomeia o que falta; e o item entra em **`PEDIDOS-DE-ARTIGO.md` no run**
   (regime · estudo · DOI/PMID · o que falta: texto completo? tabela de eventos? IC?). Um bloco que
   **fechou em B só por falta de eventos/IC 95%** também entra na lista, marcado *upgrade* — não trava
   a tabela, mas a repescagem pode subir a certeza.
3. PDFs fornecidos pela direção ficam em **`pipeline/data/artigos-fornecidos/<PMID>.pdf`**. PDF fornecido é
   fonte legítima: `fonte_transcricao = pdf_fornecido_revisor` + `efeito.proveniencia = "PDF fornecido pelo
   revisor metodológico, conferido contra DOI <x>"` (o portão exige a frase e lista no WARN).
4. A repescagem dos fornecidos é passo próprio, **depois** do piloto principal.

### Caso `indeterminado`

Nota de comunicação (`guia-prompts-ebm-grade.md` §8): **nunca** escrever "não há evidência". Usar
"estimativas de efeito são incertas" / "a evidência atual garante muito baixa confiança", e
`motivo_indeterminado` nomeia os degraus da escada que falharam.

```json
{ "regimen_id": "…", "schema": 2, "status": "indeterminado",
  "motivo_indeterminado": "Europe PMC sem abstract para o DOI; Unpaywall is_oa=false; OpenAlex sem oa_url; PubMed efetch sem resultado",
  "desfecho_critico": null, "desenho": null, "efeito": null, "pivo": null, "dominios": null,
  "certeza": null, "recomendacao": null, "valor_rederivado": null,
  "justificativa": "Estimativas de efeito são incertas: fonte inacessível pela escada inteira — sem efeito transcrito não há certeza a derivar.",
  "fonte": "https://doi.org/…" }
```

## Veto Conditions

- Marcar `concorda` quando `afirmado_protocolo == null` → proibido: sem afirmação não há confronto; o status é `re_derivado`.
- Preencher `efeito` de memória, de diretriz, de revisão narrativa ou do próprio protocolo → proibido: `transcricao` é frase da fonte primária, obtida pela escada de APIs nesta execução.
- Marcar `indeterminado`/"inacessível" sem ter percorrido a escada inteira (Crossref → Europe PMC → Unpaywall/OpenAlex → PubMed) → proibido; e `motivo_indeterminado` tem de nomear os degraus que falharam.
- Inventar valor, IC ou nº de eventos quando a API não retornar → proibido (é `indeterminado`).
- Escrever `certeza` que não é a aritmética dos domínios → proibido (o portão recalcula).
- Domínio com nota 0 e `por` vazio → proibido: "não rebaixei" também se justifica.
- `forte a_favor` em regime não incorporado, ou com MCBS 1–2, ou com certeza C/D → proibido (regra 5).
- Trocar o DOI da referência por conta própria → proibido: propor em `pivo.referencia_proposta` e deixar o revisor decidir; a `fonte` do veredito continua sendo o DOI do regime.
- Citar como `fonte` um DOI que não resolve no Crossref → proibido.
- "Fase 3 + ganho de SG → 1A" sem os 5 domínios avaliados → proibido: é exatamente o atalho que esta versão existe para fechar.
