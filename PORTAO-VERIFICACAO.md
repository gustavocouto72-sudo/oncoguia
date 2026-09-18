# Portão de Verificação — OncoGuia

**Princípio:** você não confia no agente; confia no que dá pra checar **sem** o agente.
Rode este portão depois de **todo lote** de mudança (dados ou app). Passou tudo → confie. Qualquer ✗ → volta pro agente.

> Instinto que vale mais que o portão: se veio **rápido demais e limpo demais**, desconfie e cheque em dobro. Foi essa desconfiança que pegou o lote ruim de 21/07.

---

## Banco de desenvolvimento separado (regra, não sugestão)

**Teste manual e portões rodam SEMPRE no branch de dev. Produção só recebe deploy e uso
real.** Nada de teste toca a base que o auditor enxerga.

Por que a regra existe: dev e produção compartilhavam o mesmo banco Neon, e todo teste
local escrevia em produção. Os portões limpam o que criam (paciente de teste, parecer),
mas **cadastro feito à mão fora deles não é limpo por ninguém** — foi assim que três
preços com fonte "TESTE" foram parar em `custos_regime` na base real, em 2026-09-03.
Foram apagados; a regra abaixo existe para não haver um quarto.

**Como funciona a trava.** É *allowlist*, não denylist: em modo dev (`NODE_ENV` ≠
`production`) o backend só sobe se a `DATABASE_URL` apontar para **exatamente** o endpoint
declarado em `ONCOGUIA_DB_DEV_ENDPOINT`. Consequências disso, todas de propósito:

- **esquecer de configurar não libera** — sem a variável, nada sobe e nada roda;
- recusa também o que ninguém previu (staging, banco de outro projeto, branch antigo
  recriado com outro id), não só produção;
- não exige guardar o endpoint de produção em arquivo local — que é justamente o que se
  quer evitar. A string de produção vive **apenas** nas env vars do projeto na Vercel.

A mensagem de erro **não oferece o endpoint conectado para colar**. Se você está lendo a
mensagem, ele pode ser o de produção, e declará-lo como dev desligaria a trava exatamente
no caso que ela existe para pegar. O valor vem do console do Neon, do branch de dev.

Onde cada peça mora:

| peça | arquivo | o que faz |
|---|---|---|
| trava de boot | `backend/src/database/alvo-banco.ts` | recusa subir com `exit 1` e instrução |
| ligação no dev | `backend/src/main.ts` | chama a trava **antes** do Nest — abrir conexão para depois avisar já teria sido tarde |
| produção | `backend/api/index.ts` | **não** passa pela trava: a Vercel entra por aqui |
| portões | `scripts/portao-banco.js` | imprime o banco alvo no cabeçalho e aborta se não for o de dev |

**Todo portão abre dizendo o alvo**, mesmo espírito do `Corpus:` do Portão A — a primeira
linha diz sobre o que o resultado vale:

```
========================================================================
= Portão: custo (expectativa de uso e custo)
= Banco alvo: ep-xxxx (ep-xxxx-pooler.REGIAO.aws.neon.tech) · db=neondb
========================================================================
```

Um portão **verde apontado para o banco errado** é um resultado que não vale nada sobre o
ambiente que se queria testar — o mesmo problema do `!!! ATENÇÃO` do Portão A quando o
corpus não é o do `RUN_ATIVO`.

**Regra da limpeza: o portão devolve o banco como encontrou, SEMPRE.** Duas metades, e a
segunda faltava:

- registro que **já existia** e o portão alterou → **restaura** o valor original;
- registro que o **portão criou** → **apaga**.

Só a primeira estava implementada no portão de custo, então cada rodada deixava três
preços de teste para trás. Preço não tem rota DELETE na API (desenho: preço se corrige,
não se apaga), então a remoção vai por SQL — mesmo caminho que o portão B já usava para
pareceres. Paciente sai por `DELETE /pacientes/:id`, e a cascata leva avaliações, retornos
e seleções.

O "sempre" inclui **quando o portão falha** — aliás, principalmente aí. A limpeza mora no
`finally`; se ficar no fim do caminho feliz, o check que estoura no meio deixa resíduo
para a rodada seguinte encontrar.

> **Cuidado ao mover limpeza para o `finally`:** o `finally` roda ANTES de a exceção
> chegar ao `.catch()` do fim do arquivo. Se ele chamar `process.exit(fails ? 1 : 0)` e a
> exceção não tiver sido registrada como check falho, `fails` dá 0 e **o portão sai verde
> tendo quebrado**. Aconteceu no portão B na primeira versão desta mudança. O padrão certo
> é `try { … } catch (e) { ok('EXCEÇÃO no portão', false, e.message) } finally { limpeza;
> veredito }` — que é o que os quatro fazem agora. Mesma família do "check que passava
> vazio": o modo de falha perigoso não é o portão vermelho, é o verde mentiroso.

**Como se prova que a limpeza funciona:** rodar o portão **duas vezes seguidas** e olhar a
linha de limpeza da segunda. `restaurados=0` significa que não havia nada para restaurar —
isto é, a primeira rodada devolveu o banco vazio. Se a segunda rodada mostrar
`restaurados>0`, a limpeza da primeira não apagou o que criou.

**Resíduo de rodada morta (2026-09-14).** O `finally` só roda se o processo chegar lá:
portão morto no meio (Ctrl-C, timeout, máquina dormindo) deixa o paciente de teste para
trás — foi assim que um "Paciente Portao Autorizacao" (reg. `TESTE-PORTAO-AUT`, criado
em 2026-09-06 logo após o check U3, sem nenhuma avaliação) ficou 8 dias no banco de dev.
Removido à mão em 2026-09-14 (dependências conferidas antes: 0 avaliações, 0 retornos,
0 seleções). Para não haver um segundo, o `portao-autorizacao` faz duas coisas:

- **etiqueta única por rodada** no nome e no registro (`TESTE-PORTAO-AUT-<etiqueta>`):
  um resíduo antigo nunca casa com o paciente desta rodada, então nenhum check que
  procura por nome/registro pode ser enganado por ele;
- **varredura idempotente na abertura** (check `Z0`): lista a carteira como admin, apaga
  o que tiver o prefixo `TESTE-PORTAO-AUT` e avisa em voz alta (`AVISO: resíduo de
  rodada anterior removido — id=…`); depois relê a carteira e afirma que nada sobrou. A
  limpeza do fim (`Z`) também passou a **provar** relendo a carteira, não só olhar o
  status do DELETE.

`AVISO` na saída = a rodada anterior morreu; vale saber por quê. Os outros portões
(B, retorno, recursos) ainda usam nome fixo e limpeza só no `finally` — mesmo padrão a
aplicar quando forem tocados.

**Dados frescos:** o branch dev pode ser recriado a partir do principal no console do Neon
sempre que quiser (é barato — Neon faz copy-on-write). Ao recriar, o **endpoint muda**:
atualize `DATABASE_URL` e `ONCOGUIA_DB_DEV_ENDPOINT` em `backend/.env`. Se esquecer, a
trava avisa em vez de deixar rodar no lugar errado.

**Migrations:** rodam por `migrationsRun: true` no boot, então sobem no branch dev assim
que o backend local iniciar, e em produção no primeiro boot depois do deploy. Testar a
migration em dev antes de fazer deploy é o ponto de ter os dois.

---

## Portão A — DADOS (saída do squad)

0. **Fonte certa (checar PRIMEIRO).** Tudo — app, portão, Mesa — resolve o **mesmo** run a partir da constante única **`RUN_ATIVO`** (`squads/mbe-oncologia/RUN_ATIVO`). O portão imprime `Corpus: <caminho>` no cabeçalho:
   - **`Corpus:` tem que ser igual ao `RUN_ATIVO`.** Se aparecer `!!! ATENÇÃO: este caminho NÃO é o RUN_ATIVO`, **o resultado é sobre o corpus errado — descarte** e rode de novo apontando o run ativo. (Este foi o modo de falha de 02/08: o portão rodou no 07-21 rejeitado.)

1. **Invariantes mecânicos.** `python3 verificar_dados.py --check-dois` (sem caminho = usa a **pasta** do run do `RUN_ATIVO`, então os `campos_primitivos` por tumor entram e o check de órfãos roda de verdade; o dedupe mantém o agregado publicado como canônico). Exit `0` = passou; `1` = **não confie**. Checa: confirmado sem DOI, custo "concorda" sem fonte, campos órfãos (tumor sem vocabulário = warn nominal, não passa em silêncio), incompleto=0 por tumor (warn), estadiamento ordinal (warn), soma-invariante (candidatos + não-incorporados = total), consistência agregado × por-tumor (divergência = FALHA — conserto aplicado num lado só), DOIs de confirmado resolvem, **[9] expectativa_uso** (ciclos e periodicidade rastreáveis ao texto do esquema) e **[10] composicao** (cobertura, vocabulário fechado de unidade e via, dias dentro da periodicidade já auditada pelo [9], e a dose realmente escrita no texto).

2. **Amostra viva de DOIs.** Pegue 3–4 confirmados e confirme à mão que o DOI **aponta pro estudo certo** (crossref.org/works/<doi>: autor+ano+tema). Resolver ≠ ser o paper certo. Foi o que pegou o TCHP e os 28 rótulos.

3. **Cheiro de placar.** Muito confirmado / quase nenhum incompleto = bandeira vermelha. Saudável = re_derivado dominando.

   O mesmo vale, invertido, para os dois blocos derivados do texto do esquema: **pouco
   indeterminado é a bandeira vermelha**. Esquema de oncologia é cheio de faixa
   (`AUC 5-6`), alternativa (`cisplatina ou carboplatina`), fase (`AC → paclitaxel`) e uso
   contínuo (`VO 12/12h`) — nenhuma dessas fecha um número. Hoje: `expectativa_uso` 67%
   indeterminado, `composicao` 90% (29 de 295 completas). O check `[10]` levanta warn se o
   indeterminado da composição cair abaixo de 30%: placar bonito ali quase sempre
   significa que alguém escolheu por conta própria entre duas drogas.

4. **Intake só termina quando o backend marca aplicadas.** Executar a decisão no run e
   publicar o run é metade do ciclo; a outra metade é carimbar `revisoes.aplicada_em` no
   backend (mesmo mecanismo do lote 1: migration com backfill por `regimen_id` + `acao` +
   janela de `criado_em`). **O lote 2 pulou isso e o export ficou sujo:** em 15/09 o
   `/revisao/export` mostrou 17 decisões de 12–13/09 como `triada_pendente_execucao` (e 10
   em `aguardando_re_revisao` sem `aplicada_em`) que já estavam executadas e no ar desde
   13/09 — a fila de trabalho do intake seguinte nasceu misturada com o já feito, e a
   reconciliação teve que provar regime a regime, no corpus ativo, que a execução estava lá
   antes de marcar. Regra: o relatório de um intake lista **quais decisões receberam
   `aplicada_em` e em que data**; se a marcação não pôde rodar (backend ocupado por outra
   frente), a migration fica pronta no run (`backend-pendente/`) e o intake é reportado como
   **aberto**, não como concluído. `aplicada_em` só se carimba depois que a execução está
   **publicada** (RUN_ATIVO + build-data + restart), nunca num run só em disco.

---

## Portão B — APP (código)

4. **Fonte certa.** O cabeçalho da app lê o run do `RUN_ATIVO` (07-22). Marcadores de sanidade: TCHP → TRYPHAENA; capivasertibe → CAPItello-291.

5. **Os 4 fluxos reais, de ponta a ponta** (clicando, não confiando no "verificado"):
   - [ ] login (tela de apresentação: apresentação à esquerda, formulário à direita, empilha em tela estreita)
   - [ ] cadastrar paciente (digitar nome inteiro sem apagar) → salva
   - [ ] mudar característica clínica → protocolos re-avaliam **ao vivo** à direita
   - [ ] abrir Revisão → digitar parecer → gravar → aparece atribuído

5b. **Mesa = fila de trabalho (2026-09-14, `portao-b.js` checks B11).** A Revisão clínica
   abre na visão **Fila de trabalho**: *Aguardando re-revisão* no TOPO (o que trava o
   ciclo), depois *Pendente* por tumor; as processadas (aprovado/contestado/ajuste) não
   aparecem expandidas — viram a linha recolhida "▸ N já revisadas neste tumor". É
   **só apresentação**: nenhum dado, estado ou endpoint mudou, e a visão **Tudo** é a tela
   de antes, intacta (é nela que os checks de sempre — B10, B6 do parecer, B5.4 — rodam).
   O portão prova, clicando:
   - [ ] visão padrão = fila, seção de re-revisão vem antes da de pendentes, e o contador
         da seção bate com o `REVC_RESUMO` (não com o que a tela quis mostrar);
   - [ ] **nenhum card processado expandido** na visão padrão; pendentes visíveis =
         pendentes reais; **soma das linhas recolhidas = processadas reais** (recolhido ≠
         removido — se a soma não fechar, algo sumiu);
   - [ ] expandir a linha mostra **exatamente N** cards, todos processados, cada um com
         selo de estado, pareceres (abrindo, aparece a linha do parecer e a linha recolhida
         **continua aberta** depois do re-render) e a **nota da revisão** — o check mira o
         tumor que TEM nota em card processado, para não passar vazio (0 = 0);
   - [ ] filtro **Estado = aprovado**: o contador de cada linha bate com o filtro por tumor,
         a soma bate com o "(N)" do próprio select, só aprovados na tela, e
         `REVC_REVISADAS_FILTRO` (o "Baixar revisadas" do admin) segue o **filtro**, não a
         visão — mesma contagem em Fila e em Tudo;
   - [ ] "Tudo": todos os cards abertos, sem seção nem linha recolhida; console limpo ao
         alternar Fila ⇄ Tudo.

