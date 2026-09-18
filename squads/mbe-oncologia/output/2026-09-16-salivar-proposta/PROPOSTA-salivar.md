# PROPOSTA — 3 regimes de glândula salivar (cabeça e pescoço) a pedido do revisor

**Status: APROVADA como está pelo Gustavo Couto em 2026-09-17** (os 3 regimes com as referências
propostas — Licitra/Dreyfuss para o CAP, Nakano com dose null, Hong+Airoldi —, vocabulário com
`glandula_salivar` + `histologia_salivar` registrada sem condicionar regra, decisão fora do fluxo
no formato do precedente). **Entra no run de sexta (2026-09-18) junto com o lote 4 (D7 da outra
sessão)**, por comando humano, depois da demo. As 7 pendências da seção 6 vão para a fila do
revisor. Ainda NÃO é run nem intake; nada tocou produção.

Esta pasta não tem `v1/`: `RUN_ATIVO` continua `2026-09-16-drivers-pulmao/v1`, `build-data.py`
e o Portão A só leem o run ativo (Portão A rodado em 16/09 após gerar isto: 301 regimes, exit 0,
os 2 WARN de sempre). `regimes-propostos-salivar.json` é gerado por `gerar-proposta.py`, que
confere a proposta contra o run ativo (ids livres, vocabulário, hash calculável) sem escrever
nele.

## 1. Decisão fora do fluxo (registro)

| | |
|---|---|
| **Decidido por** | Gustavo Drummond Pinho Ribeiro (revisor) |
| **Canal** | WhatsApp ao Gustavo Couto, 16/09/2026 — fora da app; não veio pelo export da Mesa |
| **Relatado por** | Gustavo Couto |
| **Texto** | Acrescentar 3 regimes para carcinoma de glândula salivar: (1) cisplatina + doxorrubicina + ciclofosfamida (CAP) — PMID 21147032; (2) carboplatina + paclitaxel — PMID 27094013; (3) cisplatina + vinorelbina — DOI 10.1002/hed.24933 |
| **Efeito** | 3 regimes novos em `cabeca-pescoco`, nascidos pendentes (`rederivado_aguarda_revisao`, selo `incompleto`); vocabulário ganha `tumor=glandula_salivar` (+ `histologia_salivar`). Nenhum regime existente muda, nenhum hash existente muda, nenhuma aprovação expira |
| **Precedente** | `renal-met-2l-pos-io-cabozantinibe` (lote 2, 13/09): decisão por mensagem gravada com `canal`/`decidido_por`/`texto`/`efeito` em `triagem_resolvida` e `historico_versoes` |

O mesmo bloco está em `meta.decisao_fora_do_fluxo` do JSON e, por regime, em
`consolidacao.origem` (com `canal`), `consolidacao.notas_revisao[0]` e `historico_versoes[0]`.

## 2. Referências — verificadas ao vivo em 16/09/2026 (Europe PMC + Crossref + OpenAlex)

| Pedido do revisor | Resolve para | Tipo | O que diz o abstract |
|---|---|---|---|
| **PMID 21147032** (CAP) | Laurie SA et al., *Lancet Oncol* 2011;12:815-24 — DOI 10.1016/S1470-2045(10)70245-X | **Revisão sistemática** de terapia sistêmica em **carcinoma adenoide cístico** (34 ensaios, 441 pts) | Não é um ensaio do CAP: enquadra o CAP dentro da literatura de ACC e conclui que o esquema ótimo é incerto. Texto completo fechado. |
| ↳ pivô proposto pelo squad | Licitra L et al., *Ann Oncol* 1996;7:640-2 — PMID 8879381, DOI 10.1093/oxfordjournals.annonc.a010684 | Fase II braço único, n=22 | CAP em salivar avançado, "most common histologies included", todos pré-tratados. **TRO 27%** (6/22, só RP; IC95% 11–50%), resposta mediana 7 m, **SG mediana 21 m**. Abstract sem dose. |
| ↳ dose | Dreyfuss AI et al., *Cancer* 1987;60:2869-72 — PMID 2824016 | Série prospectiva, n=13 (9 ACC + 4 adenocarcinoma) | **Ciclofosfamida 500 + doxorrubicina 50 + cisplatina 50 mg/m² EV D1, ciclo de 28 d**; média 4,7 ciclos. TRO 46% (3 RC + 3 RP), resposta mediana 5 m. |
| **PMID 27094013** (carbo+pacli) | Nakano K et al., *Acta Otolaryngol* 2016;136:948-51 — DOI 10.3109/00016489.2016.1170876 | **Retrospectivo**, n=38 (18 ductal salivar, 9 ACC, 11 outros) | **TRO 39%**, PFS mediana 6,5 m, SG mediana 26,5 m; **ACC TRO 9%** (sem diferença de PFS/SG). Bem tolerado. **Abstract sem dose/AUC nem nº de ciclos; texto completo fechado (T&F)** — dose não recuperável de fonte aberta. |
| **DOI 10.1002/hed.24933** (cis+vinorelbina) | Hong MH et al., *Head Neck* 2018;40:55-62 — PMID 29044862 | Fase II braço único, n=40 | Salivar recidivado e/ou metastático. **Vinorelbina 25 mg/m² D1,D8 + cisplatina 80 mg/m² D1 q3s × 4–6 ciclos.** Desfecho primário TRO: **35%** (1 RC); PFS 6,3 m; SG 16,9 m; sem morte relacionada. |
| ↳ corroboração (não citada) | Airoldi M et al., *Cancer* 2001;91:541-7 — PMID 11169936 | Fase II **randomizado**, n=36 (61% ACC) | Mesmo esquema exato (cis 80 D1 + VNB 25 D1,D8 q3s) vs VNB semanal: RC 19% + RP 25% vs RC 0 + RP 20%. |

