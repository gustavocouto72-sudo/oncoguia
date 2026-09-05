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
   - [ ] login
   - [ ] cadastrar paciente (digitar nome inteiro sem apagar) → salva
   - [ ] mudar característica clínica → protocolos re-avaliam **ao vivo** à direita
   - [ ] abrir Revisão → digitar parecer → gravar → aparece atribuído

6. **Campo de texto livre não re-renderiza a lista.** Nome do paciente, parecer do revisor, "enviar fonte" (DOI): **digitar não pode re-renderizar a lista nem resetar scroll/foco** (testar com contador de render = 0 durante a digitação). Foi o bug do nome que apagava e o da Revisão que subia.

7. **Fiação.** Frontend e backend na mesma porta/base URL; app e Revisão lendo a mesma fonte. Console (F12) sem erro vermelho no load (CORS, `Failed to fetch`, `null`).

8. **Matriz de acesso por perfil.** Oncologista: sem aba Revisão (nem por URL). Revisor: não cria avaliação. Auditor: fila de exceção e custo, nada de Revisão. **Gestor: só Recursos** — sem Pacientes, sem Fluxograma, sem Revisão, sem autorização, e **sem nome de paciente** (a resposta do servidor sai pseudonimizada). Admin: tudo. (Selo de estado do protocolo aparece pro oncologista mesmo sem a Revisão.)

   O gestor é o perfil que mais exige o teste **nas duas pontas**: o que ele não pode ver
   tem de dar 403 na **API direta**, não só sumir da tela. Foi assim que apareceu a falha
   real desta fase — `GET /pacientes` e `GET /revisoes/resumo` diziam "leitura = qualquer
   autenticado", o que era verdade enquanto todo perfil autenticado era clínico. O gestor
   levava 200 com nome, carteirinha e tumor de todo mundo. A correção não foi uma lista de
   quem NÃO pode (blacklist envelhece mal: o próximo perfil novo nasceria vendo tudo) — foi
   `LeituraClinicaGuard`, a lista literal de quem pode.

---

## Portão de RECURSOS (`scripts/portao-recursos.js`)

Especialização do portão B para a gestão de recursos — insumos, compra, faturamento e
margem. Roda em browser isolado (headless) + API direta, 91 checks.

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
- **Matriz do gestor nas DUAS pontas.** Oncologista, revisor e auditor levam 403 em toda
  rota de `/recursos` (o auditor **continua** vendo `/custos`, que é o dado da decisão de
  exceção). O gestor leva 403 em 13 rotas clínicas e nas três escritas de recursos. Na
  tela: só a aba Recursos, e `go('lista')` cai em Recursos em vez de tela vazia.
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

---

## Portão C — CLÍNICO (delegado, você NÃO verifica)

9. O mérito clínico — a nota MCBS está certa? um "avaliação própria" esconde uma divergência real? um regime devia ser refutado? — é do **oncologista de referência na Revisão**. Não é seu para carimbar. É o "informa, médico decide" por design.

---

**Regra final:** A, B e C cada um é um portão independente. Um agente é confiável na medida em que a saída dele **sobrevive a um check que não passa por ele** — e a camada clínica é assinada por um humano. Nenhum agente é load-bearing na sua confiança.

**Mudança de corpus (quando o squad processar as decisões do revisor):** trocar o `RUN_ATIVO` muda o que o revisor vê. Faça isso **deliberadamente** (não no meio de uma sessão de revisão), rode o Portão A no run novo **antes** de apontar o `RUN_ATIVO` pra ele, e só então publique.

---

*Automação (adendo 3) — módulo Autorização/exceção:* `node scripts/portao-autorizacao.js` roda o portão da solicitação de exceção (mesmas portas). 53 checks. Os dois marcados **★** são o coração: um `POST /pacientes/:id/avaliacoes` **direto**, sem `autorizacao_estado`, de um protocolo **não incorporado** tem de nascer `pendente` — o servidor relê o corpus e não acredita no cliente. Cobre ainda: pendente/negada nunca viram protocolo vigente, decisão única e imutável (409 na segunda), parecer obrigatório nas duas decisões, **0 re-render** ao digitar o parecer, e a matriz de perfil inteira (o `auditor` é eixo próprio: 403 em avaliação, Revisão, export e usuários). Desde 2026-09-03 cobre também a **decisão com a visão do paciente aberta** (fase B, os dois ★ novos): o auditor abre a ficha — detalhe e trilha em cache — e só então nega. Foi o caminho que escapou quando o `AVAL_HIST` órfão (sobra do rename Histórico→Trilha) estourava **depois** do POST e alertava "Falha ao registrar a decisão" para uma decisão já gravada. Junto veio o conserto da espera do A5: ela era `(AUT_LISTA || []).every(...)`, e a decisão zera `AUT_LISTA` **antes** de recarregar a fila — com a lista em `null` a checagem passava **vazia**. Agora exige `Array.isArray`, isto é, exige que o refresh tenha completado. Apaga o paciente de teste no fim.

