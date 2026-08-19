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

## Portas (obrigatório)

Esta máquina roda vários projetos simultâneos. O OncoGuia usa: backend **3005** (`http://localhost:3005/api`), app estático **5173**, dashboard **5175**. A porta 3001 pertence ao Hospital Virtual — NUNCA use, e NUNCA mate processos de outros projetos para liberar porta. Mapa completo e regras: `~/Antigravity/PORTS.md` (e `~/Antigravity/CLAUDE.md`).
