# OncoGuia — backend

API própria do OncoGuia (não compartilha banco nem código com o HelmCare — só o padrão):
**NestJS + PostgreSQL (TypeORM) + JWT (passport-jwt) + bcrypt + helmet + throttler**, pronta
para deploy na Vercel (`vercel.json` + `api/index.ts`).

A **evidência clínica não passa por aqui**: os regimes continuam vindo do output do squad
(`app/data.js` / `revisao-data.js`). O backend cerca a app com auth + persistência:
pacientes, seleções de protocolo (linha do tempo) e pareceres da Mesa de Revisão.

## Subir localmente

```bash
cd backend
cp .env.example .env        # edite DATABASE_URL e JWT_SECRET
npm install
npm run migration:run       # cria as tabelas
npm run seed                # admin + oncologista + revisor de teste
npm run start:dev           # http://localhost:3005/api
```

Postgres: qualquer instância local ou hospedada (Neon / Vercel Postgres / Supabase).
Local: `createdb oncoguia` e ajuste a `DATABASE_URL`.

## Credenciais do seed (dev)

| login | senha | perfil |
|---|---|---|
| `admin` | `admin123` | admin |
| `oncologista` | `onco123` | oncologista |
| `revisor` | `revisor123` | revisor |

Hierarquia de perfis (`roles.guard.ts`): `oncologista < revisor < admin` — perfil maior
herda as permissões do menor. Endpoints de `/revisao/*` exigem `revisor`+.

## Endpoints

- `POST /api/auth/login` → `{ access_token, usuario }`
- `GET /api/auth/perfil` · `POST /api/auth/alterar-senha`
- `POST /api/auth/trocar-perfil` `{ perfil }` → token NOVO com outro perfil **da lista** do
  usuário; perfil fora da lista = 403 (ver *Perfis*)
- `GET|POST /api/pacientes` · `GET /api/pacientes/:id` · `GET /api/pacientes/:id/selecoes`
- `POST /api/selecoes` — grava a escolha de protocolo (fotografia de `dados_clinicos` em JSONB)
- `POST|GET /api/revisao/decisoes` — pareceres da Mesa de Revisão (perfil revisor)
- `GET /api/revisao/export` — gera o `revisao-decisoes.json` a partir do banco
  (mesmo schema do antigo download; é o que o squad reincorpora nos Steps 08/10)

- `GET /api/custos/...` — expectativa de uso e custo por PROTOCOLO (whitelist `['gestor','admin']`;
  cadastro de preço só admin)
- `GET /api/recursos/...` — gestão de recursos por INSUMO: projeção de compra, faturamento e
  margem (whitelist `['gestor','admin']`; cadastro só admin)
- As duas são a MESMA whitelist de propósito: a camada financeira inteira é de gestor e
  admin. O `auditor` **não** lê custo — decide mérito da exceção, não custo (ver
  *Decisão de papel* em `PORTAO-VERIFICACAO.md`). Para o token de **gestor** as respostas
  que listam paciente saem **pseudonimizadas** — o nome não é lido do banco

## Perfis

`oncologista` · `revisor` · `auditor` · `admin` · `gestor` — **whitelist, nunca hierarquia**.
`auditor` e `gestor` são eixos próprios: o primeiro decide solicitação de exceção e mais
nada — **sem ver dinheiro**, nem na tela nem por API; o segundo vê a camada financeira
(`/custos` + `/recursos`) e mais nada — sem Revisão, sem autorização e sem dado clínico
(`LeituraClinicaGuard`). Só `oncologista < revisor < admin` formam escada (`RolesGuard`), e
quem está fora dela não herda nada.

### Vários chapéus, um por vez

Uma pessoa tem uma **LISTA** de perfis (`usuarios.perfis`, definida pelo admin) e veste
**um por vez**. O que o login entrega é `usuarios.perfil`, o *perfil ativo padrão*, que o
CHECK `CHK_usuarios_perfis` obriga a ser membro da lista.

- **O JWT carrega UM perfil ativo.** Guards e whitelists não mudaram de lógica: continuam
  perguntando "qual é o perfil ativo?". Estar na lista **não acumula permissão**.
- **Trocar = `POST /auth/trocar-perfil`**, que valida o pedido contra a lista **lida do
  banco** e emite um token novo. Fora da lista → 403, inclusive por API direta.
- **A lista é reconferida a cada requisição** (`JwtStrategy`): retirar um perfil de alguém
  invalida na hora o token que o usava — não se espera o token expirar.
- **Ninguém decide a própria solicitação.** `POST /autorizacoes/:id/decidir` recusa quando
  o auditor é o autor da avaliação, **qualquer que seja o perfil ativo**. Sem essa regra os
  perfis múltiplos abririam o caminho de pedir a exceção com um chapéu e aprová-la com
  outro, sem nenhum guard reclamar.
- **Cada ação gravada carimba o perfil ativo do momento** (`perfil_ativo` em `avaliacoes`,
  `revisoes` e `retornos`; `autorizacao_perfil_ativo` para a decisão). "Quem escreveu" não
  responde mais "com que chapéu escreveu".

## Deploy (Vercel)

Defina em Environment Variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRY`, `CORS_ORIGINS`
(origens do frontend, separadas por vírgula). Migrations rodam no boot (`migrationsRun: true`).
