---
step: "02b"
name: "Intake de fontes manuais (PDFs baixados) e reprocessamento seletivo"
type: agent
agent: extrator
execution: subagent
model_tier: powerful
tasks:
  - intake-fontes-manuais
depends_on: step-01
condicional: true
gatilho: "existe >=1 PDF em data/input/fontes-manuais/"
---

# Step 02b — Intake de fontes manuais e reprocessamento seletivo

## Quando este step roda
**Só quando** `squads/mbe-oncologia/data/input/fontes-manuais/` contém pelo menos um `.pdf`.
Se a pasta estiver vazia (ou não existir), **pular** — o pipeline segue o fluxo normal (Step 02 → …)
sem qualquer efeito. Este step é aditivo: **não altera o comportamento dos demais steps**; apenas
reabre, de forma cirúrgica, os regimes cujo pivô chegou agora à mão.

## Ideia
Os regimes marcados `incompleto` por `grade_sem_estudo_pivo` (ver `fontes-a-buscar.md`) ficaram sem
selo porque o estudo-pivô não pôde ser acessado. O usuário baixou esse(s) PDF(s) e os colocou na
pasta de intake. Este step **casa cada PDF ao(s) regime(s) certo(s)** e **reprocessa apenas esses**,
acrescentando uma nova versão — o restante do `regimes-consolidados.json` é copiado sem tocar.

## Inputs
- `data/input/fontes-manuais/*.pdf` — os PDFs baixados.
- `data/input/fontes-manuais/fontes-manuais.map.json` — mapa opcional (ver README da pasta).
- `output/<run>/v<n>/regimes-consolidados.json` — **versão corrente** (a de maior `v`).
- `output/<run>/v<n>/fontes-a-buscar.json` — para saber quais candidatos estavam `a confirmar`.
- Frameworks de re-derivação: `pipeline/data/grade-framework.md`, `esmo-mcbs-framework.md`,
  `eligibility-extraction.md`, `fontes-confiaveis.md`.

## Processo

### 1. Casar PDFs a regimes (a task `intake-fontes-manuais` do Extrator)
Para cada `.pdf` na pasta, determinar o(s) `regimen_id` alvo, nesta ordem de precedência:
1. **Mapa** (`fontes-manuais.map.json` → `arquivos[].aplica_a`), se existir para o arquivo.
2. **Nome = `regimen_id`** (após remover extensão e qualquer sufixo `--...`): casar com um regime de
   mesmo `regimen_id`.
3. **Nome = DOI** (padrão `10._..` com `/`→`_`): casar com regimes cujo `referencia.doi` bate, **ou**
   cujo candidato em `fontes-a-buscar.json` tem esse DOI (então trata-se de confirmação de candidato).

Produzir o manifesto `output/<run>/v<n+1>/fontes-manuais-intake.json`:
```json
{
  "gerado_em": "YYYY-MM-DD",
  "run": "<run>",
  "versao_origem": <n>, "versao_destino": <n+1>,
  "casados":   [ {"arquivo": "...", "regimen_id": "...", "via": "mapa|regimen_id|doi", "confirma_candidato": true|false} ],
  "orfaos":    [ {"arquivo": "...", "motivo": "nenhum regime casou"} ],
  "ambiguos":  [ {"arquivo": "...", "candidatos_regimen_id": ["...","..."], "acao": "exigir mapa"} ]
}
```
- **Órfão** (não casou com nada) ou **ambíguo** (casou com >1 sem mapa) → **não reprocessar**;
  registrar no manifesto e seguir. Nunca adivinhar o alvo.

### 2. Re-extrair do PDF (Extrator) — só nos regimes casados
Para cada regime casado, ler o PDF e atualizar **apenas** os campos de captura fiel:
- `referencia` — se o PDF confirma um candidato que estava `a confirmar`, gravar
  `citacao/doi/pmid/estudo/ano` reais (agora acessados). **Nunca** inventar DOI: usar o que o PDF/DOI traz.
