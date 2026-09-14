// Portão B — fluxos reais no browser isolado (playwright de node_modules, headless).
// Fase 0 tela de login (deslogado): a página de apresentação em duas colunas — marca e
//   os quatro cartões à esquerda, formulário à direita —, o crédito, a linha permanente
//   de enquadramento, o empilhamento em tela estreita, e a AUSÊNCIA do enquadramento de
//   protótipo. Os ids do formulário (#lg_login/#lg_senha/#lg_btn) são conferidos aqui
//   porque portao-credenciais.js digita neles: se a tela mudar de seletor sem o portão
//   mudar junto, TODOS os portões param de logar.
// Fase 1 oncologista: login, console, sem aba Revisão (nem forçando view), cadastro
//   digitando (0 re-render), salvar, re-aval ao vivo à direita.
// Fase 2 revisor: login, Revisão visível, não cria avaliação; Mesa como fila de trabalho
//   (re-revisão no topo, processadas recolhidas, linha expandida íntegra, contador bate
//   com o filtro de Estado, "Tudo" intacto); parecer digitado (0 re-render), gravado e
//   atribuído — este último na visão "Tudo", a tela de antes.
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

  // ---- B10 — o card mostra o que o revisor ESCREVEU (notas da revisão clínica) ----
  // O corpus publicado tem cards de mama "revisado com ressalva" (lote 1): a nota do
  // revisor tem de aparecer no card do PACIENTE, com revisor e data — não só no
  // JSON. Lê o DOM, não o modelo: o que se afirma é a tela.
  // textContent, não innerText: os não incorporados vivem num <details> fechado, e
  // innerText de nó escondido é "" — "" === "" faria dois textos vazios parecerem iguais
  // e um bloco escondido parecer sem título (foi assim na primeira rodada deste check).
  const notas = await page.evaluate(() => {
    const tx = e => (e ? e.textContent : '').trim();
    const blocos = Array.from(document.querySelectorAll('#pac-protos-live .proto .rnotas'));
    const comMeta = blocos.filter(b => Array.from(b.querySelectorAll('.rnota-meta')).every(m => /\d{4}-\d{2}-\d{2}/.test(tx(m)) && tx(m).replace(/\d{4}-\d{2}-\d{2}/, '').replace(/[·\s]/g, '').length > 3));
    const semTexto = blocos.filter(b => Array.from(b.querySelectorAll('.rnota-txt')).some(t => !tx(t)));
    const titulo = blocos.filter(b => /Notas da revisão clínica/.test(tx(b.querySelector('.rnotas-h'))));
    // uma nota que já é o motivo da não incorporação não pode aparecer duas vezes no mesmo card
    const dup = Array.from(document.querySelectorAll('#pac-protos-live .proto')).filter(c => {
      const nis = Array.from(c.querySelectorAll('.noinc-just')).map(tx).filter(Boolean);
      const ns = Array.from(c.querySelectorAll('.rnota-txt')).map(tx).filter(Boolean);
      return ns.some(n => nis.includes(n));
    });
    // e o mesmo texto não pode aparecer duas vezes DENTRO do bloco (nota × "nota do squad")
    const eco = blocos.filter(b => { const a = Array.from(b.querySelectorAll('.rnota-txt, .rnota-squad')).map(tx).map(t => t.replace(/^Nota do squad:\s*/, '')); return new Set(a).size !== a.length; });
    return { n: blocos.length, comMeta: comMeta.length, semTexto: semTexto.length, titulo: titulo.length, dup: dup.length, eco: eco.length };
  });
  ok('B10 ★ card do paciente exibe "Notas da revisão clínica" (corpus tem notas de lote 1)', notas.n > 0 && notas.titulo === notas.n, JSON.stringify(notas));
  ok('B10 ★ toda nota vem com revisor e data', notas.n > 0 && notas.comMeta === notas.n && notas.semTexto === 0, JSON.stringify(notas));
  ok('B10 nota de não incorporação não é repetida no bloco de notas', notas.dup === 0, 'dup=' + notas.dup);
  ok('B10 nenhum texto ecoado dentro do bloco (nota × nota do squad)', notas.eco === 0, 'eco=' + notas.eco);
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
    await p2.waitForFunction(() => REVC_RESUMO_OK, { timeout: 20000 });
    await p2.waitForTimeout(400);

    // ---- B11 — MESA = fila de trabalho (só apresentação). A visão padrão abre com
    // "Aguardando re-revisão" no topo (é o que trava o ciclo), depois "Pendente" por
    // tumor; as processadas (aprovado/contestado/ajuste) NÃO aparecem expandidas — viram
    // a linha recolhida "▸ N já revisadas neste tumor", que expandida mostra o card
    // íntegro (nota + parecer). Filtro de Estado e "Baixar revisadas" valem sobre o
    // conjunto completo nas duas visões. Os checks de sempre (B10/B6/B5.4) rodam na
    // visão "Tudo", que é a tela de antes, intacta.
    const PROC = ['aprovado', 'contestado', 'ajuste'];
    const fila = await p2.evaluate((PROC) => {
      const secs = Array.from(document.querySelectorAll('.rc-secao')).map(e => e.className);
      const cards = Array.from(document.querySelectorAll('.rc-card'));
      const est = {}; cards.forEach(c => { est[c.dataset.estado] = (est[c.dataset.estado] || 0) + 1; });
      const real = {}; (REGIMES || []).forEach(r => { const e = estadoDe(r.regimen_id).estado; real[e] = (real[e] || 0) + 1; });
      const nRe = +(document.querySelector('.rc-secao-re .rc-secao-n') || {}).textContent;
      const nPend = +(document.querySelector('.rc-secao-pend .rc-secao-n') || {}).textContent;
      const linhas = Array.from(document.querySelectorAll('.rc-recolhida')).map(e => ({ t: e.dataset.tumor, n: +e.dataset.n, aberta: e.classList.contains('aberta') }));
      const somaLinhas = linhas.reduce((a, l) => a + l.n, 0);
      const realProc = PROC.reduce((a, k) => a + (real[k] || 0), 0);
      const seletorOn = (document.querySelector('.rc-visao-b.on') || {}).textContent || '';
      return { visao: REVC_VISAO, seletorOn: seletorOn.trim(), secs, est, real, nRe, nPend, linhas: linhas.length, somaLinhas, realProc, revisadas: REVC_REVISADAS_FILTRO.length };
    }, PROC);
    ok('B11 ★ visão padrão da Mesa é a fila de trabalho', fila.visao === 'fila' && /Fila de trabalho/.test(fila.seletorOn), `visao=${fila.visao} seletor="${fila.seletorOn}"`);
    ok('B11 ★ fila abre com "Aguardando re-revisão" no TOPO, "Pendente" em seguida',
      fila.secs.length === 2 && /rc-secao-re/.test(fila.secs[0]) && /rc-secao-pend/.test(fila.secs[1]), fila.secs.join(' > '));
    ok('B11 ★ contador da seção de re-revisão = re-revisão real no corpus (e > 0 neste banco)',
      fila.nRe > 0 && fila.nRe === (fila.real.pendente_re_revisao || 0) && fila.nRe === (fila.est.pendente_re_revisao || 0), `secao=${fila.nRe} real=${fila.real.pendente_re_revisao} cards=${fila.est.pendente_re_revisao}`);
    ok('B11 ★ nenhum card processado expandido na visão padrão',
      PROC.every(k => !fila.est[k]), JSON.stringify(fila.est));
    ok('B11 ★ pendentes visíveis = pendentes reais (nada some)', fila.nPend === (fila.real.pendente || 0) && fila.est.pendente === fila.real.pendente, `secao=${fila.nPend} real=${fila.real.pendente}`);
    ok('B11 ★ soma das linhas recolhidas = processadas reais (recolhido ≠ removido)',
      fila.realProc > 0 && fila.somaLinhas === fila.realProc && fila.linhas > 0, `linhas=${fila.linhas} soma=${fila.somaLinhas} real=${fila.realProc}`);
    ok('B11 linhas recolhidas nascem fechadas sem filtro de Estado', fila.linhas > 0 && (await p2.evaluate(() => document.querySelectorAll('.rc-recolhida.aberta').length)) === 0, '');
    ok('B11 "Baixar revisadas" (REVC_REVISADAS_FILTRO) conta o conjunto completo na fila', fila.revisadas === fila.realProc + (fila.real.pendente_re_revisao || 0), `revisadas=${fila.revisadas} proc+re=${fila.realProc + (fila.real.pendente_re_revisao || 0)}`);

    // Expandir a linha: cards íntegros (selo de estado processado, botões, pareceres).
    // Mira o tumor que tem NOTA em card processado — assim o check da nota não passa
    // vazio (0 = 0) num tumor que nunca teve nota.
    const tumorComNota = await p2.evaluate(() => {
      const t = {}; (REGIMES || []).forEach(r => { if (['aprovado','contestado','ajuste'].includes(estadoDe(r.regimen_id).estado) && notasRevisaoDe(r).length) t[r.tumor] = 1; });
      return Object.keys(t).find(k => document.querySelector(`.rc-recolhida[data-tumor="${k}"]`)) || null;
    });
    ok('B11 existe tumor com nota em card processado (senão o check da nota seria vazio)', !!tumorComNota, 'tumor=' + tumorComNota);
    await p2.click(`.rc-recolhida[data-tumor="${tumorComNota}"] .rc-recolhida-toggle`);
    await p2.waitForSelector('.rc-recolhida.aberta .rc-card', { timeout: 10000 });
    const exp = await p2.evaluate((PROC) => {
      const r = document.querySelector('.rc-recolhida.aberta');
      const cards = Array.from(r.querySelectorAll('.rc-card'));
      return { n: +r.dataset.n, cards: cards.length,
        estados: cards.map(c => c.dataset.estado), selos: cards.filter(c => c.querySelector('.rc-selo-wrap .rc-selo')).length,
        parecToggle: cards.filter(c => c.querySelector('.rc-parec-toggle')).length,
        notasHtml: cards.filter(c => c.querySelector('.rnotas')).length,
        tumor: r.dataset.tumor };
    }, PROC);
    ok('B11 ★ expandir a linha mostra exatamente N cards, todos processados', exp.cards === exp.n && exp.estados.every(e => PROC.includes(e)), JSON.stringify(exp));
    ok('B11 ★ card expandido é íntegro: selo de estado + pareceres em todos', exp.selos === exp.cards && exp.parecToggle === exp.cards, JSON.stringify(exp));
    await p2.click('.rc-recolhida.aberta .rc-parec-toggle');
    await p2.waitForSelector('.rc-recolhida.aberta .rc-parec-row', { timeout: 10000 });
    const parecExp = await p2.evaluate(() => {
      const c = document.querySelector('.rc-recolhida.aberta .rc-card');
      return { rows: c.querySelectorAll('.rc-parec-row').length, aindaAberta: !!document.querySelector('.rc-recolhida.aberta') };
    });
    ok('B11 ★ parecer do card expandido aparece e a linha continua aberta após o re-render', parecExp.rows > 0 && parecExp.aindaAberta, JSON.stringify(parecExp));
    // Cards com nota da revisão existem no corpus (B10 prova isso em "Tudo"); se este tumor
    // tem nota em algum processado, ela tem de estar dentro do card expandido também.
    const notaNoTumor = await p2.evaluate((t) => (REGIMES || []).filter(r => r.tumor === t && ['aprovado','contestado','ajuste'].includes(estadoDe(r.regimen_id).estado) && notasRevisaoDe(r).length).length, exp.tumor);
    ok('B11 ★ nota da revisão preservada no card expandido', notaNoTumor > 0 && notaNoTumor === exp.notasHtml, `tumor=${exp.tumor} comNota=${notaNoTumor} exibidas=${exp.notasHtml}`);
    await p2.click('.rc-recolhida.aberta .rc-recolhida-toggle');
    await p2.waitForTimeout(300);
    ok('B11 clicar de novo recolhe', (await p2.evaluate(() => document.querySelectorAll('.rc-recolhida.aberta').length)) === 0, '');

    // Filtro de Estado = aprovado: vale sobre o conjunto completo; a linha recolhida de
    // cada tumor bate com o filtro (conta só aprovados) e nasce aberta (quem filtrou quer ver).
    await p2.evaluate(() => setRevcFiltro('estado', 'aprovado'));
    await p2.waitForTimeout(400);
    const filt = await p2.evaluate(() => {
      const linhas = Array.from(document.querySelectorAll('.rc-recolhida')).map(e => ({ t: e.dataset.tumor, n: +e.dataset.n, aberta: e.classList.contains('aberta'), cards: e.querySelectorAll('.rc-card').length }));
      const porTumor = {}; (REGIMES || []).forEach(r => { if (estadoDe(r.regimen_id).estado === 'aprovado') porTumor[r.tumor] = (porTumor[r.tumor] || 0) + 1; });
      const opt = Array.from(document.querySelectorAll('.rc-filtros option')).find(o => o.value === 'aprovado');
      const optN = opt ? +(opt.textContent.match(/\((\d+)\)/) || [])[1] : -1;
      const bate = linhas.every(l => l.n === (porTumor[l.t] || 0)) && Object.keys(porTumor).length === linhas.length;
      const soma = linhas.reduce((a, l) => a + l.n, 0);
      const outros = Array.from(document.querySelectorAll('.rc-card')).filter(c => c.dataset.estado !== 'aprovado').length;
      return { linhas, bate, soma, optN, outros, todasAbertas: linhas.every(l => l.aberta && l.cards === l.n), revisadas: REVC_REVISADAS_FILTRO.length };
    });
    ok('B11 ★ filtro Estado=aprovado: contador de cada linha bate com o filtro', filt.bate && filt.soma === filt.optN, `soma=${filt.soma} opcao=(${filt.optN}) ${JSON.stringify(filt.linhas)}`);
    ok('B11 filtro Estado processado abre as linhas (e só aprovados na tela)', filt.todasAbertas && filt.outros === 0, JSON.stringify({ todasAbertas: filt.todasAbertas, outros: filt.outros }));
    ok('B11 "Baixar revisadas" segue o filtro, não a visão', filt.revisadas === filt.optN, `revisadas=${filt.revisadas} opcao=${filt.optN}`);
    await p2.evaluate(() => setRevcFiltro('estado', 'todos'));

    // Visão "Tudo" = a tela de antes, intacta: todos os cards, por tumor, sem seções nem
    // linhas recolhidas; "Baixar revisadas" com a mesma contagem da fila.
    await p2.click('.rc-visao-b:has-text("Tudo")');
    await p2.waitForFunction(() => REVC_VISAO === 'tudo' && document.querySelectorAll('.rc-secao').length === 0, { timeout: 10000 });
    const tudo = await p2.evaluate(() => ({ cards: document.querySelectorAll('.rc-card').length, regs: (REGIMES || []).length, secoes: document.querySelectorAll('.rc-secao').length, recolhidas: document.querySelectorAll('.rc-recolhida').length, revisadas: REVC_REVISADAS_FILTRO.length }));
    ok('B11 ★ visão "Tudo": todos os cards abertos, sem seção nem linha recolhida', tudo.cards === tudo.regs && tudo.secoes === 0 && tudo.recolhidas === 0, JSON.stringify(tudo));
    ok('B11 "Baixar revisadas" igual nas duas visões', tudo.revisadas === fila.revisadas, `tudo=${tudo.revisadas} fila=${fila.revisadas}`);
    ok('B7 console sem erro (Mesa: fila ⇄ tudo)', f2.errs.length === 0, f2.errs.join(' | '));

    // ---- B10 — na Revisão clínica o card também mostra as notas; e o rótulo do cenário
    // de testículo é estadiamento (TNM/S + IGCCCG), não "metastático" (pedido do revisor,
    // lote 2). Só rótulo: o valor interno segue `metastatico` (o filtro/agrupamento não muda).
    const rev = await p2.evaluate(() => {
      const notas = document.querySelectorAll('.rc-card .rnotas').length;
      const metas = Array.from(document.querySelectorAll('.rc-meta[data-rid^="testiculo-"]')).map(e => e.innerText);
      const tMet = metas.filter(t => /metast/i.test(t));
      const tRot = metas.filter(t => /Avançado \(estádio II-III \/ IGCCCG\)/.test(t));
      const outro = Array.from(document.querySelectorAll('.rc-meta[data-rid^="prostata-mcrpc-"]')).map(e => e.innerText).filter(t => /^Metastático/.test(t));
      const ridsMet = (REGIMES || []).filter(r => r.tumor === 'testiculo' && r.cenario === 'metastatico').length;
      return { notas, metas: metas.length, tMet: tMet.length, tRot: tRot.length, ridsMet, outro: outro.length };
    });
    ok('B10 ★ Revisão clínica: cards com "Notas da revisão clínica"', rev.notas > 0, 'cards com notas=' + rev.notas);
    ok('B10 ★ testículo: cenário rotulado "Avançado (estádio II-III / IGCCCG)" nos cards de valor metastatico', rev.ridsMet > 0 && rev.tRot === rev.ridsMet, JSON.stringify(rev));
    ok('B10 ★ testículo: nenhum card diz "metastático" no cenário', rev.tMet === 0, JSON.stringify(rev));
    ok('B10 outros tumores seguem com "Metastático" (mudança só de testículo)', rev.outro > 0, 'prostata mCRPC com rótulo Metastático=' + rev.outro);
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
