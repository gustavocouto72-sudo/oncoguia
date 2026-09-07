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

---

## Portão B — APP (código)

4. **Fonte certa.** O cabeçalho da app lê o run do `RUN_ATIVO` (07-22). Marcadores de sanidade: TCHP → TRYPHAENA; capivasertibe → CAPItello-291.

5. **Os 4 fluxos reais, de ponta a ponta** (clicando, não confiando no "verificado"):
   - [ ] login (tela de apresentação: apresentação à esquerda, formulário à direita, empilha em tela estreita)
   - [ ] cadastrar paciente (digitar nome inteiro sem apagar) → salva
   - [ ] mudar característica clínica → protocolos re-avaliam **ao vivo** à direita
   - [ ] abrir Revisão → digitar parecer → gravar → aparece atribuído

6. **Campo de texto livre não re-renderiza a lista.** Nome do paciente, parecer do revisor, "enviar fonte" (DOI): **digitar não pode re-renderizar a lista nem resetar scroll/foco** (testar com contador de render = 0 durante a digitação). Foi o bug do nome que apagava e o da Revisão que subia.

7. **Fiação.** Frontend e backend na mesma porta/base URL; app e Revisão lendo a mesma fonte. Console (F12) sem erro vermelho no load (CORS, `Failed to fetch`, `null`).

8. **Matriz de acesso por perfil ATIVO.** Oncologista: Pacientes, Fluxograma e **Simulador** — sem aba Revisão (nem por URL). Revisor: não cria avaliação. Auditor: fila de exceção, nada de Revisão e **nada de dinheiro**. **Gestor: só Recursos** — sem Pacientes, sem Fluxograma, sem Revisão, sem autorização, sem Simulador, e **sem nome de paciente** (a resposta do servidor sai pseudonimizada). Admin: tudo. (Selo de estado do protocolo aparece pro oncologista mesmo sem a Revisão.)

   **Simulador para o oncologista (2026-09-07).** A aba entrou na lista dele porque é
   **leitura pura do corpus de evidência** — sem paciente, sem escrita, sem dinheiro — e é
   onde o "informa, o médico decide" vira exploração livre: mexer nas características e
   ver o semáforo responder, com o **mesmo motor** da tela do paciente. Entrar aqui **não**
   o coloca em Revisão clínica: as duas abas dividiam um ternário só no `renderNav()`, por
   acidente de escrita, e agora cada uma tem a sua whitelist literal (`podeSimular()` vs. a
   lista da Revisão). **Nenhuma rota nova foi aberta no servidor** — o Simulador lê o que a
   tela do paciente já lia (`/evidencia`, `/revisoes/resumo`, `/revisoes/fontes`), tudo já
   dentro da whitelist dele; a whitelist do oncologista **não mudou uma linha**.

   *(Nota de forma, não de efeito: `/evidencia` é guardado só por `JwtAuthGuard` — o corpus
   é legível por qualquer perfil autenticado, gestor incluído, por decisão antiga. O efeito
   fica; a **forma escrita** vira whitelist literal dos cinco perfis na próxima mudança de
   backend — pendência **3** do `BACKLOG.md`, sem deploy próprio.)*

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

*Automação (adendo 2) — módulo Retorno/Trilha:* `node scripts/portao-retorno.js` roda o portão do seguimento em browser isolado e headless (exige app e API no ar; as portas são configuráveis por `PORTAO_APP`/`PORTAO_API`, default 5173/3005; **credenciais em `.env.local`** — ver "Contas de teste dos portões" acima). 86 checks: RECIST travado na UI **e** 400 no DTO, toxicidades vindas do regime em curso + "outra", troca de protocolo gerando avaliação **vinculada** ao retorno, trilha mesclada na sequência real do fluxo, reestadiamento agendado/reagendado/vencido, o **formulário de retorno enxuto** (sem campo de data agendada no topo, sem jargão de imutabilidade na tela — só o ⓘ; linha read-only do previsto quando o retorno veio de um agendamento), o **próximo retorno** (chips, data calculada, agendado criado na trilha, intervalo do último ciclo sugerido sem ser imposto, 0 re-render ao escolher), a **lista de Pacientes** (as sete colunas pelo rótulo do cabeçalho, e a ausência das duas que saíram; idade em anos completos calculada no check, não cravada; protocolo com linha e dia da avaliação; selo **NÃO INCORPORADO** ausente para quem é incorporado e presente no eixo do corpus; selo **⏳ aguardando autorização** com o protocolo exibido continuando a ser o **vigente**; **médico assistente** derivado batendo com o topo da trilha — inclusive quando um retorno de OUTRO profissional passa a ser o evento mais recente; **busca** por nome e por registro com **0 re-render**, foco e cursor preservados, e estado vazio próprio), o **"quem não veio"** (coluna Próximo retorno em vermelho com o atraso em dias, atrasado no topo da ordem padrão, filtro de retornos atrasados, e o atraso sumindo quando o retorno é registrado), a **guia TISS SP/SADT** (blocos e numeração conforme o *Padrão TISS — Componente de Conteúdo e Estrutura, nov/2022*, p. 423, na ordem; pré-preenchimento de beneficiário/convênio/indicação/exames/solicitante; e o contrário disso — nº de guia, senha, CNES, código na operadora e TUSS **em branco**, porque a app não os inventa; as 5 linhas fixas de procedimento do formulário oficial; edição na conferência refletida na impressão; uma página **A4 paisagem**; barra de conferência fora do papel), **0 re-render** ao digitar em observações/toxicidade/exames, ausência de rota de edição (imutabilidade) e a matriz de perfil (revisor 403 na escrita, 200 na leitura). Também fixa a interação com a autorização: o portão escolhe deliberadamente um candidato **elegível**, porque retorno pressupõe protocolo **vigente** — seleção fora do padrão nasce como exceção pendente e não é vigente até o auditor aprovar. Apaga o paciente de teste no fim.

*Automação (adendo):* `node scripts/portao-b.js` roda os checks 5–8 do Portão B em browser isolado e headless (Chrome do sistema; exige app em 5173 e backend em 3005): a **Fase 0** confere a tela de login deslogada (split de duas colunas com o formulário na direita, os quatro cartões, o crédito, a linha permanente, ausência do enquadramento de protótipo, e o empilhamento em 420px de largura) — inclusive os ids `#lg_login`/`#lg_senha`/`#lg_btn`, que **`portao-credenciais.js` digita**: se a tela trocar de seletor sem o portão trocar junto, todos os portões param de logar, e é melhor falhar aqui com o nome certo. Depois: login dos 3 perfis, cadastro digitado com contador de render = 0, re-avaliação ao vivo, parecer gravado/atribuído, matriz de acesso, console limpo — e **apaga os dados de teste no fim** (parecer via SQL, paciente via DELETE admin). É um check que não passa pelo agente; o click-through manual continua valendo como contraprova humana.