*Automação (adendo 4) — módulo Expectativa de custo:* `node scripts/portao-custo.js` roda o portão do custo global (mesmas portas). **50 checks.** O coração são dois. **(1) A matriz de perfil nas DUAS pontas, por API direta:** oncologista e revisor levam **403 em todas as 6 rotas de leitura** de `/custos` e no `PUT` de preço — a app esconder o bloco é cortesia, o controle é o guard; e o auditor **lê mas não cadastra** (403 só no PUT), porque leitura e escrita são whitelists diferentes (`['auditor','admin']` vs `['admin']`). **(2) A aritmética conferida contra o JSON de origem:** o portão recalcula ciclos e faixa a partir de `backend/data/evidencia.json` **com cópia própria da regra de periodicidade** — portão que importa a função sob teste não testa nada — e compara com o que o servidor respondeu, incluindo a **soma da carteira** (total = soma das linhas, e cada linha = ciclos × preço). Para isso o portão **cria o próprio paciente e a avaliação**: na primeira execução o check passou com `no_calculo=0`, isto é, verde sem somar nada, porque nenhum paciente da base tinha protocolo estimável. Cobre ainda: **indeterminado vira "sem estimativa" com motivo — nunca R$ 0** nem campo vazio (e nada de `R$ 0,00` renderizado na tela), periodicidade não derivável do esquema **não é chutada**, preço negociado acima da tabela é **recusado** (faixa invertida), preço **sem fonte** é recusado, preço para regime fora do corpus é recusado, o bloco **ausente do DOM do oncologista** inclusive entrando por `go('custos')`, e **0 re-render ao digitar nos campos de preço**. Restaura os preços anteriores e apaga o paciente de teste no fim.

*Adendo 4.1 — orais contínuos e desacoplamento uso/custo:* o portão passou para **72 checks**. Novos: **oral sem `periodo_dias`** não converte tempo em aplicações e não mostra R$ nenhum **mesmo com preço cadastrado** (o esquema do osimertinibe não tem intervalo de ciclo, e inventar um erraria o custo por um fator de 3); **com `periodo_dias`** a aritmética confere contra o recálculo independente (20,7 meses × 30,4 ÷ 30 = 21 períodos) e a origem sai marcada como `periodo_declarado`, não como esquema; `periodo_dias` **0 ou 400 é recusado**; regime com **tempo derivável e sem preço** mostra a metade de USO e **nenhum R$** — na API e na tela; e digitar no campo de período tem **0 re-render**, igual aos de preço.

> **Lição do endpoint que ficou lento e virou falha de portão:** `/custos/cobertura` fazia um `findOne` de preço **por regime** — 295 idas ao Neon numa chamada só, **13,8s** de resposta. O portão esperava por `CUSTO_ADM !== null`, que é preenchida pela **primeira** das duas chamadas, e ia procurar o campo na tela 13 segundos antes de a tela existir: `waitForSelector` estourava e o portão acusava um bug de UI que não existia. Consertos, nesta ordem: a consulta virou **um** `find()` com mapa em memória (13,8s → **0,3s**), e a espera do portão passou a ser pelo **elemento da lista**, não pela variável. Espera por variável de estado é espera por meia verdade quando o carregamento tem mais de um passo.

> **Cuidado ao checar ausência de bloco na UI:** o `<script>` da app mora **dentro do `<body>`**, então `document.body.textContent` devolve o **código-fonte** junto com a tela — procurar a string `'Expectativa de custo'` ali dá falso-positivo, porque ela existe dentro de uma função. O portão conta **elementos** (`document.querySelectorAll('.cst')`), não texto.

> **Lição do bloco assíncrono que quebrou o vizinho:** a primeira versão do bloco de custo buscava a estimativa e chamava `render()` quando ela chegava. Isso passou no portão de custo e **quebrou o `portao-autorizacao` (50/53)**: o render global caía por cima do auditor enquanto ele digitava o parecer — `renders=2`, texto truncado em "TESTE PORTAO". Qualquer coisa que chegue **assíncrona** nesta app repinta o **próprio slot** (`pintarSlotsCusto()`, `#cst-carteira`), nunca a tela inteira. É a mesma regra do "0 re-render" dos formulários, aplicada à chegada de dado em vez de à digitação — e o motivo de rodar **todos** os portões antes do commit, não só o do módulo que se mexeu.

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

**Estado em 2026-09-04:** `portao-retorno` 86/86 · `portao-autorizacao` 53/53 ·
`portao-custo` 72/72 · `portao-recursos` 91/91 (duas execuções seguidas, lista de checks
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

*Automação (adendo):* `node scripts/portao-b.js` roda os checks 5–8 do Portão B em browser isolado e headless (Chrome do sistema; exige app em 5173 e backend em 3005): login dos 3 perfis, cadastro digitado com contador de render = 0, re-avaliação ao vivo, parecer gravado/atribuído, matriz de acesso, console limpo — e **apaga os dados de teste no fim** (parecer via SQL, paciente via DELETE admin). É um check que não passa pelo agente; o click-through manual continua valendo como contraprova humana.
