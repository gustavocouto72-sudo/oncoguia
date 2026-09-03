# Portão de Verificação — OncoGuia

**Princípio:** você não confia no agente; confia no que dá pra checar **sem** o agente.
Rode este portão depois de **todo lote** de mudança (dados ou app). Passou tudo → confie. Qualquer ✗ → volta pro agente.

> Instinto que vale mais que o portão: se veio **rápido demais e limpo demais**, desconfie e cheque em dobro. Foi essa desconfiança que pegou o lote ruim de 21/07.

---

## Portão A — DADOS (saída do squad)

0. **Fonte certa (checar PRIMEIRO).** Tudo — app, portão, Mesa — resolve o **mesmo** run a partir da constante única **`RUN_ATIVO`** (`squads/mbe-oncologia/RUN_ATIVO`). O portão imprime `Corpus: <caminho>` no cabeçalho:
   - **`Corpus:` tem que ser igual ao `RUN_ATIVO`.** Se aparecer `!!! ATENÇÃO: este caminho NÃO é o RUN_ATIVO`, **o resultado é sobre o corpus errado — descarte** e rode de novo apontando o run ativo. (Este foi o modo de falha de 02/08: o portão rodou no 07-21 rejeitado.)

1. **Invariantes mecânicos.** `python3 verificar_dados.py --check-dois` (sem caminho = usa a **pasta** do run do `RUN_ATIVO`, então os `campos_primitivos` por tumor entram e o check de órfãos roda de verdade; o dedupe mantém o agregado publicado como canônico). Exit `0` = passou; `1` = **não confie**. Checa: confirmado sem DOI, custo "concorda" sem fonte, campos órfãos (tumor sem vocabulário = warn nominal, não passa em silêncio), incompleto=0 por tumor (warn), estadiamento ordinal (warn), soma-invariante (candidatos + não-incorporados = total), consistência agregado × por-tumor (divergência = FALHA — conserto aplicado num lado só), DOIs de confirmado resolvem.

2. **Amostra viva de DOIs.** Pegue 3–4 confirmados e confirme à mão que o DOI **aponta pro estudo certo** (crossref.org/works/<doi>: autor+ano+tema). Resolver ≠ ser o paper certo. Foi o que pegou o TCHP e os 28 rótulos.

3. **Cheiro de placar.** Muito confirmado / quase nenhum incompleto = bandeira vermelha. Saudável = re_derivado dominando.

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

8. **Matriz de acesso por perfil.** Oncologista: sem aba Revisão (nem por URL). Revisor: não cria avaliação. Admin: tudo. (Selo de estado do protocolo aparece pro oncologista mesmo sem a Revisão.)

---

## Portão C — CLÍNICO (delegado, você NÃO verifica)

9. O mérito clínico — a nota MCBS está certa? um "avaliação própria" esconde uma divergência real? um regime devia ser refutado? — é do **oncologista de referência na Revisão**. Não é seu para carimbar. É o "informa, médico decide" por design.

---

**Regra final:** A, B e C cada um é um portão independente. Um agente é confiável na medida em que a saída dele **sobrevive a um check que não passa por ele** — e a camada clínica é assinada por um humano. Nenhum agente é load-bearing na sua confiança.

**Mudança de corpus (quando o squad processar as decisões do revisor):** trocar o `RUN_ATIVO` muda o que o revisor vê. Faça isso **deliberadamente** (não no meio de uma sessão de revisão), rode o Portão A no run novo **antes** de apontar o `RUN_ATIVO` pra ele, e só então publique.

---

*Automação (adendo 3) — módulo Autorização/exceção:* `node scripts/portao-autorizacao.js` roda o portão da solicitação de exceção (mesmas portas). 44 checks. Os dois marcados **★** são o coração: um `POST /pacientes/:id/avaliacoes` **direto**, sem `autorizacao_estado`, de um protocolo **não incorporado** tem de nascer `pendente` — o servidor relê o corpus e não acredita no cliente. Cobre ainda: pendente/negada nunca viram protocolo vigente, decisão única e imutável (409 na segunda), parecer obrigatório nas duas decisões, **0 re-render** ao digitar o parecer, e a matriz de perfil inteira (o `auditor` é eixo próprio: 403 em avaliação, Revisão, export e usuários). Apaga o paciente de teste no fim.

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

**Estado em 2026-09-03:** `portao-retorno` 47/47 · `portao-autorizacao` 44/44 ·
`portao-b` tudo passou.

*Automação (adendo 2) — módulo Retorno/Trilha:* `node scripts/portao-retorno.js` roda o portão do seguimento em browser isolado e headless (exige app e API no ar; as portas são configuráveis por `PORTAO_APP`/`PORTAO_API`, default 5173/3005; **credenciais em `.env.local`** — ver "Contas de teste dos portões" acima). 47 checks: RECIST travado na UI **e** 400 no DTO, toxicidades vindas do regime em curso + "outra", troca de protocolo gerando avaliação **vinculada** ao retorno, trilha mesclada na sequência real do fluxo, reestadiamento agendado/reagendado/vencido, a **guia TISS SP/SADT** (blocos e numeração conforme o *Padrão TISS — Componente de Conteúdo e Estrutura, nov/2022*, p. 423, na ordem; pré-preenchimento de beneficiário/convênio/indicação/exames/solicitante; e o contrário disso — nº de guia, senha, CNES, código na operadora e TUSS **em branco**, porque a app não os inventa; as 5 linhas fixas de procedimento do formulário oficial; edição na conferência refletida na impressão; uma página **A4 paisagem**; barra de conferência fora do papel), **0 re-render** ao digitar em observações/toxicidade/exames, ausência de rota de edição (imutabilidade) e a matriz de perfil (revisor 403 na escrita, 200 na leitura). Também fixa a interação com a autorização: o portão escolhe deliberadamente um candidato **elegível**, porque retorno pressupõe protocolo **vigente** — seleção fora do padrão nasce como exceção pendente e não é vigente até o auditor aprovar. Apaga o paciente de teste no fim.

*Automação (adendo):* `node scripts/portao-b.js` roda os checks 5–8 do Portão B em browser isolado e headless (Chrome do sistema; exige app em 5173 e backend em 3005): login dos 3 perfis, cadastro digitado com contador de render = 0, re-avaliação ao vivo, parecer gravado/atribuído, matriz de acesso, console limpo — e **apaga os dados de teste no fim** (parecer via SQL, paciente via DELETE admin). É um check que não passa pelo agente; o click-through manual continua valendo como contraprova humana.