5c. **Lista de pacientes com filtros por coluna (2026-09-14, `portao-b.js` checks B12).**
   O cabeçalho da tabela virou linha de filtros, estilo Excel: nas colunas de valor
   discreto — Tumor, Último protocolo, Médico assistente, Semáforo — um dropdown por
   coluna, populado com os valores **presentes na carteira** (nunca o catálogo) e a
   contagem; em Idade e Próximo retorno, faixas fixas (retorno: atrasado / esta semana /
   futuro / sem agendamento — "atrasado" continua sendo o `vencido` do servidor). Os
   filtros compõem em E entre si, com a busca por nome e com os chips do topo; clicar no
   título ordena asc/desc (setinha); "limpar filtros" desfaz filtros de coluna E
   ordenação (a busca e o chip têm controle próprio). Estado em memória (`LISTA_COL`,
   `LISTA_ORD`): sobrevive ao re-render da lista, morre com a sessão. Só app — nenhum
   endpoint ou guard mudou; a lista de 7 colunas, a ordem atrasados-primeiro e a busca
   continuam iguais. O portão cria um **segundo paciente de teste** (outro tumor, retorno
   em 3 dias) para o "E" ter o que excluir por construção, e confere a tela contra o
   **payload** de `GET /pacientes`, não contra as funções da lista:
   - [ ] dropdown de Tumor = exatamente os tumores da carteira, contagem igual à do
         payload (e menor que o catálogo); Semáforo e faixas de retorno idem;
   - [ ] filtro combinado (Tumor=mama E Semáforo=—) mostra só quem satisfaz os dois; a
         contagem do dropdown com outro filtro ativo bate com as linhas ("Mama (N)" = N);
   - [ ] linha "N paciente(s) · limpar filtros"; chips compõem; filtro sobrevive a
         `carregarPacientes()+render()`;
   - [ ] digitar na busca com filtro ativo: **contador de render = 0**; lista vazia por
         filtro mostra "Nenhum paciente com esses filtros" com o cabeçalho ainda na tela;
   - [ ] ordenar por Paciente (asc/desc, setinha só na coluna ativa) e por Idade
         (numérico, "—" no fim, os dois casos presentes);
   - [ ] "limpar" devolve a lista completa **na mesma ordem** de antes de qualquer clique;
   - [ ] os dois pacientes de teste saem na limpeza — rodar 2x e conferir que a
         carteira volta ao mesmo tamanho.

   Efeito colateral em outro portão: `portao-retorno.js` (L1 e `linhaLista`) lia
   `thead th` por `textContent`; com o dropdown dentro do `<th>` isso traria as opções
   junto, então passou a ler o título em `.th-t`.

6. **Campo de texto livre não re-renderiza a lista.** Nome do paciente, parecer do revisor, "enviar fonte" (DOI): **digitar não pode re-renderizar a lista nem resetar scroll/foco** (testar com contador de render = 0 durante a digitação). Foi o bug do nome que apagava e o da Revisão que subia.

7. **Fiação.** Frontend e backend na mesma porta/base URL; app e Revisão lendo a mesma fonte. Console (F12) sem erro vermelho no load (CORS, `Failed to fetch`, `null`).

8. **Matriz de acesso por perfil ATIVO.** Oncologista: Pacientes, Fluxograma e **Simulador** — sem aba Revisão (nem por URL). Revisor: não cria avaliação. Auditor: fila de exceção, nada de Revisão e **nada de dinheiro**. **Gestor: só Recursos** — sem Pacientes, sem Fluxograma, sem Revisão, sem autorização, sem Simulador, e **sem nome de paciente** (a resposta do servidor sai pseudonimizada). **Secretaria: só Pacientes, e só o administrativo** — ver a fronteira abaixo. Admin: tudo. (Selo de estado do protocolo aparece pro oncologista mesmo sem a Revisão.)

   **Secretaria = administrativo; payload reduzido é corte no servidor (2026-09-14,
   `portao-secretaria.js`).** A fronteira: *administrativo = dela; clínico = nunca*. Ela
   vê nome, registro, idade, convênio, carteirinha, médico assistente, próximo retorno e
   faltosos; cadastra e corrige esses campos; **move a DATA** do próximo retorno (com
   motivo curto) e **registra contato** com faltoso. Não vê tumor, protocolo, semáforo,
   trilha clínica, corpus de evidência nem custo — e **não cria retorno do zero**: o
   intervalo é decisão clínica, nasce no registro do retorno pela mão do médico.
   - **O corte é no SELECT, não na tela.** `GET /pacientes` e `GET /pacientes/:id` para o
     token dela passam por outro caminho de código (`PacientesService.listarAdministrativo`
     / `obterAdministrativo`): as colunas clínicas do paciente **não são lidas do banco**, e
     as tabelas de avaliação/retorno são consultadas só pelas colunas que resolvem o médico
     assistente. É o mesmo desenho da pseudonimização do gestor. O portão prova por
     **teste afirmativo**: a resposta dela **não contém** o tumor nem o protocolo do
     paciente de teste, enquanto a do oncologista, para o **mesmo** paciente, contém.
   - **Chave clínica no body dela é 403**, não descarte silencioso (`tumor`, `sistema`,
     `subtipo`, `valores_estaveis` — inclusive `null`). Descartar deixaria a tela "salvar"
     um tumor que o servidor ignorou.
   - **Reagendar move `pacientes.proximo_retorno` e só.** `retornos.proximo_retorno` /
     `proximo_intervalo` — a decisão do médico, congelada no registro — **fica igual**; o
     portão confere a coluna depois de cada reagendamento (por API e pela tela). O
     movimento vira **evento administrativo append-only** (de onde → para onde, motivo,
     autor, perfil ativo), e é assim que o médico fica sabendo: a trilha dele ganha o tipo
     `administrativo`, ao lado de avaliação, retorno e autorização. Sem retorno agendado,
     **409** — não há o que reagendar.
   - **Contato com faltoso é append-only**: sem rota de edição nem de remoção (o portão
     bate PATCH/DELETE e exige 404, inclusive com token de admin). Aparece na ficha dela e
     na trilha do médico.
   - **Whitelists literais, nunca "autenticado"** (`backend/src/auth/cadastro.guard.ts`):
     leitura do cadastro = clínicos + secretaria; criar = os quatro clínicos que já criavam
     + secretaria (efeito de hoje preservado em lista escrita — estreitar é decisão
     separada); corrigir = oncologista/revisor/admin (o que o `@Roles('oncologista')`
     hierárquico dava) + secretaria; agenda e contato = `['oncologista','admin','secretaria']`.
     Tudo o mais (avaliação, retorno, trilha, seleção, revisão, autorização, custo,
     recursos, usuários, remoção) é **403** para ela — 16 leituras e 10 escritas na matriz.
   - **Importação (2026-09-15):** ela envia a proposta de importação e lê só o estado dela
     (sem payload); quem valida é o oncologista — ver o Portão da IMPORTAÇÃO abaixo.
   - **Na tela:** só a aba Pacientes; lista com 4 colunas (os filtros de coluna funcionam
     no que ela vê); ficha administrativa **sem nada clínico no DOM** (o portão procura
     Trilha/Seguimento/Reavaliar/Semáforo/Protocolo/R$, o nome do tumor e o do protocolo —
     e exige ausência); `go()` para qualquer outra tela cai na lista; `EVIDENCIA` nunca é
     carregada na sessão dela.

   **Simulador para o oncologista (2026-09-07).** A aba entrou na lista dele porque é
   **leitura pura do corpus de evidência** — sem paciente, sem escrita, sem dinheiro — e é
   onde o "informa, o médico decide" vira exploração livre: mexer nas características e
   ver o semáforo responder, com o **mesmo motor** da tela do paciente. Entrar aqui **não**
   o coloca em Revisão clínica: as duas abas dividiam um ternário só no `renderNav()`, por
   acidente de escrita, e agora cada uma tem a sua whitelist literal (`podeSimular()` vs. a
   lista da Revisão). **Nenhuma rota nova foi aberta no servidor** — o Simulador lê o que a
   tela do paciente já lia (`/evidencia`, `/revisoes/resumo`, `/revisoes/fontes`), tudo já
   dentro da whitelist dele; a whitelist do oncologista **não mudou uma linha**.

   *(`/evidencia` — pendência **3** do `BACKLOG.md`, **fechada em 2026-09-14**: o corpus
   deixou de ser "qualquer autenticado" e passou a whitelist literal dos cinco perfis
   (`CorpusGuard`). O efeito para os cinco não mudou — e o portão prova isso de forma
   **afirmativa** (`portao-secretaria` E1: cinco tokens, cinco 200). A secretaria é o
   primeiro perfil que fica **fora de propósito** (E0: 403).)*

   > **INVARIANTE — o Simulador é somente leitura por CONTRATO.** Não há `POST`/`PUT`/
   > `PATCH`/`DELETE` em nenhum caminho da tela, e o botão "Selecionar protocolo" não
   > existe lá (flag `sandbox` no pseudo-paciente, lida por `renderProtos`). O portão não
   > confia na leitura do código para isso: ele **escuta a rede** e exige zero escritas
   > enquanto o Simulador está aberto. **Feature futura que queira salvar simulação é
   > decisão NOVA, não extensão desta** — salvar cria um registro sem paciente, sem
   > autoria clínica e sem trilha, que é exatamente o que a sandbox existe para não ser.
   > Quem for propor isso passa por aqui primeiro.

   **"Por perfil ATIVO" é literal, e importa desde os perfis múltiplos.** Uma pessoa pode
   ter vários chapéus e veste um por vez; a matriz testa o que ela está **vestindo**, nunca
   a lista do que ela pode vestir. A prova é a mesma pessoa com dois tokens dando 403 e 200
   na mesma rota (`portao-perfis`, checks `P5`/`P6`). E há uma pergunta que a matriz não
   consegue fazer — "foi você quem pediu?" —, coberta pela **regra de conflito** da
   autorização: ninguém decide a própria solicitação, qualquer que seja o perfil ativo.
   - [ ] trocar de perfil no seletor do topo (só aparece para quem tem mais de um) e
         conferir que as abas mudam nos **dois** sentidos
   - [ ] trocar com um formulário aberto → **pede confirmação nomeando o que se perde**;
         cancelar preserva o que estava digitado

   O gestor é o perfil que mais exige o teste **nas duas pontas**: o que ele não pode ver
   tem de dar 403 na **API direta**, não só sumir da tela. Foi assim que apareceu a falha
   real desta fase — `GET /pacientes` e `GET /revisoes/resumo` diziam "leitura = qualquer
   autenticado", o que era verdade enquanto todo perfil autenticado era clínico. O gestor
   levava 200 com nome, carteirinha e tumor de todo mundo. A correção não foi uma lista de
   quem NÃO pode (blacklist envelhece mal: o próximo perfil novo nasceria vendo tudo) — foi
   `LeituraClinicaGuard`, a lista literal de quem pode.

9. **Enquadramento e ficha limpa** (piloto com oncologistas, paciente real anonimizado):
   - [ ] **Nada de protótipo na tela.** Sem o badge "dados fictícios" e sem o banner
         "Protótipo conceitual". No lugar, uma linha permanente no rodapé: *"Apoio à
         decisão baseado em evidência — nada aqui é recomendação clínica; informa, o
         médico decide."* O badge era uma afirmação **falsa** sobre o conteúdo do banco a
         partir do momento em que entra paciente de verdade.
   - [ ] **"Instituição", não "hospital"** (Rodada C, 2026-09-17): os textos da app dizem
         *instituição* — "Identificador (registro da instituição)", "o que a instituição
         paga pelos insumos" (Recursos, duas vezes). O nome próprio "Hospital Orizonti" no
         cabeçalho de Pacientes ficou como está (é nome, não substantivo); comentários de
         código não contam como texto da app.
   - [ ] **Campo de nome orienta, não bloqueia.** Rótulo e placeholder dizem "Iniciais +
         nº de atendimento (não usar nome)". É orientação de tela: validação que recusasse
         texto aqui só ensinaria a burlá-la (o nome entraria com um ponto no meio).
   - [ ] **A ficha do paciente não mostra dinheiro — para NENHUM perfil, admin incluído.**
         Sem "ESTIMATIVA", sem "R$". Os blocos "Expectativa de uso e custo" e
         "Decomposição por insumo" saíram da ficha: o momento clínico não mostra preço
         nem o **estado vazio** dele (a decomposição só fecha em 29 de 295 protocolos, então
         o que aparecia na maioria das fichas era uma explicação sobre composição
         estruturada no meio da leitura de um paciente). O número mudou de lugar, não sumiu:
         projeção e demanda de compra na aba **Recursos**, expectativa por solicitação no
         fluxo de **autorização**. A rota `/custos/paciente/:id` continua existindo e
         continua coberta (G4/G7).

---

## Portão de RECURSOS (`scripts/portao-recursos.js`)

Especialização do portão B para a gestão de recursos — insumos, compra, faturamento e
margem. Roda em browser isolado (headless) + API direta, 94 checks.

```bash
node scripts/portao-recursos.js       # exige app (5173) e API (3005) no ar
```

O que ele cobre, e por que cada parte existe:

- **Aritmética recalculada com regra PRÓPRIA.** O portão reimplementa do zero
  dose → mg por aplicação → frascos → R$, a partir do JSON de origem
  (`backend/data/evidencia.json`) e dos preços que ele mesmo cadastra. Não importa nada de
  `backend/src/recursos/dose.ts`: portão que chama a função sob teste concorda com ela por
  construção. Cobre as três conversões que decidem dinheiro — **mg/m²** (superfície),
  **mg/kg** (peso) e **AUC** (Calvert, `AUC × (clearance + 25)`) —, o arredondamento de
  frascos para **cima por aplicação** (não por ciclo: cada administração abre frascos
  novos), o desperdício em mg e %, e a **margem como diferença exata** — com o mínimo da
  margem usando o **máximo** da compra.
- **As três origens exercitadas.** `insumo` (composição fecha e há preço de frasco),
  `protocolo-fallback` (composição indeterminada + preço por ciclo cadastrado — dá compra
  e **nenhuma** receita, porque `custos_regime` não tem preço de contrato) e `sem-dado`
  (nem um nem outro; **nunca** zero).
- **Faturamento ausente não vira margem zero.** Um dos insumos de teste é cadastrado
  **sem** preço de contrato de propósito: o protocolo que o usa tem compra e fica sem
  receita e sem margem. Herdar o preço de compra daria margem zero — um número que parece
  resposta e é a ausência dela.
