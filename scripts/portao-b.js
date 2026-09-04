// Portão B — fluxos reais no browser isolado (playwright de node_modules, headless).
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

  // ============ FASE 1 — oncologista ============
  const f1 = await loginCtx(browser, 'oncologista');
  const { page } = f1;
  await page.waitForSelector('button:has-text("+ Novo paciente")', { timeout: 20000 });
  ok('B5.1 login oncologista', true);
  await page.waitForTimeout(800);
  ok('B7 console sem erro (load+login onco)', f1.errs.length === 0, f1.errs.join(' | '));

  const abas = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.textContent.trim()));
  ok('B8 oncologista sem aba Revisão', !abas.includes('Revisão clínica'), abas.join(','));
  const forced = await page.evaluate(() => { view = 'revclin'; render(); return view; });
  ok('B8 forçar view=revclin cai em lista (guard)', forced === 'lista', 'view=' + forced);

  // cadastro: digitar nome inteiro com contador de render
  await page.click('button:has-text("+ Novo paciente")');
  await page.waitForSelector('#f_nome');
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

  // ============ LIMPEZA ============
  const sql = neon(process.env.DATABASE_URL);
  const del = await sql`DELETE FROM revisoes WHERE justificativa LIKE ${'TESTE PORTAO B%'} RETURNING id`;
  console.log('limpeza: pareceres de teste apagados =', del.length);
  if (pacienteId) {
    const rDel = await fetch(`${API}/pacientes/${pacienteId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    console.log('limpeza: paciente de teste', pacienteId, '→', rDel.status);
  }

  await browser.close();
  const fails = R.filter(r => !r[0]).length;
  console.log(fails ? `\n${fails} FALHA(S) NO PORTÃO B` : '\nPORTÃO B: TUDO PASSOU');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERRO no script:', e); process.exit(2); });
