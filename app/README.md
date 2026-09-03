# OncoGuia — app/ (camada de interação do squad `mbe-oncologia`)

> **Atualização — full-stack:** a app agora é cliente do backend próprio em `../backend/`
> (NestJS + Postgres + JWT). Login obrigatório; pacientes, seleções de protocolo e pareceres
> da Revisão clínica persistem no banco — **uma tabela só** (`revisoes`, `POST /api/revisoes`);
> o export `revisao-decisoes.json` é `GET/POST /api/revisao/export` (admin). A **leitura da
> evidência não mudou**: regimes continuam vindo de `data.js` (output do squad). Suba a API
> antes de abrir a app (`cd ../backend && npm run start:dev`); a URL da API pode ser trocada
> via `localStorage.oncoguia_api` ou `window.ONCOGUIA_API_BASE`.

Interface web (HTML + JS puro) que é a **camada de interação do que o squad
produz**. Ela não contém protocolos escritos à mão: tumores, campos clínicos, motor de
elegibilidade e selos (GRADE / ESMO-MCBS / custo) são **derivados da evidência consolidada**
pelo squad em `squads/mbe-oncologia/output/regimes-consolidados.json`
(schema em `squads/mbe-oncologia/pipeline/data/schema-regime.md`).

> O squad **não** é modificado por nada aqui. Esta pasta só *consome* a saída dele.

## Fluxo (3 telas, como no protótipo)
1. **Pacientes** → lista + cadastro (só dados administrativos).
2. **Página do paciente** → escolhe o tumor e preenche o clínico (formulário **dinâmico por tumor**).
3. **Protocolos** → semáforo de elegibilidade 🟢🟡🔴 + selos GRADE / ESMO-MCBS / custo + fontes.
4. **Trilha** → o seguimento depois da escolha: retornos (resposta/toxicidade/conduta), troca de protocolo e lembrete de reestadiamento.

Além do fluxo do paciente, há as abas **Fluxograma** (árvore de decisão) e **Revisão clínica** (camada humana sobre os 295 protocolos) — ver seções abaixo.

## Fluxograma (aba "Fluxograma") — árvore de decisão a seguir
View **read-only**, **independente de paciente**: é o **algoritmo do protocolo em si**, montado a partir dos regimes consolidados (`regimes-consolidados.json`, empacotados do último run em `data.js`). Estrutura da árvore:

> **tumor → subtipo/biomarcador → cenário → ramos de estadiamento/linha → protocolo (folha)**

- Os **ramos** são derivados dos `{campo, valor}` que condicionam cada regime (`verificacao.elegibilidade.criterios_*`); quando o regime não tem critérios computáveis, o ramo cai no padrão textual do `subtipo` (linha/estadiamento). Regimes que compartilham o mesmo caminho são **agrupados**.
- Cada **folha (protocolo)** mostra os selos **GRADE**, **ESMO-MCBS** e o **selo de confiança** (✅ confirmado / 🔴 divergência / 🟡 incompleto) — o leitor vê de imediato quais caminhos são sólidos e quais estão pendentes de revisão. Regimes marcados como *não incorporado* recebem uma etiqueta.
- Renderizado como fluxograma **navegável** (nós colapsáveis), **imprimível** (botão *Imprimir / PDF* → `@media print` expande tudo e esconde a navegação) e **exportável como Mermaid** (botão *Mermaid (.mmd)* → baixa o `flowchart TD` do mesmo algoritmo).
- Seletor de **tumor** no topo (um fluxograma por tumor presente no JSON).

Não altera o squad nem os arquivos do run — só lê o JSON consolidado.

## Revisão clínica (aba "Revisão clínica") — a camada humana sobre os protocolos
Uma aba só de revisão (a antiga **Mesa de Revisão** foi aposentada e sua função útil absorvida aqui).
Lista os **295 protocolos** por tumor; o revisor (perfil `revisor`/`admin`) **aprova · contesta ·
pede ajuste**. Cada parecer é gravado no backend na **tabela única `revisoes`** (`POST /api/revisoes`),
ancorado em `regimen_id` + `content_hash` — quando o squad re-roda e o regime muda, a revisão
"expira" sozinha (volta a *pendente de re-revisão*). **Sem dado de paciente aqui.**

