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

## Portas (obrigatório)

Esta máquina roda vários projetos simultâneos. O OncoGuia usa: backend **3005** (`http://localhost:3005/api`), app estático **5173**, dashboard **5175**. A porta 3001 pertence ao Hospital Virtual — NUNCA use, e NUNCA mate processos de outros projetos para liberar porta. Mapa completo e regras: `~/Antigravity/PORTS.md` (e `~/Antigravity/CLAUDE.md`).