- **A camada de dinheiro é UMA aba.** "Custo por ciclo" e "Insumos" eram abas irmãs de
  primeiro nível e viraram seções de **Recursos**: projeção no topo, "Preços por protocolo"
  aberta (é o caminho principal — preço por protocolo alcança todo esquema com tempo
  derivável), e "Avançado — custo por insumo" **recolhida**. O portão trata seção recolhida
  como risco, não como detalhe: confere que ela **nasce fechada e sem o formulário no DOM**,
  que o cabeçalho **declara a cobertura real** ("cobre 8 de 295 protocolos" — recolhido só é
  honesto se disser o tamanho do que recolheu), e só então **abre** a seção e roda os checks
  de digitação. Os endereços antigos continuam vivos: `go('custos')` cai na aba, e
  `go('insumos')` cai na aba **já com a seção avançada aberta** — redirecionar para o topo
  da tela seria um link vivo levando ao lugar errado.
- **Matriz do gestor nas DUAS pontas.** Oncologista, revisor e auditor levam 403 em toda
  rota de `/recursos` **e de `/custos`** — a camada financeira inteira é `['gestor','admin']`.
  O gestor leva 403 em 10 rotas clínicas e nas escritas de recursos e de preço; lê `/custos`
  com a carteira **pseudonimizada**. Na tela: só a aba Recursos, e `go('lista')` cai em
  Recursos em vez de tela vazia.
- **Pseudonimização com teste AFIRMATIVO.** Não basta "o campo `paciente` está ausente": o
  portão procura o **nome literal** do paciente de teste no corpo inteiro da resposta, na
  tela inteira e dentro do `.xlsx`. E confere o contraste — o admin recebe o nome, porque a
  pseudonimização é do **perfil**, não da rota.
- **`.xlsx` aberto e conferido contra a tela.** O portão descompacta o arquivo (leitor de
  ZIP *stored* próprio), lê as duas planilhas e compara linha a linha com
  `REC_PROJ` — frascos, R$ e o `"sem dado"` onde a tela não tem faturamento.
- **Texto livre não re-renderiza a lista** (contador de render = 0), em preço e em fonte.
- **Medidas do paciente sobrevivem a uma edição cadastral.** Peso e altura entraram na
  tela de edição, e não só na de cadastro novo, porque a edição envia PATCH com o que ela
  conhece: um campo que ela não mostra vira `null` no caminho. Sem isso, "corrigir o nome"
  apagaria as medidas em silêncio e o custo do paciente voltaria ao paciente-padrão.
- **Devolve o banco como encontrou.** Insumo e apresentação que o portão criou são
  apagados; apresentação padrão e premissas que já existiam são restauradas. **Rode duas
  vezes seguidas** — a segunda tem de dar o mesmo resultado da primeira, e é isso que pega
  resíduo de teste.
- **Seção recolhida é verificada ABERTA.** O cadastro por insumo virou a seção "Avançado —
  custo por insumo" da aba única Recursos, fechada por padrão. O portão confere que ela
  **nasce fechada e sem conteúdo no DOM**, que o cabeçalho da seção fechada **declara a
  cobertura real** (`cobre X de N protocolos`), e só então a **abre** para rodar os mesmos
  checks de antes. Recolher a UI não pode virar recolher o check.

---

## Portão da SECRETARIA (`scripts/portao-secretaria.js`)

`node scripts/portao-secretaria.js` — browser isolado e headless + API; 7 logins (o
helper espera no 429; **não encadeie** com outro portão sem ~1 min de janela). A conta de
secretaria é **descartável**: o admin a cria **pela tela** na Fase 0 (prova a caixa
`secretaria` e a lista `[secretaria]` gravada) e o `finally` a apaga — como no
`portao-perfis`, e por isso **não há par de variáveis dela no `.env.local`**.

Fases: **Setup** (oncologista, API) cria dois pacientes com tumor, avaliação vigente e
retorno — um com agenda futura, um **faltoso** (retorno há 60 dias, próximo em 1 mês →
vencido). **Fase 1** (API, token dela): payload reduzido na lista e na ficha, contraprova do
oncologista no mesmo paciente, `/evidencia` 403 para ela e 200 para os cinco, 403 em 16
leituras e 10 escritas fora do cadastro, POST/PATCH administrativos aceitos e chave clínica
recusada, reagendamento (400 sem motivo, 400 para a mesma data, 200 movendo a agenda,
**coluna congelada do retorno inalterada**, 409 sem retorno agendado, revisor/gestor 403),
contato (400 meio inválido, 201, ficha, **404 em PATCH/DELETE**), trilha do médico com os
itens `administrativo`. **Fase 2** (tela dela): aba única, 4 colunas, filtros de coluna,
chip e linha do faltoso, ficha sem nada clínico no DOM, reagendar e registrar contato pela
tela com **0 re-render** ao digitar, cadastro novo sem bloco de tumor (0 re-render no nome;
o servidor grava `tumor: null`), edição com nascimento/convênio/carteirinha, `go()` proibido
cai na lista, `EVIDENCIA === null`, console limpo. **Fase 3** (tela do oncologista): a
trilha mostra o reagendamento e o contato como "Administrativo" com o nome dela, o item do
retorno continua dizendo a data **original**, e o topo mostra a agenda **nova**.

> **Lição (2026-09-14) — dois CHECKs com nomes quase iguais.** `usuarios` tem
> `CHK_usuarios_perfil` (a coluna do perfil ativo, de `SolicitacaoExcecao`, refeito em
> `Recursos`) **e** `CHK_usuarios_perfis` (a lista, de `PerfisMultiplos`). A primeira versão
> da migration da secretaria refez só o segundo; o pré-flight manual olhou só o segundo; o
> boot passou; e o primeiro `Criar usuário` do portão voltou **500** — "violates check
> constraint CHK_usuarios_perfil". A migration foi corrigida (drop-and-add dos **dois**),
> revertida e reaplicada no dev, e o pré-flight de deploy agora lista os dois constraints
> pelo nome e diz de cada um se já contém `secretaria`. O que fica: **vocabulário de perfil
> vive em dois constraints; quem adiciona perfil refaz os dois** — e o portão que cria a
> conta pela tela é o que pega isso antes do deploy.

## Portão da IMPORTAÇÃO (`scripts/portao-importacao.js`)

`node scripts/portao-importacao.js` — browser isolado e headless + API; 6 logins (4 por API,
2 na tela; o helper espera no 429 — **não encadeie** sem ~1 min de janela). A conta de
secretaria é **descartável** (criada por API na Fase 0, apagada no `finally`, como no
`portao-secretaria`). Etiqueta única por rodada (`TESTE-PORTAO-IMP-<n>-<etiqueta>` no
registro, `portao.imp.<etiqueta>` no login) e varredura idempotente `Z0` na abertura, pelo
prefixo — pacientes **e** usuárias de rodada morta.

**O desenho sob teste (2026-09-15, entrega 1).** Duas alçadas, UM ponto de digitação:

- a **secretaria importa o paciente inteiro** — o cadastro vai pela rota normal (só
  administrativo, como sempre) e os dados clínicos vão como **PROPOSTA PENDENTE**
  (`POST /pacientes/:id/importacao-proposta`, tabela `importacao_propostas`). Proposta é
  **envelope, não registro**: nada é lido por motor, snapshot ou trilha clínica, e ela
  continua proibida de escrever primitivo pelas rotas normais. Ela vê só "proposta
  enviada, aguardando validação" — o `GET` dela devolve `{id, estado, criada_em,
  criada_por, decidida_em}` **sem `payload`**, inclusive do que ela mesma postou;
- o **oncologista (ou admin) valida**: abre o paciente, vê a tabela campo | valor
  proposto | trecho do prontuário, corrige o que precisar e clica **Validar**. O servidor
  então, nesta ordem: grava os primitivos no paciente (tumor, sistema, subtipo,
  `valores_estaveis` só com o estável informado) → calcula o **semáforo no servidor**
  (`backend/src/evidencia/semaforo.ts`, porte do `evalExpr` da app) → **verde**
  (elegível + incorporado) cria a avaliação vigente com a nota de importação em
  `detalhe_semaforo.ressalva`; **qualquer outra cor** não seleciona nada e devolve o
  motivo (**nunca** nasce exceção automática — 🔴 e "não incorporado" ficam para a
  reavaliação, pela mão do médico) → se a meta trouxer `data_evolucao`, cria o retorno
  (data realizada = evolução, próximo = o da meta, `observacoes` = nota; padrão do #80) →
  marca a proposta `validada` com quem/quando e o `resultado`. **Assinaturas** (avaliação,
  retorno) são do **validador**; a proposta aparece na trilha como evento
  `administrativo`/`proposta_importacao` com o nome da secretaria e o desfecho.

**Duas regras do semáforo do servidor que diferem da tela de reavaliação, de propósito:**

1. **Só o INFORMADO entra** — sem default por tipo. A app, ao desenhar o formulário,
   presume `false` para booleano ausente e a primeira opção para enum (conveniência de
   tela). Na importação um booleano ausente é **indeterminado** → 🟡, nunca `false`, nunca
   verde. Foi a regra do piloto #80 e é o que o check `V1 ★★` / `N1 ★★` provam:
   `quimio_naive` fora do envelope → fora do snapshot, e a regra do mCRPC que o exige
   fica em ATENÇÃO com o motivo nomeando o campo. O validador **preenche** (correção
   `{campos:{quimio_naive:true}}`) e o mesmo envelope vira verde (`N4`).
2. **Correção substitui, ausência não apaga**: `campos` da validação é `{campo: valor}`;
   o que vier substitui o proposto, `null` remove, e o que não vier fica como proposto.
   O `resultado.correcoes` guarda `de → para` de cada uma.

**Terceira cópia de uma regra.** O interpretador da elegibilidade agora vive na app
(`evalExpr`), no servidor (`semaforo.ts`) e o eixo "não incorporado" já vivia nos dois
(`EvidenciaService.naoIncorporado`). Dívida conhecida, mesma justificativa do irmão: o
servidor não pode confiar no semáforo que a app manda. O portão **compara os dois**: a
pré-visualização do painel (motor da app, só com o informado — `impPreviewHtml`) tem de
dar o mesmo veredito que o servidor deu por API para os mesmos dados (`O3 ★★` vs `V1`).
Se a regra mudar num lado só, é aqui que quebra.

**Vocabulário sem corpus.** A secretaria não lê `/evidencia` (403; o `portao-secretaria`
exige `EVIDENCIA === null` na sessão dela, e continua exigindo). O formulário dela desenha
tumores, campos primitivos e **nomes** de protocolo a partir de
`GET /importacao/vocabulario` (whitelist literal `['secretaria','admin']`,
`ImportacaoVocabularioGuard`) — dicionário de formulário, não corpus: o portão confere
que a resposta **não contém** `regra`, `referencia`, `beneficio`, `custo` nem `doi`
(`A1 ★`), e que revisor e gestor levam 403 nela.

**Whitelists literais** (`backend/src/auth/importacao.guard.ts`): propor =
`['secretaria','oncologista','admin']` (e a extração do PDF herda esta lista); ler =
`['oncologista','admin','secretaria']` (o serviço corta o payload para a secretaria);
decidir (validar/descartar) = `['oncologista','admin']` — mesma lista da escrita de
avaliação, **escrita de novo** em vez de importada, para que estreitar uma não estreite
a outra por acidente; vocabulário = a mesma lista de quem propõe.

**O oncologista importa (2026-09-17, pedido da direção — Rodada C).** Até aqui ele não
propunha ("registra direto; passar pela proposta seria assinar duas vezes"). Com a leitura
do PDF o caminho PDF → extração → proposta poupa a digitação também para ele, então a
whitelist de propor (e a do vocabulário) ganhou `oncologista`. Quando é ele quem importa,
**ele mesmo valida em seguida** — não há regra de conflito aqui, ao contrário da
autorização de exceção: as duas pontas são a mesma alçada clínica, e a proposta continua
sendo envelope (nada vira registro antes do Validar, seja de quem for). Na tela, o
"+ Novo paciente" dele oferece "Cadastrar manualmente | Importar"; no modo Importar o bloco
"Tumor do paciente" **some** (o tumor vem na proposta e é gravado na validação), e
"Cadastrar e enviar proposta" abre a ficha **já com o painel de validação** ("Enviada por
… (você)"). Revisor e gestor seguem 403 em propor, extrair e vocabulário. Checks `I1`–`I6`
do `portao-importacao` (API: vocabulário 200, proposta 201 **com** o payload de volta,
validação pelo próprio → vigente assinado por ele, trilha com "proposta por <ele>" e
"validada por <ele>"; UI: toggle, sem bloco de tumor, painel na própria ficha, Validar →
vigente) e `A1` do `portao-extracao` (oncologista passa da whitelist de extrair).

**Validação é TUDO ou NADA.** Primitivos, avaliação, retorno e o carimbo da proposta
entram num commit só (`dataSource.transaction`; `criarAvaliacao` e `RetornosService.criar`
aceitam o `EntityManager` da transação como último parâmetro opcional — fora dela, nada
muda). O motivo é concreto: na primeira suíte (2026-09-15) o driver WebSocket do Neon
derrubou a conexão duas vezes em 30 min (`QueryFailedError: [object ErrorEvent]`), uma
delas no meio de um `validar`. Sem transação, o corte poderia deixar tumor gravado e
avaliação criada com a proposta ainda `pendente` — e a revalidação duplicaria a
avaliação. Com ela, o 500 é só um 500: nada meio-escrito, revalidar é seguro. O portão
faz o `DELETE` da limpeza tentar uma segunda vez num 5xx pelo mesmo motivo.

**Invariantes no banco, não só no serviço:** `estado` em CHECK literal
(`pendente|validada|descartada`); **uma pendente por paciente** por índice único parcial
(`UQ_importacao_propostas_pendente`) — o serviço devolve 409 legível, mas a trava que vale
é a do índice; cascata no paciente (o `DELETE /pacientes/:id` da limpeza leva as
propostas), SET NULL nos autores.

Fases e o que cada uma prova:
- **Fase 1 (API):** vocabulário (A1); secretaria cadastra + propõe o **J.M.G.M. do piloto
  #80** como massa (S1); resposta e GET dela sem payload, contraprova do oncologista lendo
  **exatamente** os campos, valores e trechos enviados (S2 ★★); **nada clínico** no
  paciente depois da proposta — tumor null, `valores_estaveis` vazio, 0 avaliações, sem
  agenda (S3 ★); `importacao_pendente` nos dois payloads de lista; 403 para secretaria
  validar/descartar, revisor ler/validar/propor e oncologista propor (S4); segunda pendente
  = 409 (S5); 400 em campo fora do vocabulário, booleano como string, protocolo de outro
  tumor, enum fora das opções e data fora do ISO (S6); validação verde com correção
  `gleason 9→8` — vigente, assinatura do validador, nota montada pelo servidor com início,
  evolução, médica e `sem_campo`, correção valendo, **booleano ausente ausente**, `psa 0.02`
  decimal preservado (V1); retorno com as datas da meta e `observacoes` = nota (V2); ficha
  no padrão do #80 (V2); proposta `validada` com `resultado` (V3); trilha (V4); revalidar =
  409 (V5); três **não-verdes** — atenção por campo faltando (N1), inelegível (N2), não
  incorporado (N3) — sem vigente, **0 avaliações** (nenhuma exceção nasceu), motivo
  devolvido, primitivos gravados; correção que destrava (N4); descarte sem motivo = 400,
  com motivo grava quem/quando/motivo, paciente segue sem tumor, validar depois = 409
  (D1); depois do descarte pode-se propor de novo (D2).
- **Fase 2 (tela da secretaria):** "Cadastrar manualmente | Importar" (U1); modo Importar
  com o formulário administrativo + "Dados clínicos para validação médica", `EVIDENCIA`
  ainda nula (U1); escolher o tumor reconstrói **só** `#imp-clin` (0 render global, nome
  íntegro) e o select de protocolo lista os regimes do tumor pelo nome (U2); botões
  **tri-estado** (— / Não / Sim) com destaque in place (U3); digitar trecho, médica e
  `sem_campo` com **0 re-render** (U3 ★); "colar JSON" preenche o formulário (U4);
  "Cadastrar e enviar proposta" → ficha administrativa diz "Proposta de importação
  enviada… aguardando validação clínica" e **continua sem nada clínico no DOM** — nem o
  protocolo que ela acabou de propor (U5 ★★); o servidor recebeu o envelope inteiro (U5);
  lista dela com o selo (U6); console limpo (U7).
