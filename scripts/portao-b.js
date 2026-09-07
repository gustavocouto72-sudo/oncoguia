// Portão B — fluxos reais no browser isolado (playwright de node_modules, headless).
// Fase 0 tela de login (deslogado): a página de apresentação em duas colunas — marca e
//   os quatro cartões à esquerda, formulário à direita —, o crédito, a linha permanente
//   de enquadramento, o empilhamento em tela estreita, e a AUSÊNCIA do enquadramento de
//   protótipo. Os ids do formulário (#lg_login/#lg_senha/#lg_btn) são conferidos aqui
//   porque portao-credenciais.js digita neles: se a tela mudar de seletor sem o portão
//   mudar junto, TODOS os portões param de logar.
// Fase 1 oncologista: login, console, sem aba Revisão (nem forçando view), cadastro
//   digitando (0 re-render), salvar, re-aval ao vivo à direita.
// Fase 2 revisor: login, Revisão visível, não cria avaliação, parecer digitado
//   (0 re-render), gravado e atribuído.
// Fase 3 admin (API): /revisao/export 200 = acesso admin OK.
// Limpeza: apaga parecer de teste (SQL) e paciente de teste (DELETE admin).
// Credenciais de teste: .env.local via scripts/portao-credenciais.js — nada fixo aqui.
const path = require('path');
const ROOT = require("path").resolve(__dirname, "..");
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env') });
const { tokenApi, loginNaTela } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');
const { neon } = require(path.join(ROOT, 'backend/node_modules/@neondatabase/serverless'));

const APP = 'http://localhost:5173/index.html';
const API = 'http://localhost:3005/api';
const NOME_TESTE = 'Paciente Portao Teste B';
const JUST_TESTE = 'TESTE PORTAO B - parecer de fumaca, sera apagado em seguida';

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + x + ']' : '')); };

async function loginCtx(browser, perfil) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 120)));
  await page.goto(APP);
  await loginNaTela(page, perfil);
  return { ctx, page, errs };
}