- `beneficio` = `{desfecho_principal, magnitude, fonte}` conforme o estudo (regra do schema).
- `toxicidades` = `[{nome, severidade, conduta?}]` conforme o estudo.
- Campo sem info no PDF = `null`/`[]`. Zero julgamento de evidência aqui.

### 3. Re-derivar os eixos que dependiam do pivô — só nos regimes casados
Agora que o pivô está acessível, re-rodar a lógica de verificação **sobre esse subconjunto**,
reutilizando os mesmos frameworks/critérios dos steps 03–06 (sem editá-los):
- **GRADE** (obrigatório — era a lacuna): re-derivar `verificacao.grade` do zero contra o pivô;
  sair de `indeterminado` para `concorda`/`diverge` com `valor_rederivado` e `justificativa`.
- **ESMO-MCBS** e **elegibilidade**: re-derivar **se** o pivô fornecer o dado que faltava
  (desfecho graduável; critérios de inclusão/exclusão computáveis). Senão, manter como estava.
- **NCCN affordability**: normalmente não muda com o pivô — manter, salvo se o PDF trouxer dado novo.

### 4. Reconsolidar e versionar (regra do Consolidador, aplicada ao subconjunto)
Para cada regime casado, recomputar `consolidacao` (mesma `regra_selo` do Step 07) e:
- **remover** `grade_sem_estudo_pivo` de `lacunas`/`flags` quando o GRADE passou a ser derivável;
- recalcular `status`/`selo_confianca` (pode virar `confirmado`, `divergencia`, ou seguir
  `incompleto` se ainda restar outra lacuna real, ex.: `elegibilidade_sem_criterios_computaveis`);
- **acrescentar** (append, nunca sobrescrever) em `historico_versoes[]`:
  ```json
  {"versao": <novo>, "data": "YYYY-MM-DD", "origem": "fonte-manual",
   "mudanca": "Pivô acessado via intake manual (<arquivo>); GRADE re-derivado e selo recalculado.",
   "eixos_afetados": ["grade", ...], "fonte": "<doi ou arquivo>", "decidido_por": null}
  ```
- **incrementar** `versao` (topo) e preencher `atualizado_em`.

### 5. Escrever a nova versão do run
- Copiar a pasta `v<n>` para `v<n+1>`.
- Em `v<n+1>/regimes-consolidados.json`: substituir **apenas** os regimes casados pela forma
  reprocessada; **todos os demais regimes ficam idênticos** (mesmo `versao`, mesmo `historico_versoes`).
- Atualizar `meta.distribuicao_selo` e acrescentar `meta.intake_fontes_manuais`
  `{data, versao_origem, versao_destino, regimes_reprocessados: [...], manifesto: "fontes-manuais-intake.json"}`.
- Regravar `fontes-a-buscar.json/.md` para `v<n+1>` refletindo os itens que saíram da lista
  (os reprocessados) e os que permanecem.

## Quality Gate
- [ ] Nenhum regime **fora** da lista de casados foi alterado (diff byte-a-byte fora do subconjunto).
- [ ] Todo regime reprocessado ganhou **exatamente uma** entrada nova em `historico_versoes`
      (`origem: "fonte-manual"`) e teve `versao` incrementada.
- [ ] `grade_sem_estudo_pivo` só saiu das `lacunas` de quem realmente passou a ter pivô derivável.
- [ ] PDFs órfãos/ambíguos foram **registrados** no manifesto e **não** causaram alteração.
- [ ] Nenhum DOI/HR/toxicidade preenchido de memória — só o que o PDF traz.

## Princípio
Intake manual é entrada de **fonte**, não de decisão clínica. Este step re-deriva evidência com o
pivô em mãos e recalcula o selo; divergências novas seguem para o checkpoint humano (Step 08) como
qualquer outra. O sistema INFORMA e SINALIZA — a decisão continua do médico.