- **Fase 3 (tela do oncologista):** selo "⏳ aguardando validação clínica" na linha, opção
  própria no filtro da coluna "Último protocolo" com a contagem batendo com o payload e
  o filtro deixando só quem espera (O1); painel na ficha com autora, tabela e trechos
  (O2); proposto marcado, **não proposto marcado como "—"** (não como "Não") (O2);
  pré-visualização = 🟢 "vira vigente", igual ao servidor (O3 ★★); corrigir Metastatico
  para Não repinta **só** `#imp-preview` para 🔴 (O3); corrigir gleason e linha com 0
  re-render (O4); Validar → painel some e a ficha é a do #80: vigente, nota ⚠️, fotografia
  clínica com o valor corrigido (O5 ★★); registro com correções, booleano ausente e
  assinatura do logado (O5); trilha com a proposta como Administrativo + seleção e retorno
  do validador (O6); Descartar… pela tela pede motivo no `prompt` e grava (O7); console
  limpo (O8).

> **Lição (2026-09-15) — array de interface some na ValidationPipe.** A pipe global roda
> com `enableImplicitConversion: true`; um DTO com `campos: CampoProposto[]` (interface,
> sem classe) chega ao serviço como `[[]]` — cada objeto vira um array vazio na conversão
> implícita, e o serviço recusava "campo sem nome" num envelope perfeitamente válido. A
> cura é a de sempre no repositório (`ToxicidadeDto` no retorno): classe + `@Type(() =>
> CampoPropostoDto)` + `@ValidateNested({ each: true })`. Vale para qualquer array de
> objeto num body: **interface no DTO é dado perdido em silêncio.**

> **Lição (2026-09-15/16) — suíte longa exige a máquina ACORDADA.** A primeira suíte
> completa desta entrega correu à noite e três portões intocados (retorno, custo, recursos)
> mais a secretaria voltaram vermelhos com `QueryFailedError: [object ErrorEvent]` — 500
> em rotas que não mudaram. `pmset -g log` mostrou o Mac entrando em *Idle Sleep* a cada
> ~2 min desde 18:29, e **cada erro do backend bate ao segundo com um DarkWake**
> (19:23:19, 19:36:13, 20:49:00, 22:01:25, 22:31:02, 22:53:01, 23:11:25). O WebSocket do
> driver do Neon morre no sleep; a primeira query depois do wake falha. Um portão que
> atravessa um ciclo de sleep não vale nada — nem verde nem vermelho. A suíte roda com
> `caffeinate -i -s node scripts/portao-X.js` (ou o laptop na tomada com a tampa aberta), e
> um vermelho com `[object ErrorEvent]` no log do backend se descarta e se repete acordado.
> Foi isto que motivou a transação na validação (acima): a mesma queda, no meio de um
> `validar`, teria deixado registro pela metade.

> **Lição — `pkill -f "node dist/main"` não é "reiniciar o backend".** Três projetos desta
> máquina sobem Nest com o mesmo comando; o padrão casa com qualquer um deles (e com o
> próprio shell que o dispara). Reiniciar é `lsof -nP -iTCP:3005 -sTCP:LISTEN -t` → conferir
> `ps -p <PID> -o command=` → `kill <PID>` — pela **porta**, nunca pelo nome do comando.

**O que a entrega 1 deixa de fora (por desenho, para a entrega 2):** leitura do PDF no
navegador (pdf.js) e extração dos clínicos por endpoint que chama a API do Claude com
prompt fixo por tumor. Nesta entrega a proposta nasce do formulário guiado ou do JSON
colado — o `impCarregarJson` é o ponto onde a extração vai plugar.

## Registro único (`UQ_pacientes_identificador`, 2026-09-16) — checks `R` do `portao-importacao`