(async () => {
  // Primeira linha: sobre QUE BANCO este resultado vale. Aborta se não for o de dev.
  exigirBancoDeDev('B (fluxos 5–8)');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let pacienteId = null;

  // try/finally: a limpeza ficava no fim do caminho feliz, então QUALQUER check que
  // estourasse antes dela deixava o paciente e os pareceres de teste para trás — e a
  // rodada seguinte encontrava o banco sujo. O portão devolve o banco como encontrou
  // SEMPRE, inclusive quando falha (aliás, principalmente quando falha).
  try {
  // ============ FASE 0 — a tela de login, deslogado ============
  // Contexto próprio e descartado: esta fase tem de ver a app SEM sessão, e reaproveitar
  // um contexto logado provaria outra tela.
  {
    const ctx0 = await browser.newContext();
    const p0 = await ctx0.newPage();
    const errs0 = [];
    p0.on('console', m => { if (m.type() === 'error') errs0.push(m.text().slice(0, 120)); });
    p0.on('pageerror', e => errs0.push('pageerror: ' + e.message.slice(0, 120)));
    await p0.goto(APP);
    await p0.waitForSelector('.auth-split', { timeout: 20000 });

    // Estrutura: duas colunas, e o formulário mora na DIREITA (a escura). Não basta o
    // form existir na página — o desenho é "apresentação à esquerda, login à direita".
    const layout = await p0.evaluate(() => {
      const esq = document.querySelector('.auth-esq'), dir = document.querySelector('.auth-dir');
      const form = document.querySelector('#lg_btn');
      const re = esq && esq.getBoundingClientRect(), rd = dir && dir.getBoundingClientRect();
      return {
        temEsq: !!esq, temDir: !!dir,
        formNaDireita: !!(dir && form && dir.contains(form)),
        ladoALado: !!(re && rd && re.right <= rd.left + 1 && Math.abs(re.top - rd.top) < 2),
      };
    });
    ok('B0 tela de login é um split de duas colunas', layout.temEsq && layout.temDir, JSON.stringify(layout));
    ok('B0 colunas lado a lado em tela larga', layout.ladoALado, JSON.stringify(layout));
    ok('B0 o formulário está na coluna da DIREITA', layout.formNaDireita, JSON.stringify(layout));

    // Os ids que TODOS os portões usam para logar. Este check é a rede de segurança do
    // portao-credenciais.js: se um deles sumir, falha aqui com o nome certo, e não lá na
    // frente num "botão + Novo paciente não apareceu".
    const ids = await p0.evaluate(() => ({
      login: !!document.querySelector('#lg_login'),
      senha: !!document.querySelector('#lg_senha'),
      btn: !!document.querySelector('#lg_btn'),
      tipoSenha: (document.querySelector('#lg_senha') || {}).type,
    }));
    ok('B0 ids do formulário intactos (#lg_login/#lg_senha/#lg_btn) — portao-credenciais depende deles',
      ids.login && ids.senha && ids.btn && ids.tipoSenha === 'password', JSON.stringify(ids));

    const txt0 = await p0.evaluate(() => document.querySelector('.auth-split').innerText);
    ok('B0 marca e tagline na coluna de apresentação',
      /OncoGuia/.test(txt0) && /Requisi[çc][ãa]o de quimioterapia baseada em evid[êe]ncia/i.test(txt0),
      txt0.replace(/\s+/g, ' ').slice(0, 90));

    // Os quatro cartões, um a um: são a promessa que a tela faz, e "um deles sumiu"
    // é exatamente o tipo de perda que um check por contagem deixaria passar.
    const cartoes = await p0.evaluate(() => Array.from(document.querySelectorAll('.auth-f')).map(e => e.innerText));
    for (const t of ['Semáforo de elegibilidade', 'Revisão clínica', 'Trilha do paciente', 'Transparência']) {
      ok(`B0 cartão "${t}" presente com a descrição`,
        cartoes.some(c => c.includes(t) && c.replace(t, '').trim().length > 20), cartoes.length + ' cartões');
    }

    ok('B0 crédito "Criado por Gustavo Couto" no rodapé da tela', /Criado por Gustavo Couto/.test(txt0), '');
    ok('B0 linha permanente de enquadramento na tela de login',
      /nada aqui é recomendação clínica; informa, o médico decide/.test(txt0), '');

    // O enquadramento de PROTÓTIPO saiu. Lê a TELA (innerText), nunca o fonte.
    const telaToda = await p0.evaluate(() => (document.body.innerText || ''));
    ok('B0 sem "Protótipo conceitual" na tela de login', !/Prot[óo]tipo conceitual/i.test(telaToda), '');
    ok('B0 sem "dados fictícios" na tela de login', !/dados fict[íi]cios/i.test(telaToda), '');

    // Responsivo: em tela estreita as colunas EMPILHAM (mesma origem em x, tops
    // diferentes). Sem este check, "responsivo" seria só uma intenção no CSS.
    await p0.setViewportSize({ width: 420, height: 900 });
    await p0.waitForTimeout(300);
    const estreito = await p0.evaluate(() => {
      const re = document.querySelector('.auth-esq').getBoundingClientRect();
      const rd = document.querySelector('.auth-dir').getBoundingClientRect();
      return { mesmaColuna: Math.abs(re.left - rd.left) < 2, empilhado: Math.abs(re.top - rd.top) > 40,
               semScrollX: document.documentElement.scrollWidth <= window.innerWidth + 1 };
    });
    ok('B0 em tela estreita as colunas empilham', estreito.mesmaColuna && estreito.empilhado, JSON.stringify(estreito));
    ok('B0 tela estreita não gera rolagem horizontal', estreito.semScrollX, JSON.stringify(estreito));
    ok('B0 console sem erro na tela de login', errs0.length === 0, errs0.join(' | '));
    await ctx0.close();
  }

  // ============ FASE 1 — oncologista ============
  const f1 = await loginCtx(browser, 'oncologista');
  const { page } = f1;
  await page.waitForSelector('button:has-text("+ Novo paciente")', { timeout: 20000 });
  ok('B5.1 login oncologista', true);
  await page.waitForTimeout(800);
  ok('B7 console sem erro (load+login onco)', f1.errs.length === 0, f1.errs.join(' | '));

  // ---- Enquadramento: saiu o de protótipo, ficou a linha permanente ----------
  // O piloto é com paciente REAL. "Dados fictícios" na tela de quem cadastra paciente de
  // verdade não é só desatualizado — é uma afirmação falsa sobre o conteúdo do banco.
  const enq = await page.evaluate(() => ({
    tela: (document.body.innerText || ''),
    temRodape: !!document.getElementById('rodape'),
    rodape: (document.getElementById('rodape') || {}).innerText || '',
  }));
  ok('B9 badge "dados fictícios" sumiu da app logada', !/dados fict[íi]cios/i.test(enq.tela),
    (enq.tela.match(/.{0,30}dados fict.{0,30}/i) || [''])[0]);
  ok('B9 banner "Protótipo conceitual" sumiu da app logada', !/Prot[óo]tipo conceitual/i.test(enq.tela), '');
  ok('B9 linha permanente de enquadramento presente no rodapé',
    enq.temRodape && /Apoio à decisão baseado em evidência/.test(enq.rodape)
    && /nada aqui é recomendação clínica; informa, o médico decide/.test(enq.rodape),
    enq.rodape.slice(0, 80));

  const abas = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.textContent.trim()));
  ok('B8 oncologista sem aba Revisão', !abas.includes('Revisão clínica'), abas.join(','));
  const forced = await page.evaluate(() => { view = 'revclin'; render(); return view; });
  ok('B8 forçar view=revclin cai em lista (guard)', forced === 'lista', 'view=' + forced);

  // cadastro: digitar nome inteiro com contador de render
  await page.click('button:has-text("+ Novo paciente")');
  await page.waitForSelector('#f_nome');

  // ---- Orientação de anonimização no campo de nome --------------------------
  // ORIENTAÇÃO, não validação: o portão confere que a tela ORIENTA (rótulo + placeholder)
  // e, de propósito, que ela NÃO bloqueia — uma regra que recusasse texto aqui só
  // ensinaria a burlá-la, e o campo continua obrigatório pelo motivo de sempre.
  const campoNome = await page.evaluate(() => {
    const i = document.getElementById('f_nome');
    const campo = i.closest('.field');
    return { ph: i.placeholder, rot: (campo.querySelector('label') || {}).innerText || '',
             hint: (campo.querySelector('.hint') || {}).innerText || '' };
  });
  ok('B9 campo de nome orienta o piloto no RÓTULO (iniciais + nº de atendimento)',
    /Iniciais/i.test(campoNome.rot) && /atendimento/i.test(campoNome.rot) && /não usar nome/i.test(campoNome.rot),
    campoNome.rot);
  ok('B9 e também no PLACEHOLDER', /Iniciais \+ nº de atendimento \(não usar nome\)/.test(campoNome.ph), campoNome.ph);
  ok('B9 orientação NÃO bloqueia: nada de required/pattern no campo',
    await page.evaluate(() => { const i = document.getElementById('f_nome'); return !i.required && !i.pattern; }), '');
  await page.evaluate(() => { window.__rc = 0; const o = window.render; window.render = function () { window.__rc++; return o.apply(this, arguments); }; });
  await page.type('#f_nome', NOME_TESTE, { delay: 20 });
  const rcNome = await page.evaluate(() => window.__rc);
  const vNome = await page.inputValue('#f_nome');
  ok('B6 digitar nome: 0 re-render', rcNome === 0, 'renders=' + rcNome);
  ok('B6 nome intacto após digitação', vNome === NOME_TESTE, vNome);
  await page.fill('#f_ident', 'TESTE-PORTAO-B');
  // tumor mama (via mesmas funções da UI de chips)
  await page.evaluate(() => { const g = agruparTumores(TUMORES).find(g => g.items.some(i => i.id === 'mama')); toggleSysCad(g.id); setCadTumor('mama'); });
  await page.click('button:has-text("Salvar e abrir paciente")');
  await page.waitForSelector('#pac-protos-live', { timeout: 20000 });
  pacienteId = await page.evaluate(() => current);
  ok('B5.2 cadastrar paciente → salva e abre', !!pacienteId, 'id=' + pacienteId);

  // mudar característica clínica → protocolos re-avaliam ao vivo à direita
  const antes = await page.evaluate(() => document.getElementById('pac-protos-live').innerHTML.length);
  const mudou = await page.evaluate(() => {
    const left = document.querySelector('.pac-left') || document;
    const sel = Array.from(left.querySelectorAll('select')).find(s => s.options.length > 1);
    if (sel) { sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length; sel.dispatchEvent(new Event('change')); return 'select'; }
    const inp = left.querySelector('input[type=number]');
    if (inp) { inp.value = '2'; inp.dispatchEvent(new Event('input')); inp.dispatchEvent(new Event('change')); return 'number'; }
    const chk = left.querySelector('input[type=checkbox],input[type=radio]');
    if (chk) { chk.click(); return 'check'; }
    return null;
  });
  await page.waitForTimeout(400);
  const depois = await page.evaluate(() => document.getElementById('pac-protos-live').innerHTML.length);
  ok('B5.3 mudar característica → re-avalia ao vivo', !!mudou && depois !== antes, `campo=${mudou} html ${antes}→${depois}`);
  await f1.ctx.close();

  // ============ FASE 2 — revisor ============
  const f2 = await loginCtx(browser, 'revisor');
  const p2 = f2.page;
  let revisorOk = true;
  try { await p2.waitForSelector('a:has-text("Revisão clínica")', { timeout: 15000 }); }
  catch (e) { revisorOk = false; }
  ok('B8 revisor loga e vê aba Revisão', revisorOk);
  if (revisorOk) {
    const podeAv = await p2.evaluate(() => podeAvaliar());
    ok('B8 revisor não cria avaliação (podeAvaliar=false)', podeAv === false);
    await p2.click('a:has-text("Revisão clínica")');
    await p2.waitForSelector('.rc-b.bad', { timeout: 20000 });
    await p2.click('.rc-b.bad');                       // ⚑ Contestar no 1º card
    await p2.waitForSelector('.rc-just');
    const rid = await p2.evaluate(() => Object.keys(REVC_FORM).find(k => REVC_FORM[k] && REVC_FORM[k].decisao === 'contestado'));
    await p2.evaluate(() => { window.__rc = 0; const o = window.render; window.render = function () { window.__rc++; return o.apply(this, arguments); }; });
    await p2.click('.rc-just');
    await p2.type('.rc-just', JUST_TESTE, { delay: 15 });
    const rcJust = await p2.evaluate(() => window.__rc);
    ok('B6 digitar parecer: 0 re-render', rcJust === 0, 'renders=' + rcJust);
    await p2.click('.rc-nat-b.clinico');               // re-render esperado aqui
    await p2.click('.rc-acao-b.manter_anotar');
    const justSobreviveu = await p2.evaluate(() => document.querySelector('.rc-just').value);
    ok('B6 parecer intacto após re-render dos botões', justSobreviveu === JUST_TESTE);
    await p2.click('button:has-text("Confirmar contestação")');
    await p2.waitForFunction(() => REVC_BUSY === null, { timeout: 20000 });
    await p2.waitForTimeout(600);
    const parecer = await p2.evaluate((rid) => {
      const ds = (REVC_DEC[rid] || []);
      const d = ds[0] || null;
      return d ? { rev: d.revisor && d.revisor.nome, just: d.justificativa, acao: d.acao } : null;
    }, rid);
    // "Atribuído" = atribuído a QUEM ESTÁ LOGADO. Comparar com o nome da sessão, não com
    // um literal da conta de seed: a conta de teste vem do .env.local e pode ter outro nome.
    const revLogado = await p2.evaluate(() => USUARIO.nome);
    ok('B5.4 parecer gravado e atribuído', !!parecer && parecer.just === JUST_TESTE && parecer.rev === revLogado,
      parecer ? `${parecer.rev} · ${parecer.acao}` : 'sem parecer');
    ok('B7 console sem erro (revisor)', f2.errs.length === 0, f2.errs.join(' | '));
  }
  await f2.ctx.close();

  // ============ FASE 3 — admin (API, login de verdade) ============
  // Era um JWT assinado localmente com o JWT_SECRET e sub:1 fixo. Logar de verdade testa
  // o caminho que o usuário percorre e não depende do segredo do servidor.
  const token = await tokenApi(API, 'admin');
  const rExp = await fetch(API + '/revisao/export', { headers: { Authorization: 'Bearer ' + token } });
  ok('B8 admin: /revisao/export responde 200 (acesso total)', rExp.status === 200, 'status=' + rExp.status);

  } catch (e) {
    // A exceção vira um CHECK FALHO, e não some.
    //
    // Sem este catch o portão ficava VERDE ao estourar: o `finally` abaixo chama
    // process.exit(fails ? 1 : 0), e como uma exceção não é um check registrado,
    // `fails` dava 0 — o exit(0) acontecia antes de a exceção chegar ao .catch() do
    // final do arquivo. Portão que passa quando quebra é pior que portão nenhum, e é o
    // mesmo modo de falha do "check que passava vazio" já registrado no
    // PORTAO-VERIFICACAO.md.
    ok('EXCEÇÃO no portão', false, e && e.message ? e.message.slice(0, 200) : String(e));
  } finally {
    // ============ LIMPEZA — roda mesmo se um check acima estourou ============
    // Apaga o que ESTE portão criou: pareceres pelo prefixo de teste e o paciente
    // (cascata leva avaliações, retornos e seleções). Nada de "restaurar": aqui o
    // portão só cria, então devolver como encontrou é apagar.
    try {
      const admin = await tokenApi(API, 'admin');
      const sql = neon(process.env.DATABASE_URL);
      const del = await sql`DELETE FROM revisoes WHERE justificativa LIKE ${'TESTE PORTAO B%'} RETURNING id`;
      console.log('limpeza: pareceres de teste apagados =', del.length);
      if (pacienteId) {
        const rDel = await fetch(`${API}/pacientes/${pacienteId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + admin } });
        console.log('limpeza: paciente de teste', pacienteId, '→', rDel.status);
      }
    } catch (e) {
      // Limpeza que falha não pode mascarar o resultado dos checks — avisa alto e deixa
      // o veredito dos checks decidir o exit code.
      console.error('LIMPEZA FALHOU (banco pode ter ficado sujo): ' + e.message);
    }
    await browser.close();
    const fails = R.filter(r => !r[0]).length;
    console.log(fails ? `\n${fails} FALHA(S) NO PORTÃO B` : '\nPORTÃO B: TUDO PASSOU');
    process.exit(fails ? 1 : 0);
  }
})().catch(e => { console.error('ERRO no script:', e); process.exit(2); });