- **Natureza da contestação/ajuste** (obrigatória): `dado` — fonte/DOI/critério não computável errado,
  **o squad deve refazer o regime**; ou `clinico` — discordância de nota/magnitude, fica como
  **registro clínico** (não dispara reprocessamento).
- **📎 Fonte a buscar** inline nos cards de selo `incompleto`: o que falta (lacunas) + a
  referência/DOI candidato a buscar + onde entregar o PDF (`data/input/fontes-manuais/<regimen_id>.pdf`).
- **Filtros** por tumor, selo do squad, estado da revisão e eixo.
- **Export pro squad (só admin)**: botões *⤓ Baixar revisadas* (todas as revisadas do filtro atual)
  e *⤓ Selecionadas* (checkbox nos cards revisados) → `POST /api/revisao/export` → download do
  `revisao-decisoes.json` que os Steps 08/10 reincorporam. Contestações/ajustes de natureza `dado`
  vão com `reprocessar: true` + a justificativa como correção.

### Ciclo completo (tela → arquivo → squad)
1. **Revisar na tela**: abrir a aba **Revisão clínica** e dar o parecer por protocolo.
2. **Exportar** (admin): *⤓ Baixar revisadas* ou *⤓ Selecionadas* → `revisao-decisoes.json`.
3. **Colocar o arquivo na pasta do run**: `squads/mbe-oncologia/output/<run>/v1/` (mesma pasta do `regimes-consolidados.json`).
4. **Re-rodar o squad entrando no Step 08** (`/opensquad run mbe-oncologia`): os Steps 08/10 reprocessam os regimes com decisão de natureza `dado` (usando a justificativa como correção) e registram os demais pareceres sem publicar.

> Princípio inegociável mantido: nada entra no ar sem decisão humana explícita. A tela só coleta o parecer; o squad é quem aplica.

## Retorno / trilha do paciente (aba "Trilha")

O que acontece **depois** de escolher o protocolo. A antiga aba *Histórico* (só avaliações)
virou **Trilha**: uma linha do tempo única, com o **tipo visível** em cada item
(*Seleção de protocolo* · *Retorno* · *Autorização*, quando houver).

**Retorno** é a consulta de seguimento de quem já está em tratamento, e responde três coisas
sobre o protocolo em curso: o tumor respondeu, o paciente tolerou, e o que se faz agora.
Como a avaliação, é **append-only e imutável** — não existe editar: correção é registro novo
(não há rota de UPDATE/DELETE em `retornos`).

- **Regra RECIST — `resposta` só existe com imagem.** Resposta de tumor se mede em exame.
  Sem reestadiamento naquele retorno, o seletor vem **travado** na tela e a resposta fica
  `nao_avaliada`; o retorno segue registrando toxicidade e observações. A trava está em
  **três camadas**, porque a de cima é só conveniência: UI (seletor desabilitado) → DTO
  (`400`, constraint `RespostaRecist`) → banco (`CHK_retornos_recist`).
- **Toxicidades** (`{nome, grau}`, CTCAE 1–5): o seletor de nome é alimentado pelas
  toxicidades **do regime em curso no corpus do squad** — mais a opção **"outra"** com texto
  livre. O corpus sugere; o médico não fica preso a ele.
- **Conduta** `mantem` · `troca_protocolo` · `suspende`. Em `troca_protocolo` a app abre a
  **seleção de protocolos existente** (com semáforo, selos e a seção de não incorporados) e a
  avaliação escolhida nasce com `retorno_id` — a trilha mostra "motivada pelo retorno de …".