O nº de atendimento/registro identifica o doente: **cadastrar de novo um registro
existente não cria outro paciente**. Motivo concreto: testando a mesma evolução mais de
uma vez em produção, o J.M.G.M. nasceu duas vezes (#80 e #82) — cada cópia com trilha,
agenda e protocolo próprios, um "branch" do mesmo doente.

- **A trava é do banco**: índice único **parcial** em `pacientes.identificador`
  (`WHERE identificador IS NOT NULL AND identificador <> ''`), padrão da UQ das
  propostas. Nulo/vazio segue livre n vezes (seed, testes, cadastro sem registro).
- **O serviço devolve 409 nomeando quem já está lá** — `Registro 2525705 já cadastrado:
  J.M.G.M. (#80)` — no `POST /pacientes` (manual e importação: a proposta nasce sobre o
  paciente, e o paciente nasce por aqui) e no `PATCH` que tenta trocar o registro para um
  que é de outro. Espaços em volta são o mesmo registro (trim). A violação do índice
  numa corrida também vira 409.
- **Migration com pré-flight** (`RegistroUnico1789862400000`, padrão PerfilSecretaria):
  duplicata existente → aborta com a lista, e com ela o boot — em vez do erro genérico do
  `CREATE UNIQUE INDEX`. Em dev não havia; em produção a #82 saiu antes do deploy.
- **Parte 2 (tela) fica para depois** da Fase C do pulmão commitar: checar o registro ao
  sair do campo e oferecer "abrir a ficha do existente" em vez de criar.

Checks (`portao-importacao`, `R1`–`R3`): secretaria repete o registro de P1 → 409 com
nome e #id; oncologista manual → 409; com espaços → 409; ausente/null/vazio → 3 × 201 e
gravados como null; PATCH de outro paciente para o registro existente → 409; PATCH do
próprio mantendo o registro → 200; dar registro novo a quem não tinha → 200.

> **Lição (2026-09-16) — dois portões iguais, um banco só.** Duas sessões rodaram o
> `portao-importacao` ao mesmo tempo contra o dev: a varredura `Z0` de uma apagou os
> pacientes e a usuária da rodada da outra (mesmo prefixo, ids 312–318). Os checks
> vermelhos eram 404, não código. A varredura por prefixo é correta para resíduo de rodada
> **morta**; não distingue rodada **viva** de outra sessão. Antes de rodar um portão, `pgrep
> -f scripts/portao-<nome>` — e sessões paralelas combinam a pista (aqui, por mensagem
> entre sessões). A etiqueta única por rodada protege os checks, não a limpeza alheia.

**SELECT de conferência do índice novo (dev e produção):**
```sql
SELECT indexdef FROM pg_indexes WHERE indexname = 'UQ_pacientes_identificador';
-- CREATE UNIQUE INDEX "UQ_pacientes_identificador" ON public.pacientes USING btree (identificador)
--   WHERE ((identificador IS NOT NULL) AND ((identificador)::text <> ''::text))
SELECT identificador, count(*) FROM pacientes WHERE identificador IS NOT NULL AND identificador <> ''
 GROUP BY identificador HAVING count(*) > 1;                       -- vazio
```

## Portão da EXTRAÇÃO (`scripts/portao-extracao.js`) — entrega 2

`node scripts/portao-extracao.js` — tela da secretaria (browser isolado) + API; 5 logins.
Precisa de DUAS coisas fora do repo, e diz no cabeçalho se as tem: o **PDF real do
J.M.G.M.** em dev (`PORTAO_PDF_JMGM`, default `~/Downloads/paciente exemplo.pdf` — **nunca
entra no repo**) e a **`ANTHROPIC_API_KEY` em `backend/.env`** (a extração real custa
centavos por rodada). Sem chave, os checks `E`/`D4+` ficam **vermelhos de propósito** —
"não executado" nunca passa verde.

**O desenho (2026-09-16).** Nada do arquivo sobe:
- **pdf.js lê o PDF no navegador** (`pdfParaTexto`: itens agrupados por y, ordenados por
  x — o layout do Orizonti é tabular). O **cabeçalho** sai por regex, determinístico
  (`lerCabecalhoOrizonti`): nome → **só as iniciais** (`iniciaisDe`, particulas
  de/da/dos ignoradas; o nome completo é descartado na hora), atendimento (dígitos),
  nascimento, sexo, convênio → operadora/plano, peso/altura, e o que o layout já traz
  pronto (Dt. Entrada = data da evolução, "Data provável do retorno", a assinatura antes
  de "Conselho:", "Tipo de tumor" → pré-seleciona o tumor). Vai direto para o cadastro
  administrativo.
- **Raspagem determinística antes de qualquer envio** (`rasparNarrativa`): nome inteiro e
  cada token do nome (acento-insensível, `tokenRegex`), atendimento e prontuário com e
  sem pontos, nascimento em três formatos, telefone → `[REMOVIDO]`. O texto raspado fica
  **visível** ("Isto será enviado para análise") com a contagem do que foi removido; só ele
  viaja. O estado da app guarda iniciais + texto raspado — **não** o nome, **não** o texto
  original (o portão confere as chaves).
- **`POST /importacao/extrair`** `{tumor, texto_raspado}` — whitelist literal
  `['secretaria','admin']` (a mesma de quem propõe). Adaptador de provedor
  (`backend/src/importacao/provedor-llm.ts`): `ANTHROPIC_API_KEY`, `IMPORTACAO_MODELO`
  (padrão `claude-sonnet-5`), `IMPORTACAO_PROVEDOR` (hoje só `anthropic`; trocar de
  fornecedor = outra classe + env). **Processa e descarta**: nem texto nem resposta são
  gravados ou logados — o log tem modelo, tokens e contagens. Sem chave → **503** com
  instrução; o resto da importação segue de pé (o portão prova os dois num backend
  efêmero em outra porta com a chave vazia).
- **Prompt fixo montado do vocabulário** do tumor (campos, tipos, opções; regimes com
  id/nome/cenário/esquema — três "Enzalutamida" em próstata se distinguem pelo cenário) e
  **saída JSON estrita** por schema (structured outputs). E a trava que não depende do
  modelo: **todo valor vem com trecho literal, e o servidor confere que o trecho está no
  texto** (`ExtracaoService.extrair`, comparação sem acento/espaços) — campo sem trecho,
  trecho parafraseado, valor fora das opções ou booleano não explícito é **descartado** e
  listado em `descartados` (a tela mostra). "Não inferir" vira mecânica.
- A extração **preenche o formulário guiado** pelo mesmo caminho do "colar JSON"
  (`impAplicarExtracao` → `impCarregarJson`), completando a meta com o que o cabeçalho já
  deu de forma determinística. **Nunca envia proposta sozinha**: a secretaria confere e
  envia; o oncologista valida como na entrega 1.

Checks: `A1` 403 oncologista/revisor · `A2` 400 · `A3 ★` 503 sem chave + vocabulário 200
no mesmo backend · `P1 ★` **afirmativo**: o texto original (extraído pelo portão com o
mesmo pdf.js, e que fica só nele) contém nome/atendimento/prontuário/nascimento · `P2 ★`
cabeçalho → cadastro (J.M.G.M., 2525705, 1958-02-08, M, Unimed/Única, 110,5 kg, 171 cm,
Próstata, 28/08, 25/09, a médica) · `P3 ★★` raspado sem nenhum identificador, removidos>0,
estado sem nome/original, texto visível antes do clique, narrativa preservada · `E1–E5`
extração real no J.M.G.M.: todo campo com trecho literal no raspado, gleason 9 e T3b
presentes, **convulsao_previa e quimio_naive AUSENTES** (o texto não os declara), meta
28/08 e 25/09, proposta enviada com os trechos · `D1–D7` a **demo sintética**
(`scripts/exemplos/evolucao-demo.pdf`, paciente fictício A.C.F.L., gerada por
`gerar-evolucao-demo.js` com Chrome headless no layout do Orizonti): cabeçalho, raspagem,
extração com o caminho feliz (metastático, sensível à castração, nega convulsão, Gleason
8, T3a, Enzalutamida mCSPC, datas, médica) e validação por API → **vigente**.

> **Sobre a produção (Vercel).** A extração é a primeira rota que espera dezenas de
> segundos por um terceiro. `backend/vercel.json` ganhou `maxDuration: 60` no builder —
> no plano Hobby o teto é 60 s; se a chamada passar disso o cliente vê erro e nada é
> gravado (o resultado só existe quando volta). Conferir o plano antes do deploy.

## Portão dos DRIVERS DE PULMÃO (`scripts/portao-drivers-pulmao.js`)

Decisão do revisor de 16/09/2026 (EGFR/ALK/ROS1 por marcador, três estados, "não testado"
nunca libera verde; adendo: escamoso só PD-L1). O que o portão prova, em browser isolado e
por API, **somente leitura** (nenhum POST sai do simulador; nada é criado no banco):

- **D1 vocabulário**: `pulmao-nsclc` expõe `histologia`, `egfr_status`, `alk_status`,
  `ros1_status` (com `rotulos` e `indeterminado` vindos do dado, inclusive em
  `/importacao/vocabulario`) e não expõe mais nenhum dos 7 aposentados.
- **D2 default**: o simulador nasce `nao_escamoso` + drivers `nao_testado` → KEYNOTE-024 em
  🟡 com "faltam: EGFR, ALK, ROS1" no painel de calculados. Verde por presunção é FALHA.
- **D3/D4 tabela de verdade clicada**: escamoso → 024 🟢 sem drivers, 407 🟢, 189 🔴;
  não-escamoso três negativos → 024/189 🟢, FLAURA 🔴; EGFR sensibilizante → 024 🔴,
  FLAURA 🟢; ALK rearranjado com o resto não testado → 024 🔴 (positivo vence o
  indeterminado); PACIFIC inline (escamoso ∨ EGFR negativo).
- **D5 tela**: rótulos do dado ("Não testado", "Escamoso (CEC)"), nenhum rótulo cru de
  campo aposentado, linha "Sem driver acionável (ou histologia escamosa)" nos calculados.
- **D6 corpus/fila**: 301 regimes; `nsclc-met-io-qt-pdl1baixo-escamoso` (KEYNOTE-407) existe
  e o 189 manteve o id; os 14 ajustados carregam aprovação de 14/09 num hash que não é mais o
  atual e não têm decisão no hash novo (DEV: pendente; PROD: aguardando re-revisão); 407 pendente.
- **D7 paridade**: app × `semaforo.ts` compilado dão o mesmo veredito em 30 combinações.

Roda 2×. Em produção (`PORTAO_API=https://oncoguia-backend.vercel.app/api`) só depois de
publicado; D6 então tem de mostrar os 14 em *Aguardando re-revisão*. Se o `semaforo.ts` ou o
`evalExpr` da app mudarem, é este portão (D7) que acusa a dessincronia — junto com o da importação.

## Justificativa do solicitante (2026-09-17, Rodada C) — checks `U4`/`U6`/`A3`/`A7`/`B5`/`E0`/`E1` do `portao-autorizacao`

Pedido da direção: ao pedir um protocolo **Inelegível** ou **Não incorporado**, o
oncologista escreve uma **justificativa obrigatória**; o auditor a lê ao decidir; a
trilha registra **as duas pontas** (justificativa + parecer). Até aqui o Inelegível era um
`confirm()` sem texto e o Não incorporado um `prompt()` cujo texto ia **embutido** em
`detalhe_semaforo.ressalva` ("… — justificativa: <texto>").

- **Coluna própria:** `avaliacoes.justificativa_solicitante` (migration
  `JustificativaSolicitante1790121600000`, com **backfill** do legado pelo marcador
  `justificativa: ` da ressalva — a ressalva não é alterada). A ressalva passa a guardar
  só o **contexto** montado pela app ("Selecionado apesar de Inelegível — critérios: …" /
  "apesar de NÃO incorporado (motivo)").
- **Obrigatória NO SERVIDOR, depois de o servidor decidir que é exceção**
  (`PacientesService.criarAvaliacao`): exceção sem texto (ausente ou em branco) = **400**
  nomeando a justificativa, **nada criado** — nos dois eixos e também quando o cliente
  mente `nao_necessaria` para um não incorporado (a mentira não vira vigente **nem**
  pendente sem texto). Seleção normal ignora o campo (coluna `null`).
- **Um diálogo só** na app (`pedirJustificativaExcecao`, overlay `#exc-modal`) para os
  dois eixos: mostra **por que** é exceção (critérios que falharam / motivo da não
  incorporação + nota do revisor), avisa que só vira vigente com o auditor, e pede a
  justificativa numa textarea. Confirmar vazio **não envia** (aviso inline, diálogo
  aberto, 0 avaliações); digitar é **0 re-render** (o overlay vive fora do `render()`);
  Escape/Cancelar = nada gravado. Os dois pontos de seleção (ficha ao vivo e reavaliação)
  passam por ele.
- **Onde aparece:** fila do auditor — seção **"Justificativa do solicitante"** (do
  payload `justificativa`; para o legado a app extrai da ressalva; sem nada, diz
  "solicitação anterior a 17/09/2026") + linha "Contexto da seleção" com a ressalva;
  seguimento (bloco "Solicitações de exceção"), card do vigente, item da seleção na trilha
  e **item da decisão** na trilha (que traz justificativa **e** parecer, para ler as duas
  pontas juntas — `retornos.service` trilha, `justificativa_solicitante` nos dois itens).
- **Portões que criam exceção por API mandam o campo** (`portao-autorizacao`,
  `portao-perfis` K2, `portao-retorno` L9) — sem ele, 400.

## Decisão de papel — o auditor decide MÉRITO, não custo

**Regra permanente: a tela de Autorizações não mostra dinheiro para NINGUÉM — nem para o
admin. Informação financeira (carteira, estimativa, preço, projeção) é de gestor e admin, e
só na aba Recursos.** Nenhuma feature futura reintroduz custo no fluxo de autorização por
parecer útil ali.

O que mudou, em 2026-09-07: o painel "Custo total da carteira — ESTIMATIVA" no topo da fila
e o bloco "Expectativa de uso e custo" dentro de cada cartão foram removidos, e a whitelist
de **toda leitura** de `/custos` passou de `['auditor','admin']` para `['gestor','admin']`.
O auditor leva **403** batendo direto na URL.

Por que, já que o número era correto e a pergunta "quanto custa" parecia natural naquela
tela: **quem autoriza uma exceção decide mérito** — a evidência sustenta este protocolo para
este paciente? O preço não é insumo dessa pergunta. Um número à vista no momento da decisão
convida a resposta certa pelo motivo errado, e **o convite não deixa rastro no parecer**: o
parecer registra o que o auditor escreveu, nunca o que ele estava olhando. Um viés que não
aparece na trilha não pode ser auditado depois — e este módulo inteiro existe para que a
decisão seja auditável.

Três coisas que fazem a regra ficar de pé:

1. **A asserção é sobre a TELA, não sobre o perfil.** Os portões rodam o mesmo check para
   auditor **e para admin**. Se valesse só para o auditor, "o admin é quem manda, deixa o
   número para ele" passaria — e é essa a regressão provável, porque o admin é o único
   perfil que pode ler `/custos` e abrir Autorizações ao mesmo tempo.
2. **A UI é cortesia; o controle é o guard.** Esconder o bloco não protege nada sozinho —
   `CustosController` e `RecursosController` compartilham a mesma whitelist literal
   (`GestorOuAdminGuard`), e os portões batem nas rotas direto, sem passar pela tela.
3. **A remoção tem contraprova.** Todo check de ausência vem em par com um de presença: o
   auditor continua com fila, parecer e botões (`/autorizacoes` inalterado, 200); e a aba
   Recursos do admin continua cheia de `R$`. Sem o par, "apagaram a camada de dinheiro do
   produto" também passaria verde.

**Os checks antigos foram INVERTIDOS, não apagados** — `C2 auditor LÊ custo (200)` virou
`C2 ★ auditor NÃO lê custo (403)`, e `G1 auditor CONTINUA vendo custo` virou
`G1 ★ auditor NÃO vê custo em lugar nenhum`. Mesmo endereço, exigência de sinal oposto: quem
reintroduzir custo no caminho do auditor tem de derrubar um check que diz o motivo, em vez
de escrever num vazio.

**Uma coisa que continua na tela e não é dinheiro:** o selo `Custo 4/5` (NCCN Affordability)
no cartão de evidência. É eixo de evidência publicada, na mesma linha de GRADE e ESMO-MCBS,
e é exatamente o tipo de coisa que o auditor deve ler para decidir mérito. Não é preço, não
tem `R$` e não vem do cadastro do hospital.

**Efeito colateral que precisou de decisão própria:** `/custos/carteira` lista pacientes
**com nome**, e a rota passou a ser do gestor — o único perfil que nunca vê paciente. A
resposta dele sai pseudonimizada, no mesmo desenho de `/recursos/projecao`: a coluna `nome`
**nem é selecionada** do banco para esse perfil. Trocar a whitelist sem isso teria entregado
nome de paciente ao perfil desenhado para não ter nenhum — a lição é que **mudança de
whitelist é mudança de superfície de dado**, e a pergunta "o que mais vem junto nessa
resposta?" faz parte da mudança.

---

## Lição — portão mede correção, uso real mede produto

O portão de recursos ficou verde nos 91 checks enquanto a tela mostrava, em duas das três
abas de dinheiro, um estado vazio o dia inteiro. Não havia bug: o cálculo por insumo exige
que a composição do esquema feche em **mg por aplicação**, e isso acontece em **8 de 295**
protocolos. Os números estavam certos; o que estava errado era dar a eles uma aba de
primeiro nível.

**Placar de cobertura baixo pede UI que recolhe, não UI que exibe o vazio.** As três abas
viraram uma: projeção da carteira em cima, preços por protocolo (o caminho principal)
abaixo, e o custo por insumo numa seção **fechada** cujo cabeçalho imprime a cobertura
real. Nada de backend, tabela, endpoint ou extração mudou — a mudança foi inteira de
apresentação, e os endereços antigos (`go('custos')`, `go('insumos')`) continuam vivos,
caindo na aba única em vez de virarem link morto.

Duas regras que saem daí, e valem para o próximo módulo:

1. **Antes de promover um caminho a aba, olhe o placar de cobertura dele.** Um caminho que
   alcança uma fatia pequena do corpus é uma seção recolhida com o número no cabeçalho, não
   uma aba. E o número tem de estar visível **com a seção fechada** — "recolhido" só é
   honesto se disser o tamanho do que recolheu. Critério de re-expansão: a seção avançada
   volta a ter destaque quando composição completa + preço de insumo real cobrirem parcela
   relevante da carteira (o número se define na época, contra a carteira de então — não
   contra o corpus inteiro).
2. **Dobrar UI é mexer no que o portão mede.** Os checks migram de endereço, nunca de
   exigência: seletor novo, mesma prova. E seção fechada é a chance óbvia de um check
   passar por ausência — por isso o portão abre a seção antes de verificar, e checa
   explicitamente que ela nasceu fechada.

Um efeito colateral que só a **segunda execução** do portão pegou: com o cadastro de preço
e a projeção na mesma tela, a tela passou a carregar em ondas, e a onda que chegava
disparava um `render()` **por cima de um campo de preço em digitação** — perdeu um dígito
("Contrato teste 202"). A correção foi carregar tudo numa espera só e pintar a tela **uma
vez, completa**. A regra "rode duas vezes seguidas" existe para resíduo de banco; ela
também pega corrida de carregamento.

---

## Portão C — CLÍNICO (delegado, você NÃO verifica)

9. O mérito clínico — a nota MCBS está certa? um "avaliação própria" esconde uma divergência real? um regime devia ser refutado? — é do **oncologista de referência na Revisão**. Não é seu para carimbar. É o "informa, médico decide" por design.

---

**Regra final:** A, B e C cada um é um portão independente. Um agente é confiável na medida em que a saída dele **sobrevive a um check que não passa por ele** — e a camada clínica é assinada por um humano. Nenhum agente é load-bearing na sua confiança.

**Mudança de corpus (quando o squad processar as decisões do revisor):** trocar o `RUN_ATIVO` muda o que o revisor vê. Faça isso **deliberadamente** (não no meio de uma sessão de revisão), rode o Portão A no run novo **antes** de apontar o `RUN_ATIVO` pra ele, e só então publique.

---

*Automação (adendo 3) — módulo Autorização/exceção:* `node scripts/portao-autorizacao.js` roda o portão da solicitação de exceção (mesmas portas). 53 checks. Os dois marcados **★** são o coração: um `POST /pacientes/:id/avaliacoes` **direto**, sem `autorizacao_estado`, de um protocolo **não incorporado** tem de nascer `pendente` — o servidor relê o corpus e não acredita no cliente. Cobre ainda: pendente/negada nunca viram protocolo vigente, decisão única e imutável (409 na segunda), parecer obrigatório nas duas decisões, **0 re-render** ao digitar o parecer, e a matriz de perfil inteira (o `auditor` é eixo próprio: 403 em avaliação, Revisão, export e usuários — e, desde 2026-09-07, **403 em `/custos` e `/recursos` também**: ele decide mérito sem ver dinheiro). Desde 2026-09-07 cobre ainda a **tela sem dinheiro** (checks `D1`/`D2`): a aba Autorizações não contém `R$` nem `ESTIMATIVA`, no texto **e** no DOM, para **auditor E admin** — a asserção é sobre a tela, não sobre o perfil, porque o admin é o único que poderia ver o número sem nenhum guard reclamar. Cada check de ausência vem em par com um de presença (fila, parecer e botões intactos; aba Recursos do admin ainda com `R$`), para que apagar a camada de dinheiro do produto não passe verde. Desde 2026-09-03 cobre também a **decisão com a visão do paciente aberta** (fase B, os dois ★ novos): o auditor abre a ficha — detalhe e trilha em cache — e só então nega. Foi o caminho que escapou quando o `AVAL_HIST` órfão (sobra do rename Histórico→Trilha) estourava **depois** do POST e alertava "Falha ao registrar a decisão" para uma decisão já gravada. Junto veio o conserto da espera do A5: ela era `(AUT_LISTA || []).every(...)`, e a decisão zera `AUT_LISTA` **antes** de recarregar a fila — com a lista em `null` a checagem passava **vazia**. Agora exige `Array.isArray`, isto é, exige que o refresh tenha completado. Apaga o paciente de teste no fim.

*Automação (adendo 4) — módulo Expectativa de custo:* `node scripts/portao-custo.js` roda o portão do custo global (mesmas portas). **50 checks.** O coração são dois. **(1) A matriz de perfil nas DUAS pontas, por API direta:** oncologista e revisor levam **403 em todas as 6 rotas de leitura** de `/custos` e no `PUT` de preço — a app esconder o bloco é cortesia, o controle é o guard; e o **gestor** lê mas não cadastra (403 só no PUT), porque leitura e escrita são whitelists diferentes (`['gestor','admin']` vs `['admin']`). O **auditor saiu da leitura** em 2026-09-07 — ver *Decisão de papel* acima; o check que dizia `auditor LÊ custo (200)` foi **invertido** para `403`, não removido, e a Fase 5 inteira (que provava "o auditor vê o bloco e a carteira na fila") hoje prova o oposto no mesmo endereço. **(2) A aritmética conferida contra o JSON de origem:** o portão recalcula ciclos e faixa a partir de `backend/data/evidencia.json` **com cópia própria da regra de periodicidade** — portão que importa a função sob teste não testa nada — e compara com o que o servidor respondeu, incluindo a **soma da carteira** (total = soma das linhas, e cada linha = ciclos × preço). Para isso o portão **cria o próprio paciente e a avaliação**: na primeira execução o check passou com `no_calculo=0`, isto é, verde sem somar nada, porque nenhum paciente da base tinha protocolo estimável. Cobre ainda: **indeterminado vira "sem estimativa" com motivo — nunca R$ 0** nem campo vazio (e nada de `R$ 0,00` renderizado na tela), periodicidade não derivável do esquema **não é chutada**, preço negociado acima da tabela é **recusado** (faixa invertida), preço **sem fonte** é recusado, preço para regime fora do corpus é recusado, o bloco **ausente do DOM do oncologista** inclusive entrando por `go('custos')`, e **0 re-render ao digitar nos campos de preço**. Restaura os preços anteriores e apaga o paciente de teste no fim.

*Automação (adendo 6) — SIMULADOR (leitura pura, agora também do oncologista):* `node scripts/portao-simulador.js` roda o portão do Simulador (mesmas portas). **47 checks.** Ele **não cria nem apaga nada** — e isso é parte do teste: se um dia precisar de limpeza, a invariante quebrou. O coração são três. **(1) A invariante de somente-leitura provada por REDE, não por leitura de código:** o portão escuta `page.on('request')` e exige **zero** `POST`/`PUT`/`PATCH`/`DELETE` enquanto o Simulador está aberto — para oncologista, revisor e admin. A janela de observação começa **depois do login** (o próprio `POST /auth/login` é uma escrita, e acontece antes de o Simulador existir), e o filtro é por método, nunca por rota: escrita nova para qualquer endereço aparece. Em par com ela, o check de que **nenhum botão `.sel-btn` existe** no sandbox. **(2) A matriz nas DUAS pontas:** na tela, o oncologista **vê** o Simulador e segue **sem** Revisão, Autorizações, Recursos e Admin — inclusive forçando `view` por código; na API, o token dele dá **200** nas três rotas que alimentam a tela (`/evidencia`, `/revisoes/resumo`, `/revisoes/fontes`) e **403** nas oito que não são dele, mais o `POST /revisoes`. As duas pontas importam em direções opostas aqui: a aba nova sem os 200 seria uma tela vazia (falha silenciosa), e os 200 sem os 403 seriam uma porta aberta. **(3) Contraprovas de presença**, para que apagar coisa não passe verde: revisor e admin continuam vendo e abrindo o Simulador; a aba **Recursos do admin ainda mostra `R$`**; e o **gestor não vê** o Simulador (tela e `view` forçada caindo em `recursos`) — se ele passasse a ver, a whitelist teria virado "qualquer autenticado", que é a regressão que este portão persegue.

Cobre ainda a **tela sem dinheiro** (checks `S6`), para oncologista **E** admin — a asserção é sobre a TELA, não sobre o perfil. E aqui mora a parte que vale ler antes de mexer: **três palavras ficaram DELIBERADAMENTE fora do padrão de busca**, porque o corpus de evidência fala de economia por motivos legítimos, e um check que dispara nisso convida a apagar **evidência** para ficar verde.

- **"custo" sozinho** — o card traz `Custo N/5`, o eixo **NCCN Affordability** do corpus (acessibilidade da evidência, escala 1–5). Já está na tela do paciente desde sempre. O portão procura `custo por ciclo`, que é vocabulário da aba Recursos. **DECISÃO REGISTRADA (2026-09-07): o `Custo N/5` fica nos DOIS lugares — Simulador e tela do paciente.** É eixo de **evidência publicada**, não dinheiro do hospital, e a distinção é o ponto: a camada financeira (`R$`, ciclo, faturamento, margem) vive só em Recursos, atrás do `GestorOuAdminGuard`. **Não reabrir** — quem for propor a remoção está propondo tirar um eixo da evidência da tela do médico, e isso é decisão clínica, não de layout.
- **"margem"** — *margem cirúrgica* é termo clínico. Margem **financeira** só existe em Recursos, atrás do `GestorOuAdminGuard`.
- **"preço"** — a **justificativa** do eixo NCCN Affordability cita economia da literatura quando é isso que explica a **não incorporação**. Exemplo real no corpus (`mama-met-hrpos-2l-capivasertibe-nao-incorporado`): *"a justificativa do protocolo é explicitamente econômica — 'ao preço atual, a adição de capivasertibe ao fulvestranto não é custo-efetiva como 2ª linha'"*. Isso é a **razão** de o protocolo estar em "Avaliados — não incorporados": reprovar aqui seria pedir para apagar a transparência. (E `precoce` casa em `pre[çc]o` sem `\b` — *progressão precoce* chegou a reprovar a tela numa versão do portão.)

O que sobra é a sentinela que de fato pega a regressão: a camada de dinheiro do hospital renderiza por `fmtBRL()`, que **sempre** produz `R$` — então `R$` no texto, `ESTIMATIVA` em caixa alta (o banner, mesma convenção dos `D1` de `portao-autorizacao`), `faturamento`/`reais`/`custo por ciclo`, e as **classes no DOM** (`.cst`, `.cst-cart`, `.cst-slot`, `[data-cst-rid]`) — estas últimas porque um bloco em "⏳ calculando…" não tem `R$` e passaria no teste de texto. O portão **abre todos os `<details>`** antes de ler: `innerText` não enxerga o que está recolhido, e o apêndice fechado esconderia um bloco de custo.

*Automação (adendo 5) — PERFIS MÚLTIPLOS (troca de chapéu):* `node scripts/portao-perfis.js` roda o portão dos perfis múltiplos (mesmas portas). **52 checks.** Ele **cria e apaga a própria conta de teste** — não há variável nova no `.env.local`, e não deveria haver: o que está sob teste é a *atribuição* de perfis, então a conta precisa nascer dentro do portão, com dois chapéus (`[oncologista, auditor]`), pela tela de acessos do admin. Faz **3 logins** (admin na tela, a conta criada na tela, o auditor por API); todos os demais tokens saem de `POST /auth/trocar-perfil`, que **não é login** e não consome a janela de 5/min.

O desenho que ele guarda, em quatro frases:

- **O token carrega UM perfil ativo.** A pessoa tem uma LISTA (`usuarios.perfis`), mas veste um por vez. O perfil ativo padrão é `usuarios.perfil`, e um CHECK do banco (`CHK_usuarios_perfis`) garante que ele é sempre membro da lista — coerência é invariante do banco, não disciplina do service.
- **Trocar = token novo, validado contra a lista.** `POST /auth/trocar-perfil` relê a lista **do banco** e recusa com 403 o que não estiver nela, inclusive com JWT válido batendo direto na URL. E o `JwtStrategy` reconfere o perfil do token **a cada requisição**: admin que retira um perfil corta o acesso **na hora**, sem esperar as 8h do token expirar.
- **A matriz de perfil continua sendo POR PERFIL ATIVO, nunca por lista.** Nada afrouxa porque a pessoa "tem" o outro chapéu — vale o que ela está vestindo. Os checks `P5`/`P6` são a prova viva disso: **a mesma pessoa**, dois tokens, `GET /autorizacoes` dá 403 num e 200 no outro. Se algum guard passasse a olhar a lista (a tentação óbvia: "ele é auditor, deixa passar"), esses dois checks viram 200 e o portão pega na hora.
- **Ninguém decide a própria solicitação.** A pergunta que o guard **não** faz é sobre PESSOA, não sobre perfil — e é exatamente a que os perfis múltiplos abrem: pedir a exceção com um chapéu e, trocando, chegar à própria fila com permissão legítima. `AutorizacoesService.decidir` recusa quando `auditor_id == avaliado_por`, **qualquer que seja o perfil ativo** (admin incluído: quem tem mais poder não tem menos conflito).

Cobre ainda: **um perfil só = badge estático** (o seletor aparecendo para quem não tem escolha é promessa vazia na tela) e **dois ou mais = seletor**; a troca **re-renderiza com as abas certas** nos dois sentidos (Autorizações entra e sai); trocar com **formulário aberto pede confirmação que NOMEIA o que se perde** ("um cadastro de paciente em preenchimento"), cancelar não troca nada **e preserva o texto digitado**, e — a outra metade da mesma regra — **sem rascunho aberto a troca não pergunta nada** (aviso que aparece sempre é aviso que se aprende a clicar sem ler); a **trava anti-lockout** (o admin não retira o próprio `admin`); e o **perfil ativo carimbado no registro** — o pedido guarda o chapéu com que foi FEITO (`avaliacoes.perfil_ativo`), não o que a pessoa tem hoje.

> **A espera que lia o render anterior.** A primeira versão deste portão acusou "Autorizações não entrou" e, na troca seguinte, "Autorizações não saiu" — o sintoma clássico de estar **sempre um render atrasado**. A causa não era a app: a espera era `USUARIO.perfil === 'auditor'`, e `USUARIO` é atribuído **antes** do `await carregarSessao()` (carteira, selo da fila) que precede o `render()`. O portão lia o DOM do chapéu anterior. Agora espera `USUARIO.perfil === p && !TROCANDO_PERFIL` — a flag volta a `false` na mesma linha síncrona do render, então é ela o sinal de "acabou". Mesma família do check que passava vazio: **esperar pelo dado não é esperar pela tela**, e num portão de UI é a tela que está sob teste.

> **Veredito refém do `browser.close()`.** Numa execução o portão imprimiu os 52 PASS e **pendurou** no `await browser.close()` — sem veredito, o que para quem lê é indistinguível de um portão que quebrou no meio. O `close()` agora corre contra um prazo de 8s (`Promise.race`); o `process.exit` leva o Chrome junto de qualquer forma. O que não pode é o encerramento do browser decidir se o resultado aparece.

*Adendo 4.1 — orais contínuos e desacoplamento uso/custo:* o portão passou para **72 checks**. Novos: **oral sem `periodo_dias`** não converte tempo em aplicações e não mostra R$ nenhum **mesmo com preço cadastrado** (o esquema do osimertinibe não tem intervalo de ciclo, e inventar um erraria o custo por um fator de 3); **com `periodo_dias`** a aritmética confere contra o recálculo independente (20,7 meses × 30,4 ÷ 30 = 21 períodos) e a origem sai marcada como `periodo_declarado`, não como esquema; `periodo_dias` **0 ou 400 é recusado**; regime com **tempo derivável e sem preço** mostra a metade de USO e **nenhum R$** — na API e na tela; e digitar no campo de período tem **0 re-render**, igual aos de preço.

> **Lição do endpoint que ficou lento e virou falha de portão:** `/custos/cobertura` fazia um `findOne` de preço **por regime** — 295 idas ao Neon numa chamada só, **13,8s** de resposta. O portão esperava por `CUSTO_ADM !== null`, que é preenchida pela **primeira** das duas chamadas, e ia procurar o campo na tela 13 segundos antes de a tela existir: `waitForSelector` estourava e o portão acusava um bug de UI que não existia. Consertos, nesta ordem: a consulta virou **um** `find()` com mapa em memória (13,8s → **0,3s**), e a espera do portão passou a ser pelo **elemento da lista**, não pela variável. Espera por variável de estado é espera por meia verdade quando o carregamento tem mais de um passo.

> **Cuidado ao checar ausência de bloco na UI:** o `<script>` da app mora **dentro do `<body>`**, então `document.body.textContent` devolve o **código-fonte** junto com a tela — procurar a string `'Expectativa de custo'` ali dá falso-positivo, porque ela existe dentro de uma função. O portão conta **elementos** (`document.querySelectorAll('.cst')`), não texto.

> **Lição do bloco assíncrono que quebrou o vizinho:** a primeira versão do bloco de custo buscava a estimativa e chamava `render()` quando ela chegava. Isso passou no portão de custo e **quebrou o `portao-autorizacao` (50/53)**: o render global caía por cima do auditor enquanto ele digitava o parecer — `renders=2`, texto truncado em "TESTE PORTAO". Qualquer coisa que chegue **assíncrona** nesta app repinta o **próprio slot**, nunca a tela inteira. (O bloco de custo em si não existe mais — saiu da aba Autorizações em 2026-09-07 —, mas a lição não era sobre custo: era sobre chegada assíncrona repintando por cima de quem digita, e vale para o próximo bloco que alguém puser numa tela com formulário aberto.) É a mesma regra do "0 re-render" dos formulários, aplicada à chegada de dado em vez de à digitação — e o motivo de rodar **todos** os portões antes do commit, não só o do módulo que se mexeu.

> **Rodando os portões em sequência:** `POST /auth/login` é limitado a **5 por minuto por IP** (`@Throttle` no AuthController) e o teto global é 60 req/min. Como cada portão agora loga uma vez **por perfil**, encadeá-los estoura a janela. Os scripts tratam isso: `tokenApi()` e `loginNaTela()` (em `scripts/portao-credenciais.js`) **esperam e tentam de novo** no 429, imprimindo `… rate limit no login <perfil>: aguardando Ns`. Um 429 não vira mais FAIL falso — só demora. Qualquer outro status continua sendo erro na hora. Não fique dando `curl` no login para "testar se liberou": cada tentativa reenche a janela.

### Contas de teste dos portões

Os portões automatizados **logam de verdade** — é o ponto deles. As credenciais vêm do
ambiente, **nunca do código**: até 2026-09-03 os scripts traziam `oncologista`/`onco123`
escrito no arquivo, o que é senha versionada num banco que guarda cadastro de gente real,
e além disso amarrava o portão às contas de *seed*, já desativadas no banco vivo — portão
que não roda não protege nada.

**Como está agora.** Uma conta de teste por perfil, com senha forte, e as credenciais em
`.env.local` na raiz (coberto pela regra `.env.*` do `.gitignore`). O modelo versionado é
`.env.example`. Quem lê é `scripts/portao-credenciais.js`, que aborta com instrução se
faltar par de variáveis — em vez de virar um FAIL confuso lá na frente.

| Perfil | Login | Variáveis | Para quê |
|---|---|---|---|
| oncologista | `portao.oncologista` | `PORTAO_LOGIN` / `PORTAO_SENHA` | escreve avaliação, retorno e agenda |
| revisor | `portao.revisor` | `PORTAO_LOGIN_REVISOR` / `PORTAO_SENHA_REVISOR` | Revisão clínica e os 403 da whitelist |
| auditor | `portao.auditor` | `PORTAO_LOGIN_AUDITOR` / `PORTAO_SENHA_AUDITOR` | decide solicitação de exceção |
| admin | `portao.admin` | `PORTAO_LOGIN_ADMIN` / `PORTAO_SENHA_ADMIN` | `/revisao/export` e a limpeza no fim |
| gestor | `portao.gestor` | `PORTAO_LOGIN_GESTOR` / `PORTAO_SENHA_GESTOR` | recursos: projeção, margem e a prova da pseudonimização |
| secretaria | *(descartável)* | — | criada pela tela de admin no próprio `portao-secretaria` e apagada no fim, como a conta do `portao-perfis` — testa a atribuição do perfil, então nasce ali |

**Criar ou recriar as contas** (tudo pela tela, sem script e sem tocar no banco):
1. Entre como administrador em **Admin › Gerenciar acessos**.
2. **Novo usuário** → nome `Portao Automatizado (<perfil>)`, login da tabela acima, perfil
   correspondente. A app devolve uma **senha temporária**.
3. **Editar** o usuário recém-criado e trocar por uma senha longa e aleatória (24+ caracteres
   — gere, não invente: `openssl rand -base64 24`).
4. Ponha login e senha no `.env.local`, no par de variáveis daquele perfil.

As contas ficam **ativas** — a senha não é pública e vive só no `.env.local` de quem roda o
portão. Elas aparecem na lista de usuários com o nome `Portao Automatizado`, de propósito:
conta de robô tem de ser reconhecível à primeira vista numa auditoria de acessos.

**O que mudou junto.**
- Os três portões deixaram de assinar JWT de admin com o `JWT_SECRET` e `sub: 1` fixo para
  fazer a limpeza. Agora fazem **login de verdade** com a conta de teste admin: não dependem
  do segredo do servidor, não presumem que o usuário 1 existe, e exercitam o mesmo caminho
  que uma pessoa percorre.
- Sumiram também os **nomes** de conta de seed de dentro dos checks. `R13` (solicitante na
  guia) e `B5.4` (parecer atribuído) comparavam com `'Dr. Oncologista de Teste'` e
  `/Revisora/`; agora comparam com `USUARIO.nome` da sessão. Um check que só passa com a
  conta certa não está verificando atribuição — está verificando o seed.
- Os portões pedem **perfil**, nunca login literal: `token('revisor')`, `ctxLogin(browser,
  'auditor')`. Trocar a conta de teste é mexer no `.env.local`, não no código.
- **O login pela tela voltou a enxergar o erro.** `loginNaTela` esperava por `.login-err`,
  mas a tela de login mostra o erro em `.auth-err` (`.login-err` é o estilo das outras
  telas) — a espera do rate limit (`POST /auth/login` é 5/min por IP) nunca casava, e dois
  portões seguidos falhavam com um `+ Novo paciente` que "não apareceu", que não diz nada
  sobre a causa. O seletor agora cobre as duas classes, e o erro da tentativa anterior é
  **removido antes de submeter** a próxima: sem isso a espera lia o 429 velho e dormia mais
  60s enquanto a app, já logada, tinha trocado de tela por baixo dela. Portão que falha
  pelo motivo errado ensina a ignorar portão.

**Estado em 2026-09-16 (entregas 1+2 EM PRODUÇÃO — commits `e1189bb` + `74b9090`):**
`portao-extracao` 36/36 ×3 (extração real; a 3ª após o conserto das ligaduras) ·
`portao-importacao` 72/72 · `secretaria` 93/93 · `b` ✓. Deploy: backend (migration
`ImportacaoPropostas` aplicada no boot — provado pela API: `GET /pacientes/80/importacao-proposta`
= `{proposta:null}`) e app (`impLerPdf` no ar). Smoke em produção com a demo sintética:
extração 201 em 17,9 s / 19,0 s (teto 60 s), 11 campos, 0 descartes, paciente demo #81
criado, proposta #1 validada → Enzalutamida mCSPC vigente, retorno 08/10/2026. Env de
produção: `ANTHROPIC_API_KEY` e `IMPORTACAO_MODELO` presentes (`vercel env ls`).

**Estado em 2026-09-16 (importação, entrega 1 — DEV, sem deploy):** máquina acordada
(`caffeinate -d -i -s`, tampa aberta) · `portao-importacao` **72/72 e 72/72** em rodadas
seguidas (3 min cada; sem `AVISO` de resíduo na segunda = a limpeza da primeira devolveu o
banco) · `portao-retorno` 86/86 · `portao-custo` 98/98 · `portao-recursos` 99/99 ·
`portao-secretaria` 93/93 · `portao-b` 89 e `autorizacao` 69/69, `perfis` 52/52,
`simulador` 50/50 na véspera. Zero `ERROR` novo no log do backend durante a rodada — os
vermelhos da noite anterior eram todos sleep/wake (ver lição acima).

**Estado em 2026-09-15 (publicação do lote 3):** RUN_ATIVO → `2026-09-15-intake-revisao-3/v1`
(300 regimes). Portão A no ativo exit 0 (46/46 DOIs de confirmado resolvem no Crossref) ·
`portao-b` 89 (tudo passou) · fluxos do README-lote3 clicados (4 regimes novos de HT isolada
no simulador e na ficha; ASCENT diverge; nota do revisor no card). Migrations `AplicadaEmLote2`
(blocos A+B, 27) e `AplicadaEmLote3` (9) instaladas; sobre o export de produção alcançam
27/27 e 9/9, sobrando só o dostarlimabe (triagem manual) — o intake do lote 3 fecha quando
o deploy carimbar isso em produção.

**Estado em 2026-09-14 (perfil secretaria):** `portao-secretaria` 93/93 (duas execuções
seguidas, lista de checks idêntica) · `portao-perfis` 52/52 · `portao-retorno` 86/86 ·
`portao-b` tudo passou (89) · `portao-recursos` 99/99 · `portao-autorizacao` 69/69 ·
`portao-custo` 98/98 · `portao-simulador` 50/50 — todos contra o backend com a migration
`PerfilSecretaria` aplicada (revertida e reaplicada no dev depois da correção dos dois CHECKs).

**Estado em 2026-09-07:** `portao-perfis` 52/52 (duas execuções seguidas, lista de checks
idêntica) · `portao-retorno` 86/86 · `portao-autorizacao` 67/67 ·
`portao-custo` 98/98 · `portao-recursos` 99/99 (duas execuções seguidas, lista de checks
idêntica) ·
`portao-b` tudo passou. Portão A (dados) verde com `--check-dois`, incluindo os checks
**[9] expectativa_uso** (295/295, 67% indeterminado) e **[10] composicao** (295/295,
90% indeterminado).

> **O portão de retorno estava falhando pelo relógio.** `L5` e `L6` caíam entre 21h e a
> meia-noite (horário de Brasília) porque um `page.evaluate` mandava
> `data_realizada: new Date().toISOString().slice(0,10)` — **UTC** — enquanto o resto do
> portão e o backend (`hojeISO`) usam o dia **local**. Nessa janela o retorno nascia com
> a data de amanhã: `L6` esperava a agenda 3 meses à frente de hoje e via a de amanhã, e
> `L5` via esse retorno como mais recente que o do admin gravado depois. O dia agora vem
> do Node como argumento. Nenhuma das duas falhas era do código sob teste — e é
> exatamente por isso que precisava de conserto: portão que falha pelo motivo errado
> ensina a ignorar portão.

> **Lição do vazamento do `GET /pacientes` (2026-09-04):** ao testar a matriz do perfil
> **gestor** por API direta, `GET /pacientes` e `GET /revisoes/resumo` devolveram **200**
> — com nome, carteirinha e tumor de todos os pacientes — para o perfil que por desenho
> não vê nada clínico. Os controllers diziam *"leitura = qualquer autenticado"*, e isso
> era verdade: enquanto todo perfil autenticado fosse clínico.
>
> **A regra que fica: whitelist explícita SEMPRE, leitura incluída.** "Qualquer
> autenticado" é uma promessa sobre os perfis de **hoje**, e o próximo perfil a nascer a
> quebra em silêncio — sem erro, sem log, sem ninguém perceber. A correção não foi listar
> quem NÃO pode (blacklist envelhece do mesmo jeito: o perfil seguinte nasceria vendo
> tudo de novo) — foi `LeituraClinicaGuard`, a lista literal de quem pode.
>
> **É a terceira ocorrência da mesma família**, e por isso vira regra e não anedota:
> 1. **perfis hierárquicos** — `RolesGuard` derivava permissão da posição na escada, e o
>    revisor passava em rota de oncologista. Resolvido com guards de whitelist por eixo
>    (`OncologistaOuAdminGuard`, `RevisorOuAdminGuard`, `AuditorOuAdminGuard`).
> 2. **não incorporado via POST direto** — a app escondia o caminho, mas o servidor
>    aceitava `autorizacao_estado` vindo do cliente: o protocolo nascia vigente sem
>    passar pelo auditor. Resolvido decidindo o estado **no servidor**.
> 3. **leitura clínica para o gestor** — este.
>
> As três têm a mesma forma: *a permissão estava implícita em alguma outra coisa* (a
> posição na hierarquia, a tela, o conjunto de perfis existentes) em vez de escrita.
>
> **Check permanente:** todo endpoint novo entra na matriz de perfil do portão com as
> **DUAS pontas** testadas — **API direta** e **tela** —, e a matriz inclui
> obrigatoriamente os perfis que **NÃO** devem acessar. Testar só quem pode prova que a
> funcionalidade existe, não que ela está protegida; e testar só na tela prova que o
> botão sumiu, não que a rota recusa. O `portao-recursos` faz as duas direções: o gestor
> leva 403 em 10 rotas clínicas, e oncologista/revisor/auditor levam 403 em todas as de
> `/recursos` **e de `/custos`** — mais o teste **afirmativo** de que o nome do paciente não
> aparece na resposta, na tela nem dentro do `.xlsx`.
>
> **Corolário (2026-09-07) — a matriz é por PERFIL ATIVO, nunca por lista.** Desde os
> perfis múltiplos uma pessoa pode ter vários chapéus, e a tentação é o guard perguntar
> "algum dos perfis dela serve?". Não: ele pergunta **qual está vestido**, como sempre
> perguntou — o token carrega um perfil só, e é ele que a matriz testa. O `portao-perfis`
> guarda isso com a mesma pessoa e dois tokens (`P5`/`P6`): 403 num, 200 no outro. A
> pergunta que a matriz de perfil **não** consegue fazer é sobre PESSOA — "foi você quem
> pediu?" —, e é por isso que a regra de conflito da autorização existe ao lado dela, não
> dentro dela.
>
> **Corolário (2026-09-07):** quando a exigência **muda de sinal**, o check se **inverte**,
> não se apaga. `C2 auditor LÊ custo (200)` virou `C2 ★ auditor NÃO lê custo (403)` no mesmo
> lugar, com o motivo escrito ao lado. Apagar deixa um vazio onde qualquer coisa passa;
> inverter deixa uma pergunta que o próximo tem de responder. E toda remoção vem com
> **contraprova de presença** no mesmo par — sem ela, "apagaram o módulo inteiro" fica verde.

> **Lição do check que passava vazio:** `portao-autorizacao` marcou 44/44 sobre um bug que
> o usuário levava na cara em produção. Não foi falta de check — foi um check cuja
> asserção era satisfeita pelo próprio estado quebrado (`(null || []).every(...)` é
> `true`). Quando um portão espera por uma lista que o código sob teste **zera** no meio do
> caminho, a espera tem de exigir a lista **de volta**, não a ausência dela. Contraprova
> obrigatória ao endurecer um check: reintroduza o bug e confirme que ele falha — este
> falhou com a mensagem exata do usuário no diagnóstico.

> **Achado do dia (não corrigido de propósito):** o `forbidNonWhitelisted: true` do
> `ValidationPipe` de rota em `retornos.controller.ts` é **inerte**. O pipe GLOBAL
> (`main.ts`) roda antes com `whitelist: true` e já remove as propriedades desconhecidas,
> então não sobra nada para a rota proibir — mandar um campo inexistente devolve 201, não
> 400. Isso vale para TODA rota que declare um pipe próprio com essa opção. Ligar
> `forbidNonWhitelisted` no pipe global mudaria o contrato de todos os endpoints de uma
> vez e não cabia nesta mudança; fica registrado. Onde importava (a `data_agendada`, que
> passou a ser do servidor), o portão verifica o **valor gravado** em vez do 400 — prova
> mais forte: mostra que o servidor manda, não só que o cliente foi barrado.

*Automação (adendo 3) — perfil Secretaria:* `node scripts/portao-secretaria.js` — ver a seção *Portão da SECRETARIA* acima. Conta descartável criada pela tela e apagada no fim; 3 pacientes de teste (`TESTE-PORTAO-SECRETARIA-*`) apagados no fim.

*Automação (adendo 2) — módulo Retorno/Trilha:* `node scripts/portao-retorno.js` roda o portão do seguimento em browser isolado e headless (exige app e API no ar; as portas são configuráveis por `PORTAO_APP`/`PORTAO_API`, default 5173/3005; **credenciais em `.env.local`** — ver "Contas de teste dos portões" acima). 86 checks: RECIST travado na UI **e** 400 no DTO, toxicidades vindas do regime em curso + "outra", troca de protocolo gerando avaliação **vinculada** ao retorno, trilha mesclada na sequência real do fluxo, reestadiamento agendado/reagendado/vencido, o **formulário de retorno enxuto** (sem campo de data agendada no topo, sem jargão de imutabilidade na tela — só o ⓘ; linha read-only do previsto quando o retorno veio de um agendamento), o **próximo retorno** (chips, data calculada, agendado criado na trilha, intervalo do último ciclo sugerido sem ser imposto, 0 re-render ao escolher), a **lista de Pacientes** (as sete colunas pelo rótulo do cabeçalho, e a ausência das duas que saíram; idade em anos completos calculada no check, não cravada; protocolo com linha e dia da avaliação; selo **NÃO INCORPORADO** ausente para quem é incorporado e presente no eixo do corpus; selo **⏳ aguardando autorização** com o protocolo exibido continuando a ser o **vigente**; **médico assistente** derivado batendo com o topo da trilha — inclusive quando um retorno de OUTRO profissional passa a ser o evento mais recente; **busca** por nome e por registro com **0 re-render**, foco e cursor preservados, e estado vazio próprio), o **"quem não veio"** (coluna Próximo retorno em vermelho com o atraso em dias, atrasado no topo da ordem padrão, filtro de retornos atrasados, e o atraso sumindo quando o retorno é registrado), a **guia TISS SP/SADT** (blocos e numeração conforme o *Padrão TISS — Componente de Conteúdo e Estrutura, nov/2022*, p. 423, na ordem; pré-preenchimento de beneficiário/convênio/indicação/exames/solicitante; e o contrário disso — nº de guia, senha, CNES, código na operadora e TUSS **em branco**, porque a app não os inventa; as 5 linhas fixas de procedimento do formulário oficial; edição na conferência refletida na impressão; uma página **A4 paisagem**; barra de conferência fora do papel), **0 re-render** ao digitar em observações/toxicidade/exames, ausência de rota de edição (imutabilidade) e a matriz de perfil (revisor 403 na escrita, 200 na leitura). Também fixa a interação com a autorização: o portão escolhe deliberadamente um candidato **elegível**, porque retorno pressupõe protocolo **vigente** — seleção fora do padrão nasce como exceção pendente e não é vigente até o auditor aprovar. Apaga o paciente de teste no fim.

*Automação (adendo):* `node scripts/portao-b.js` roda os checks 5–8 do Portão B em browser isolado e headless (Chrome do sistema; exige app em 5173 e backend em 3005): a **Fase 0** confere a tela de login deslogada (split de duas colunas com o formulário na direita, os quatro cartões, o crédito, a linha permanente, ausência do enquadramento de protótipo, e o empilhamento em 420px de largura) — inclusive os ids `#lg_login`/`#lg_senha`/`#lg_btn`, que **`portao-credenciais.js` digita**: se a tela trocar de seletor sem o portão trocar junto, todos os portões param de logar, e é melhor falhar aqui com o nome certo. Depois: login dos 3 perfis, cadastro digitado com contador de render = 0, re-avaliação ao vivo, parecer gravado/atribuído, matriz de acesso, console limpo — e **apaga os dados de teste no fim** (parecer via SQL, paciente via DELETE admin). É um check que não passa pelo agente; o click-through manual continua valendo como contraprova humana.

## Lista de problemas (comorbidades · medicações em uso · alergias, 2026-09-16) — checks `L`/`V2`/`O4`–`O9` do `portao-importacao` + `E4`–`E6`/`D6` do `portao-extracao`

Motivo: o oncologista assistencial usa comorbidades/medicações/alergias **de relance**; até
aqui esses fatos só existiam dentro da nota de importação (`ressalva`/`observacoes`).

- **Dado**: 3 colunas jsonb em `pacientes` (`comorbidades`, `medicacoes_uso`, `alergias`),
  `NOT NULL DEFAULT '[]'`, item `{texto, origem, registrado_por:{id,nome}, em}`.
  Migration `ListaProblemas1790035200000`; o CHECK de `eventos_administrativos.tipo` ganha
  `'lista_problemas'`.
- **Escrita**: `PATCH /pacientes/:id/lista-problemas` `{lista, adicionar?, remover?}` —
  whitelist literal `['oncologista','admin']` (`ListaProblemasEditarGuard`). Secretaria e
  revisor = 403. Item manual nasce com origem `registro manual`; duplicata (sem acento/
  caixa) 409; remover o que não está 404. **Cada PATCH deixa um evento administrativo**
  append-only na trilha: `Lista de problemas atualizada por X: comorbidades +HAS · −DM`.
  O PATCH genérico do cadastro não toca nas listas (chave fora do DTO é descartada).
- **Secretaria às cegas**: ficha/lista dela sem as três chaves; os eventos da ficha
  administrativa vêm filtrados no WHERE (`tipo IN ('reagendamento','contato')`).
- **Importação**: a extração devolve `lista_problemas` categorizada, cada item com trecho
  literal (sem trecho = descartado); comorbidade/medicação/alergia NÃO repete em `sem_campo`;
  o antineoplásico do protocolo não entra em medicações (é o `regimen_id`). A proposta
  carrega as listas; o painel do oncologista mostra "Lista de problemas proposta" (× tira,
  + acrescenta, 0 render) e a **validação** grava na ficha com origem `importação (evolução
  de dd/mm/aaaa)`, assinada pelo validador, pelo MESMO caminho do PATCH (evento na trilha).
  Revalidar com a mesma lista não duplica nem dá erro.
- **Tela**: faixa `#lp-faixa` sob o cabeçalho (3 caixas, chips, tooltip origem · data · por);
  vazio = "— nenhuma registrada —"; + e × só oncologista/admin (× pede confirm); digitação
  sem re-render, gravar repinta só a faixa.

Checks: `L1` 403 secretaria/revisor · `L2` adição manual com origem/autor/evento · `L3`
409/400/404 · `L4` remoção + os dois eventos na trilha · `L5` PATCH genérico não escreve ·
`L6` secretaria sem chaves nem eventos · `S2`/`S3`/`S6` proposta carrega/valida as listas ·
`V2` validação grava a lista EDITADA com a origem da importação · `V4` evento da validação ·
`N5` 4 validações iguais = cada item uma vez · `U3`–`U5` formulário da secretaria ·
`O4` painel editável · `O5` faixa + tooltip + revisor só lê · `O6`/`O9` trilha, ficha vazia,
+/× pela tela. Extração real (J.M.G.M.): `E4` três listas populadas (HAS/DM/IAM — sigla ou
extenso, a redação do modelo varia entre rodadas; o fato e a lista não), `E5` proposta,
`E6` validação → ficha.

**SQLs de conferência do Neon (após o deploy do backend):**
```sql
SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns
 WHERE table_name = 'pacientes' AND column_name IN ('comorbidades','medicacoes_uso','alergias');
-- 3 linhas: jsonb · '[]'::jsonb · NO
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'CHK_eventos_administrativos_tipo';
-- CHECK ((tipo)::text = ANY (ARRAY['reagendamento','contato','lista_problemas']))
SELECT name FROM migrations ORDER BY id DESC LIMIT 1;  -- ListaProblemas1790035200000
```
Depois do deploy: **repovoar o #80 em produção pela tela** (o oncologista adiciona os itens
— viram registro dele, origem `registro manual`).

