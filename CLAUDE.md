# Opensquad — Project Instructions

This project uses **Opensquad**, a multi-agent orchestration framework.

## Quick Start

Type `/opensquad` to open the main menu, or use any of these commands:
- `/opensquad create` — Create a new squad
- `/opensquad run <name>` — Run a squad
- `/opensquad help` — See all commands

## Directory Structure

- `_opensquad/` — Opensquad core files (do not modify manually)
- `_opensquad/_memory/` — Persistent memory (company context, preferences)
- `squads/` — User-created squads
- `squads/{name}/_investigations/` — Sherlock content investigations (profile analyses)
- `squads/{name}/output/` — Generated content and files
- `_opensquad/_browser_profile/` — Persistent browser sessions (login cookies, localStorage)

## How It Works

1. The `/opensquad` skill is the entry point for all interactions
2. The **Architect** agent creates and modifies squads
3. During squad creation, the **Sherlock** investigator can analyze reference profiles (Instagram, YouTube, Twitter/X, LinkedIn) to extract real content patterns
4. The **Pipeline Runner** executes squads automatically
5. Agents communicate via persona switching (inline) or subagents (background)
6. Checkpoints pause execution for user input/approval

## Rules

- Always use `/opensquad` commands to interact with the system
- Do not manually edit files in `_opensquad/core/` unless you know what you're doing
- Squad YAML files can be edited manually if needed, but prefer using `/opensquad edit`
- Company context in `_opensquad/_memory/company.md` is loaded for every squad run

## Browser Sessions

Opensquad uses a persistent Playwright browser profile to keep you logged into social media platforms.
- Sessions are stored in `_opensquad/_browser_profile/` (gitignored, private to you)
- First time accessing a platform, you'll log in manually once
- Subsequent runs will reuse your saved session
- **Important:** The native Claude Code Playwright plugin must be disabled. Opensquad uses its own `@playwright/mcp` server configured in `.mcp.json`.

## Portão de verificação (obrigatório após todo lote de mudança)

Depois de qualquer lote de mudança (dados ou app), rode o **Portão de Verificação** — `PORTAO-VERIFICACAO.md` na raiz. Portão A (dados): `python3 squads/mbe-oncologia/verificar_dados.py --check-dois` sem caminho (usa a fonte única `squads/mbe-oncologia/RUN_ATIVO`; se imprimir `!!! ATENÇÃO`, o resultado é sobre corpus errado — descarte) + amostra viva de 3–4 DOIs no Crossref + cheiro de placar (re_derivado deve dominar). Portão B (app): fluxos reais clicados de ponta a ponta, digitação sem re-render, fiação, matriz de perfil. Portão C (clínico) é do oncologista — nunca carimbe mérito clínico.

## Sessões em paralelo (obrigatório)

**Trabalho que toca a mesma área roda em SEQUÊNCIA ou em worktree isolado — nunca duas
sessões em paralelo na mesma árvore.** "Mesma área" = app e backend (eles se tocam: a lista
da app lê o payload do `/pacientes`, o portão exercita os dois). Frentes de áreas separadas
— squad/dados vs app — podem correr juntas.

Por que: em 2026-09-03 um commit feito no meio de uma sessão varreu junto o trabalho em
andamento dela, e o histórico saiu com duas mudanças distintas embaralhadas num commit só
(`9f48141`, depois `ce3e531`). Nada se perdeu, mas o rastro ficou pior — e o modo de falha
seguinte é pior ainda: build parcial. O backend roda `dist/`, então uma sessão que
rebuilda no meio da edição de outra deixa a API servindo meia mudança, e o portão passa
ou falha por um motivo que não está no código de ninguém.

Regra prática: antes de começar, `git status` limpo ou mudanças que você reconhece como
suas. Se precisa mesmo de duas frentes na mesma área ao mesmo tempo, use worktree
separado. E **não commite por cima de uma sessão em andamento** — histórico publicado não
se reescreve (force-push cria mais risco do que uma mensagem imprecisa), então o commit
embaralhado fica.

## Autenticação (obrigatório)

**Comando que dispara fluxo de autenticação — OAuth no navegador, login de CLI, criação de
token — exige AVISO E APROVAÇÃO HUMANA ANTES de rodar.** Vale inclusive quando a sessão do
navegador completaria sozinha — e principalmente nesse caso: sucesso silencioso não cria
nenhum momento em que alguém reviu o que foi concedido.

Por que: em 2026-09-04, no deploy da Fase 3, um `neonctl projects list` — comando de
**leitura**, aparentemente inócuo — abriu uma URL de OAuth no navegador, completou com a
sessão já logada e gravou um token durável em `~/.config/neonctl/credentials.json`. Os
escopos pedidos não eram os da tarefa: além de `projects:read`, o fluxo pediu
`projects:create`, `projects:update`, `projects:delete`, `orgs:create`, `orgs:update`,
`orgs:delete` e `orgs:permission`. Ninguém aprovou nada, porque nada perguntou — e o aviso
só veio no relatório final, depois de feito. Não houve dano, e é exatamente por isso que
vira regra: este modo de falha não se anuncia.

Três coisas tornam isso diferente de um comando qualquer:

- **A credencial sobrevive à sessão.** O token fica no disco depois que a conversa acaba,
  disponível para qualquer processo daquele usuário.
- **O escopo é do fluxo, não da tarefa.** Quem autentica para *listar* recebe permissão de
  *apagar*. O CLI pede o conjunto inteiro que ele sabe usar, não o que você foi fazer.
- **O sucesso é mudo.** `sudo` pede senha; um deploy imprime URL e progresso. Um OAuth que
  reaproveita a sessão do navegador simplesmente funciona, e some.

Regra prática:

1. Antes de rodar, diga **qual comando**, **que escopo o fluxo pede** e **para quê** — e
   espere a resposta. Não é pedir permissão para o comando; é para a **concessão**.
2. **"Não autenticado" é PARADA, não convite para autenticar.** Se um comando falhar por
   falta de credencial, relate e pergunte — nunca dispare o login por conta própria.
3. Prefira o caminho que **já tem credencial** antes de propor um login novo: a connection
   string do `backend/.env`, o `vercel` já logado, a própria API do sistema com uma conta
   de teste. Na Fase 3, a verificação do banco de produção podia ter começado por aí.
4. Se um comando autenticar **sem você prever**, avise **na hora** — qual credencial, onde
   ficou gravada, que escopo — em vez de empurrar a descoberta para o relatório final.

Para revogar o que foi concedido naquele incidente: apagar
`~/.config/neonctl/credentials.json` e, se quiser cortar também do lado do Neon, revogar o
app `neonctl` nas autorizações da conta.

## Portas (obrigatório)

Esta máquina roda vários projetos simultâneos. O OncoGuia usa: backend **3005** (`http://localhost:3005/api`), app estático **5173**, dashboard **5175**. A porta 3001 pertence ao Hospital Virtual — NUNCA use, e NUNCA mate processos de outros projetos para liberar porta. Mapa completo e regras: `~/Antigravity/PORTS.md` (e `~/Antigravity/CLAUDE.md`).