**Lembrete de reestadiamento.** Selecionar protocolo agenda o próximo (**padrão 3 meses**,
ajustável por paciente); retorno com imagem reagenda **+intervalo** a partir da data
realizada. Vencido vira **item pendente destacado** na trilha ("Reestadiamento vencido desde
…") e marca a aba com ⏰. A agenda é o **único ponto mutável** desta feature, de propósito:
é lembrete, não registro clínico — por isso mora no paciente, não numa tabela append-only.

**Guia TISS SP/SADT.** No item de reestadiamento, *Gerar guia SADT* abre a **Guia de Serviço
Profissional / SP/SADT no layout oficial** — blocos, ordem e numeração de campos conforme o
*Padrão TISS — Componente de Conteúdo e Estrutura, nov/2022* (p. 423), inclusive a numeração
fora de sequência que o padrão usa (99 no beneficiário, 90 na solicitação, 91/92 no
atendimento) e as **5 linhas fixas** de procedimento solicitado. Imprime em **A4 paisagem**,
uma página, via `@page guia` (página nomeada: só a guia vira paisagem, as outras telas que
alguém imprima seguem em retrato).

A tela serve ao mesmo tempo de **conferência** e de **folha**: é o mesmo DOM, na largura real
do papel e no corpo de fonte do papel, ampliado só para leitura. Não existe segunda árvore
para o print divergir da primeira. Campo que não cabe encolhe a fonte (input) ou cresce em
altura (textarea) — e isso aparece já na conferência, porque a folha tem a medida do papel.

*Pré-preenchido com o que a app sabe:* beneficiário (8, 10) e convênio, data da solicitação
(22), caráter *Eletiva* (21), indicação clínica (23: tumor + protocolo em curso), descrições
dos procedimentos (26) com quantidade (27), e o bloco do **profissional solicitante** (15–19)
com o usuário logado + conselho/nº/UF/CBO do cadastro (`Admin › Editar usuário`).

*Deliberadamente em branco:* código TUSS (25), código na operadora (13, 29), CNES (31),
número de guia e senha de autorização (1–7), e todos os blocos de execução, totais e
assinaturas. A app **não inventa** nenhum deles — quem digita é o humano, e todo campo é
editável na conferência.

*Uma diferença consciente:* o **plano** do paciente é impresso na caixa de identificação do
topo (a do "Logo da Empresa"), porque o SP/SADT não tem campo numerado de plano — e omitir um
dado que a app conhece obrigaria o médico a escrevê-lo à mão. Nenhum campo **numerado** foi
criado, renomeado ou reordenado.

A guia é **documento de saída**: imprimi-la não grava nada, não passa pelo backend e não toca
a trilha do paciente. O gancho `examesReestadiamento(tumor)` existe e **devolve vazio de
propósito** — as listas por tumor virão do oncologista de referência na Revisão clínica. Ver
`BACKLOG.md`.

**Perfis.** Escrever retorno e mexer na agenda: whitelist **explícita** `['oncologista','admin']`
(`OncologistaOuAdminGuard` — sem hierarquia, o revisor leva 403 mesmo batendo na URL). Ler a
trilha: qualquer autenticado.

**API:** `POST/GET /pacientes/:id/retornos` · `GET /pacientes/:id/trilha` ·
`PATCH /pacientes/:id/reestadiamento`.
**Portão:** `node scripts/portao-retorno.js` (39 checks, browser isolado + API).

## Como abrir

O app exige **backend + login** — nada (nem o Fluxograma) é público. Suba os dois:
```bash
cd backend && npm run build && node dist/main.js    # API em http://localhost:3005/api
cd app
npm run build-data     # (re)gera backend/data/evidencia.json a partir do output do squad
npm run serve          # sobe http://localhost:5173 servindo SÓ a pasta app/
# abra:  http://localhost:5173/index.html
```
> O serve roda **dentro de `app/`** de propósito: servir a raiz do projeto exporia
> `squads/` e `backend/data/` (o corpus) sem autenticação. Abrir via `file://` não
> funciona mais — a evidência só chega do backend com JWT.

## De onde vem a evidência
Fonte única: `GET /api/evidencia` (backend NestJS, **protegido por JWT**). O arquivo
`backend/data/evidencia.json` é gerado por `app/build-data.py` a partir de
`squads/mbe-oncologia/output/<run>/<vN>/regimes-consolidados.json` (fallback:
`backend/data/exemplo-mama.json`). Deslogado, nenhum protocolo é servido.

Para o admin, um selo no topo indica a fonte ativa: **verde** = squad, **amarelo** = fallback, **vermelho** = nada encontrado.

## Regenerar a evidência quando o squad rodar
```bash
cd app && python3 build-data.py    # ou: npm run build-data — regrava backend/data/evidencia.json
```
O script prefere `regimes-consolidados.json` (squad) e só cai no `exemplo-mama.json` se ele não existir.

## Como o "data-driven" funciona
- **Campos do formulário**: montados a partir da **união** dos `{campo}` que aparecem em
  `verificacao.elegibilidade.criterios_inclusao` / `criterios_exclusao` de todos os regimes
  daquele tumor. Tumor novo no JSON → formulário daquele tumor nasce sozinho.
  - O *tipo* do input é inferido dos valores: booleano → Sim/Não; número → stepper; string → botões.
  - Só aparecem as opções presentes nos dados. Ex.: se `rh` só surge como `positivo` no JSON,
    o campo mostra só "Positivo" até o squad consolidar um regime `rh = negativo`.
  - `CAMPO_META` / `TUMOR_META` no `index.html` são **apenas cosméticos** (rótulo bonito e a escala
    ordinal de estadiamento). Não carregam regra clínica; um campo/tumor desconhecido ainda renderiza.
- **Motor de elegibilidade** (genérico por operador): avalia o valor do paciente contra cada
  critério `{campo, operador, valor}` com os operadores `=, !=, >=, <=, <, >, in`. Classificação:
  - 🔴 **Inelegível**: critério de **exclusão** batido, **ou** inclusão categórica (`=`/`!=`/`in`) que não bate (o mecanismo/subtipo do regime não se aplica);
  - 🟡 **Atenção**: inclusão de **limiar** (`>=`/`<=`/`>`/`<`) fora da faixa **e** `elegibilidade.amplitude === "mais_amplo"` (paciente fora da população estudada, mas mecanismo mantido); ou dado insuficiente;
  - 🟢 **Elegível**: todos os critérios satisfeitos.
- **Selos e fontes**: GRADE, ESMO-MCBS e custo vêm dos valores **verificados/re-derivados** em
  `verificacao.*.valor_rederivado`; quando divergem do afirmado, mostra "afirmado X". Referência
  (`referencia.citacao` + DOI) e justificativas por eixo saem do JSON — nada é inventado.

## LGPD / futuro FHIR
Nesta fase os dados de paciente são **fictícios**, ficam **só na memória do navegador** e
**não são enviados para fora** nem persistidos. No `index.html`, o bloco marcado
`LGPD / futuro FHIR` sinaliza o ponto onde, no futuro, os campos virão puxados do **prontuário
via FHIR** (Patient / Condition / Observation) em vez de digitados — com consentimento e
trilha de auditoria antes de qualquer chamada externa.

## Arquivos
| Arquivo | Papel |
|---|---|
| `index.html` | A interface data-driven (HTML + CSS + JS, self-contained): fluxo do paciente + Fluxograma + **Revisão clínica (aba, dentro do app)**. Único ponto de entrada. |
| `build-data.py` | Gera `data.js` a partir do output do squad (ou do fallback). |
| `data.js` | Gerado — regimes empacotados para uso via `file://`. Não editar à mão. |
| `exemplo-mama.json` | Fallback com 3 regimes de exemplo (mesmo schema do squad). |
| `package.json` | Scripts `build-data`, `serve`, `start`. |

> `revisao-decisoes.json` **não** é um arquivo do app — é o **export** da Revisão clínica (baixado pelo admin via `/api/revisao/export`) que você coloca na pasta do run para os Steps 08/10 ingerirem.
