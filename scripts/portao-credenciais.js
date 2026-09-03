// Credenciais dos portões — vêm do AMBIENTE, nunca do código.
//
// Por que isto existe: os portões precisam logar de verdade (é o ponto deles — não
// passar pelo agente), e antes faziam isso com `oncologista`/`onco123` escrito no
// arquivo. Duas coisas erradas nisso:
//   1) senha de teste versionada é senha vazada — o banco de validação é o mesmo que
//      guarda cadastro de gente real, e o login/senha estavam no repositório;
//   2) o portão amarrava-se às contas de SEED, que num banco vivo já foram desativadas.
//      Portão que não roda não protege nada.
//
// Agora cada perfil tem uma conta de teste própria, com senha forte, e as credenciais
// moram em `.env.local` na raiz (coberto pelo `.env.*` do .gitignore). Como criar as
// contas e preencher o arquivo: seção "Contas de teste dos portões" em
// PORTAO-VERIFICACAO.md.
//
// Variável de ambiente já definida no shell VENCE o .env.local (dotenv não sobrescreve),
// então dá para rodar um portão contra outra conta sem editar arquivo nenhum:
//   PORTAO_LOGIN=outro PORTAO_SENHA=... node scripts/portao-retorno.js
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'backend/node_modules/dotenv'))
  .config({ path: path.join(ROOT, '.env.local'), quiet: true });

// Um par de variáveis por perfil. O portão pede o PERFIL — nunca um login literal —
// para que trocar a conta de teste seja mexer no .env.local, não no código.
const PERFIS = {
  oncologista: ['PORTAO_LOGIN', 'PORTAO_SENHA'],
  revisor: ['PORTAO_LOGIN_REVISOR', 'PORTAO_SENHA_REVISOR'],
  auditor: ['PORTAO_LOGIN_AUDITOR', 'PORTAO_SENHA_AUDITOR'],
  admin: ['PORTAO_LOGIN_ADMIN', 'PORTAO_SENHA_ADMIN'],
};

// Falta de credencial ABORTA o portão com instrução, em vez de virar um FAIL confuso lá
// na frente: portão que "falha" por falta de configuração ensina a ignorar portão.
function cred(perfil) {
  const par = PERFIS[perfil];
  if (!par) throw new Error(`portao-credenciais: perfil desconhecido "${perfil}"`);
  const [kLogin, kSenha] = par;
  const login = process.env[kLogin];
  const senha = process.env[kSenha];
  if (!login || !senha) {
    throw new Error(
      `Credencial de teste ausente para o perfil "${perfil}".\n` +
      `  Defina ${kLogin} e ${kSenha} em ${path.join(ROOT, '.env.local')} (não versionado).\n` +
      `  Modelo: .env.example na raiz. Como criar as contas: seção "Contas de teste dos\n` +
      `  portões" em PORTAO-VERIFICACAO.md.`);
  }
  return { login, senha };
}

// ---- login com backoff no 429 -----------------------------------------------------
// `POST /auth/login` é limitado a 5 por minuto por IP (@Throttle no AuthController). Um
// portão sozinho já faz 4 logins (um por perfil), e dois portões seguidos estouram a
// janela. O 429 não é defeito do código sob teste — é o rate limit fazendo o trabalho
// dele —, então o portão ESPERA e tenta de novo em vez de reportar uma falha falsa.
// Qualquer outro status continua sendo erro na hora.
const espera = ms => new Promise(r => setTimeout(r, ms));

async function tokenApi(API, perfil, tentativas = 5) {
  const { login, senha } = cred(perfil);
  for (let i = 1; ; i++) {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha }),
    });
    if (r.ok) return (await r.json()).access_token;
    if (r.status !== 429 || i >= tentativas) throw new Error(`login ${perfil} (${login}): HTTP ${r.status}`);
    const s = 15 * i;
    console.log(`  … rate limit no login ${perfil}: aguardando ${s}s (tentativa ${i}/${tentativas - 1})`);
    await espera(s * 1000);
  }
}

// Login pela TELA, com a mesma paciência. A tela de login mostra o erro em `.auth-err`
// (`.login-err` é o estilo das OUTRAS telas — troca de senha, admin); o seletor cobre as
// duas para não voltar a ficar mudo se a tela mudar de classe. Ficar mudo é o pior modo
// de falha aqui: sem enxergar o erro, o portão seguia em frente e estourava lá na frente
// num "botão + Novo paciente não apareceu", que não diz nada sobre a causa.
// Se for o rate limit, espera e tenta de novo — o portão precisa provar o fluxo do
// usuário, e o usuário também tentaria de novo.
async function loginNaTela(page, perfil, tentativas = 5) {
  const { login, senha } = cred(perfil);
  for (let i = 1; ; i++) {
    await page.fill('#lg_login', login);
    await page.fill('#lg_senha', senha);
    // Apaga o erro da tentativa ANTERIOR antes de submeter. Sem isto a espera abaixo lê o
    // erro velho — que ainda está na tela, porque o sucesso só troca a tela quando a
    // sessão termina de carregar — e o portão dorme mais 60s por um 429 que já passou,
    // enquanto a app, logada, já mudou de tela por baixo dele.
    await page.evaluate(() => document.querySelectorAll('.auth-err, .login-err').forEach(e => e.remove()));
    await page.click('#lg_btn');
    const erro = await page.waitForSelector('.auth-err, .login-err', { timeout: 4000 }).catch(() => null);
    if (!erro) return login;
    const txt = (await erro.textContent()) || '';
    if (!/429|muitas|Too Many|limite/i.test(txt) || i >= tentativas) {
      throw new Error(`login ${perfil} (${login}) na tela: ${txt.trim().slice(0, 120)}`);
    }
    const s = 15 * i;
    console.log(`  … rate limit no login ${perfil} (tela): aguardando ${s}s (tentativa ${i}/${tentativas - 1})`);
    await espera(s * 1000);
  }
}

module.exports = { cred, PERFIS, tokenApi, loginNaTela, espera };