## Cabeçalho oncológico (lista de problemas · parte clínica, 2026-09-18) — `scripts/portao-cabecalho.js`

**Fase 1 (modelo, tela, edição manual) — aprovada no teste humano em 2026-09-18, commitada,
aguardando deploy (backend primeiro, app depois).** A Fase 2 (a importação alimenta o
cabeçalho) só começa com comando explícito.

O que é: a metade clínica da lista de problemas, com a estrutura do guia de cabeçalho
oncológico do revisor — título em caixa, subtítulo, três seções (apresentação ·
propedêutica · terapêutica) com data em coluna, intercorrências como sublinha da
terapêutica, marcadores tumorais em série e status atual. O desenho aprovado (mockup)
fica **fora do repositório** (`~/Downloads/oncoguia-mockups/`, `app/mockups/` no
.gitignore): foi desenhado sobre caso real, e iniciais não anonimizam registro + datas +
série de exames. Uma coluna jsonb `pacientes.cabecalho_oncologico`
(NOT NULL DEFAULT `{}`; CHECK literal no `tipo` das linhas por `jsonb_path_exists`);
regras puras em `backend/src/pacientes/cabecalho.ts`; `PATCH /pacientes/:id/cabecalho`
recebe uma **lista de operações** e deixa **um evento `cabecalho_oncologico`** na trilha por
chamada. Princípio: **omitir é preferível a inferir** — campo vazio some do objeto, data
parcial (`mm/aaaa`, `aaaa`) fica parcial e ordena pelo início do período.