Os três PMIDs/DOIs resolvem nos três serviços para o mesmo trabalho (PMID↔DOI cruzados). Único
ponto de atenção: **a referência 1 é uma revisão sistemática, não o ensaio do esquema** — o card
nasce com a referência primária (Licitra 1996) como pivô, a dose do Dreyfuss 1987 e o Laurie 2011
citado como contexto, com flag `referencia:conferir` para o revisor dizer se quer o PMID dele
como referência principal.

## 3. Vocabulário de `cabeca-pescoco` (mesma mecânica do intake dos drivers de pulmão)

- **`tumor`** (enum existente): entra a opção **`glandula_salivar`** ("Carcinoma de glândula
  salivar (maior ou menor)"). As 18 regras existentes de cabeça e pescoço têm `eq tumor=<outro>`
  → nenhuma dispara para um paciente salivar (conferido pelo script). Vocabulário é do arquivo,
  não do regime → **zero hashes mudam, zero aprovações expiram**.
- **`histologia_salivar`** (enum novo, seção "Biologia molecular" → `estavel:true`):
  `nao_informada` (indeterminado, default) · `adenoide_cistico` · `ductal_salivar` ·
  `adenocarcinoma_nos` · `mucoepidermoide` · `outra`, com `rotulos`. **Registrado, mas não
  condiciona nenhuma das 3 regras nesta proposta** — o revisor não restringiu por histologia e
  as fontes misturam histologias. Fica no dado para o card mostrar a ressalva certa e para o
  revisor poder restringir depois (ex.: CAP só em ACC) sem vocabulário novo.
- **App: sem código novo.** Enum com `indeterminado`/`rotulos` é suportado pelo motor desde
  `94dc6cd` (app e `semaforo.ts`).

## 4. Os três regimes (formato do corpus — JSON completo em `regimes-propostos-salivar.json`)

Comum aos três: `tumor: cabeca-pescoco` · `cenario: metastatico` · regra
`tumor=glandula_salivar ∧ metastatico=true` (recidivado sem resgate local ou metastático, como
o card de nasofaringe) · sem restrição de linha nem de histologia (como no pedido) ·
`elegibilidade_protocolo` diz "não consta do protocolo institucional; acrescido por decisão do
revisor" · ESMO-MCBS **n/a** (braço único/retrospectivo — regra do squad) · NCCN Affordability
**1** (genéricos, SUS; estimativa) · selo **`incompleto`** (lacuna `grade_sem_estudo_pivo`) ·
`decisao_revisao: rederivado_aguarda_revisao` → entram na fila do revisor como *Pendente*.

### 4.1 `cp-salivar-met-cap` — Cisplatina + Doxorrubicina + Ciclofosfamida (CAP)
- **Esquema:** ciclofosfamida 500 + doxorrubicina 50 + cisplatina 50 mg/m² EV D1, a cada
  **21–28 d** (Dreyfuss: 28; Licitra não declara). Composição completa; expectativa de uso
  indeterminada (ciclos não fixados; Dreyfuss média 4,7).
- **Referência:** Licitra 1996 (pivô) / Dreyfuss 1987 (dose) / Laurie 2011 (RS, o PMID do revisor).
- **GRADE re-derivado: 2C** — braço único n=22, TRO 27% sem RC; RS conclui esquema ótimo incerto
  → certeza baixa, recomendação condicional (paliação).
- **Toxicidades:** mielossupressão; cardiotoxicidade (FEVE, dose cumulativa); nefro/ototoxicidade;
  êmese de alto risco; cistite hemorrágica.
- **Flags:** `regime_acrescido_pelo_revisor` · `referencia:conferir` (PMID é RS de ACC) ·
  `periodicidade:conferir` (21 vs 28 d) · `histologia:conferir`.

### 4.2 `cp-salivar-met-carboplatina-paclitaxel` — Carboplatina + Paclitaxel
- **Esquema:** carboplatina + paclitaxel a cada 21 d — **doses `null` de propósito** (abstract
  não traz; texto completo fechado). Composição e expectativa de uso indeterminadas, como no
  precedente `penis-met-1l-paclitaxel-carboplatina`. Se o revisor informar AUC/dose, entra no
  intake com fonte "revisor".
- **Referência:** Nakano 2016 (retrospectivo, n=38).
- **GRADE re-derivado: 2C** — observacional sem comparador; TRO 39% concentrada em ductal
  salivar/outros, **ACC 9%**.
- **Toxicidades:** mielossupressão; neuropatia; hipersensibilidade; alopecia.
- **Flags:** `regime_acrescido_pelo_revisor` · `evidencia_retrospectiva` · `esquema_sem_dose` ·
  `histologia:conferir` (ACC 9% — o card avisa, a regra não restringe) · não posicionado só
  para inelegíveis a cisplatina (não pedido; não imposto — mesma ressalva do card de pênis).

### 4.3 `cp-salivar-met-cisplatina-vinorelbina` — Cisplatina + Vinorelbina
- **Esquema:** cisplatina 80 mg/m² D1 + vinorelbina 25 mg/m² D1,D8, a cada 21 d, **4–6 ciclos**
  (expectativa de uso: 6 ciclos / 18 semanas; composição completa).
- **Referência:** Hong 2018 (pivô, o DOI do revisor) + Airoldi 2001 (fase II randomizado, mesmo
  esquema — acrescido pelo squad como corroboração).
- **GRADE re-derivado: 2B** — duas séries prospectivas concordantes, uma randomizada de n
  pequeno → certeza moderada/baixa, condicional. **Melhor base dos três.**
- **Toxicidades:** neutropenia; nefro/ototoxicidade; êmese; neuropatia/constipação; flebite.
- **Flags:** `regime_acrescido_pelo_revisor` · `corroboracao` (Airoldi não citado) · `histologia:conferir`.

## 5. Consequências previstas do intake (sexta)

301 → **304 regimes** · 0 hashes existentes mudam · 0 aprovações expiram · 3 selos
`incompleto` novos (cabeça e pescoço 2 → 5 incompletos) · fila do revisor: **+3 em Pendente** ·
Portão A: DOIs dos 3 resolvem (já conferidos) · app sem deploy de código (só `evidencia.json`
via backend) · hashes previstos no `meta.hashes_previstos` do JSON.

## 6. Pendências de referendo do revisor (vão nos cards e no `meta.revisao_humana` do run)

1. CAP: restringir a adenoide cístico? (Laurie é RS de ACC; Licitra/Dreyfuss incluíram outras histologias)
2. CAP: 21 ou 28 dias?
3. Carbo+paclitaxel: dose/AUC e nº de ciclos — revisor informa, ou fica indeterminado
4. Carbo+paclitaxel: só para inelegíveis a cisplatina? e como avisar do TRO 9% em ACC
5. Cis+vinorelbina: aceitar Airoldi 2001 como 2ª referência?
6. Linha: os três nascem sem restrição de linha — confirmar
7. `histologia_salivar`: só registrada (proposta) ou já condicionando regras?

## 7. Roteiro do intake (para sexta, por comando humano — não executar antes)

1. `git status` limpo; copiar (só dados) o run ativo para `2026-09-18-salivar/v1`.
2. `intake-salivar.py` (a escrever a partir de `gerar-proposta.py`): anexa a opção `glandula_salivar`
   e o campo `histologia_salivar` em `campos_primitivos` da fatia `cabeca-pescoco/v1`; insere os 3
   regimes no agregado e na fatia; atualiza `meta` (total, por_tumor, distribuicao_selo,
   `revisao_humana` com `regimes_novos`, `referencias_verificadas`, `pendencias_referendo`,
   `decisao_fora_do_fluxo`); regrava `content-hashes.json`; relatório do lote.
3. Portão A com caminho (esperar `!!! ATENÇÃO`) → `RUN_ATIVO` → Portão A sem caminho + `--check-dois`
   → `app/build-data.py` → backend rebuild/restart → Portão B (fluxo real: paciente salivar
   metastático vê os 3 cards pendentes; paciente CEC não vê nenhum) → commit com paths explícitos
   → deploy backend → conferir em produção (fila: 3 em Pendente) → `_memory/runs.md`.