*Automação:* `node scripts/portao-cabecalho.js` (mesmas portas; credenciais do
`.env.local`; cria e apaga uma secretaria descartável e 3 pacientes `TESTE-PORTAO-CAB-*`).
**72 checks, 5 logins** (o revisor entra na tela por injeção do token na sessão). Os ★★/★:
`A2` ordenação por data **parcial** e por tipo (`2024 < 01/2024 < 01/01/2024`, sem data no fim
da seção) · `A3` intercorrência **só em terapêutica**, um nível, logo abaixo do pai, rótulo
em ordem natural (`S1 < S3 < S11`) · `A4` data inválida = **400** em oito formas (31/02, mês
13, ISO, sem zero, ano de 2 dígitos, mês 00, < 1900, texto) e nada gravado "em parte" ·
`A5` série de marcador ordenada, ponto novo mantém a ordem, nome duplicado 409, remoção
por `valor+data` · `A6` remoção gera **evento na trilha** (append-only, autor, "−linha …") e
PATCH sem mudança **não** gera evento · `W1` PATCH = **403** para secretaria, revisor e
auditor · `W2` a **secretaria não recebe a chave** (lista e ficha) nem o evento; `W3`
revisor/auditor recebem (contraprova) · `U1`–`U5` bloco acima das três caixas, seções
`<details>` abertas, "+ linha" no summary **não** fecha a seção, resumo quando fechada,
"▸ ver N anteriores", ↳ sob o pai, subida (`up`) e último (`last`) na série · `U6`/`U7`
**0 re-render** ao digitar (contador em `render` **e** em `coRepintar`) · `U8` trilha com
"Cabeçalho oncológico atualizado" · `C1` ★★ texto do prontuário **igual ao gabarito**
(comparação exata, diff impresso na primeira linha divergente) e sem markdown/asterisco/
emoji · `C2` o botão põe **esse texto na área de transferência** (permissão de clipboard
no contexto) · `U9` **estado vazio de quem edita**: só o título do bloco e a linha
"+ montar cabeçalho oncológico" (sem seções, placeholders, status, marcador); o clique revela o esqueleto com **zero chamada ao servidor** (flag de sessão
`CO_UI.montar[pid]`, provada escutando `page.on('request')`); a primeira linha gravada
pela tela (0 re-render) traz o bloco normal e o botão de copiar; a recarga sem a flag vem
normal direto; **"Copiar para o prontuário" segue o TEXTO gerado**, não o cabeçalho — com
comorbidade e cabeçalho vazio o botão existe (P3, `Comorbidades: DPOC`), sem nada não existe
(P2) · `R1`/`R3` revisor vê e não edita; no vazio vê só a linha discreta, sem "+ montar".

Por que o estado vazio: todo paciente nasce com `{}` — sem isto, no dia do deploy a equipe
veria o esqueleto inteiro em cima de todo prontuário, ruído para zero conteúdo.

As fixtures do portão são um caso **sintético** (mama, datas de 2021–2025, CEA inventado):
a varredura pré-commit achou que a primeira versão reaproveitava datas e a série de CA-125
do caso real do mockup, e isso saiu antes do commit — dado de paciente não entra no
repositório nem como fixture.

**Ledger 2026-09-18 (fechamento da Fase 1), versão commitada:** `portao-cabecalho`
72/72 · 72/72 (Copiar pelo texto gerado; antes, 71/71 ×4 e 64/64 ×2 nas versões anteriores); `portao-secretaria` 93/93 · 93/93 (uma rodada anterior,
encadeada sem janela logo após o Portão B, teve 1 FAIL de console 429 — rate limit do
login, não o código; refeita 2× com janela de 80 s); `portao-b` tudo passou (2×). Portão C
(mérito clínico do formato do texto, das quatro pendências de apresentação) é do revisor.

**Pendentes do revisor (constantes no topo do bloco em `app/index.html`, um lugar cada):**
`CO_DATA_NA_COLUNA` (data à esquerda vs. dentro do texto) · `CO_SUB_MOSTRA` (intercorrência
com rótulo, data ou ambos) · `CO_RECENTES` (quantas linhas visíveis antes do "ver
anteriores") · `CO_ABERTO_PADRAO` (seções abertas por padrão).

**SQLs de conferência do Neon (quando for a produção):**
```sql
SELECT column_default, is_nullable FROM information_schema.columns
 WHERE table_name = 'pacientes' AND column_name = 'cabecalho_oncologico';   -- '{}'::jsonb · NO
SELECT conname FROM pg_constraint WHERE conname LIKE 'CHK_pacientes_cabecalho%';  -- 2 linhas
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'CHK_eventos_administrativos_tipo';
-- … 'lista_problemas','cabecalho_oncologico'
SELECT name FROM migrations ORDER BY id DESC LIMIT 1;  -- CabecalhoOncologico1790294400000
```
