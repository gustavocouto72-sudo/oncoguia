// Portão do módulo AUTORIZAÇÃO / solicitação de exceção — fluxos reais em browser isolado
// (headless) + API. É o check que NÃO passa pelo agente.
//
//  Fase 1 (UI, oncologista): seleciona protocolo NÃO INCORPORADO com justificativa →
//    nasce 'pendente', NÃO vira protocolo vigente, aparece como exceção aguardando; e o
//    oncologista não enxerga a aba Autorizações (nem forçando a view).
//  Fase 2 (UI, auditor): fila com o card (paciente, protocolo, justificativa do médico),
//    parecer digitado com contador de render = 0, aprovação → passa a vigente.
//  Fase 3 (API): o que a UI não pode garantir — enforcement SERVER-SIDE do não-incorporado
//    (POST direto sem autorizacao_estado nasce pendente do mesmo jeito), estado inicial
//    não escolhível pelo cliente, decisão única e imutável, parecer obrigatório nas duas
//    decisões, e a matriz de perfil (auditor é eixo próprio, não degrau de hierarquia).
//  Limpeza: apaga o paciente de teste (DELETE admin, JWT assinado).
//
// Uso: node scripts/portao-autorizacao.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const jwt = require(path.join(ROOT, 'backend/node_modules/jsonwebtoken'));

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';
const NOME_TESTE = 'Paciente Portao Autorizacao';
const JUST_TESTE = 'TESTE PORTAO AUT - justificativa clinica de fumaca, sera apagada';
const PARECER_TESTE = 'TESTE PORTAO AUT - parecer do auditor, sera apagado';
// Do corpus (backend/data/evidencia.json): um regime não incorporado e um incorporado.
const RID_NAO_INC = 'mama-neo-her2pos-phesgo-nao-incorporado';
const RID_INC = 'mama-adj-her2neg-act';

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 160) + ']' : '')); };

async function token(login, senha) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, senha }),
  });
  if (!r.ok) throw new Error(`login ${login}: HTTP ${r.status}`);
  return (await r.json()).access_token;
}
async function req(metodo, rota, tk, body) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: Object.assign(tk ? { Authorization: 'Bearer ' + tk } : {}, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch (_) { }
  return { status: r.status, body: j };
}
const avaliacaoBase = (rid, extra) => Object.assign({
  regimen_id: rid, linha_tratamento: 1, snapshot_campos: { teste: true }, semaforo: 'elegivel',
}, extra || {});

async function ctxLogin(browser, user, senha) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  const alertas = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  page.on('dialog', async d => {
    if (d.type() === 'alert') alertas.push(d.message().slice(0, 160));
    await (d.type() === 'prompt' ? d.accept(JUST_TESTE) : d.accept());
  });
  await page.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);
  await page.goto(APP);
  await page.fill('#lg_login', user);
  await page.fill('#lg_senha', senha);
  await page.click('#lg_btn');
  await page.waitForFunction(() => !!localStorage.getItem('oncoguia_token'), null, { timeout: 25000 });
  const tk = await page.evaluate(() => localStorage.getItem('oncoguia_token'));
  return { ctx, page, errs, alertas, tk };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let pacienteId = null, avaliacaoPendenteId = null;
  let tkOnco = null, tkAud = null;

  try {
    // ═══ FASE 1 — oncologista abre a solicitação de exceção ═══
    const f1 = await ctxLogin(browser, 'oncologista', 'onco123');
    const page = f1.page;
    tkOnco = f1.tk;
    await page.waitForSelector('button:has-text("+ Novo paciente")', { timeout: 25000 });
    ok('U1 login oncologista', true);

    const abas = await page.evaluate(() => Array.from(document.querySelectorAll('#nav a')).map(a => a.textContent.trim()));
    ok('U2 oncologista NÃO vê a aba Autorizações', !abas.some(a => /Autoriza/.test(a)), abas.join(','));
    const forcada = await page.evaluate(() => { view = 'autorizacoes'; render(); return view; });
    ok('U2 forçar view=autorizacoes cai em lista (guard de tela)', forcada === 'lista', 'view=' + forcada);

    // paciente de teste
    await page.click('button:has-text("+ Novo paciente")');
    await page.waitForSelector('#f_nome');
    await page.fill('#f_nome', NOME_TESTE);
    await page.fill('#f_ident', 'TESTE-PORTAO-AUT');
    await page.evaluate(() => {
      const g = agruparTumores(TUMORES).find(g => g.items.some(i => i.id === 'mama'));
      toggleSysCad(g.id); setCadTumor('mama');
    });
    await page.click('button:has-text("Salvar e abrir paciente")');
    await page.waitForSelector('#pac-protos-live', { timeout: 25000 });
    pacienteId = await page.evaluate(() => current);
    ok('U3 paciente de teste criado', !!pacienteId, 'id=' + pacienteId);

    // seleção de protocolo NÃO INCORPORADO — exige justificativa (prompt) e nasce pendente
    const temBotaoNoInc = await page.evaluate(rid => {
      const b = Array.from(document.querySelectorAll('.sel-btn.noinc'))
        .find(x => (x.getAttribute('onclick') || '').includes(rid));
      if (b) { b.click(); return true; }
      return false;
    }, RID_NAO_INC);
    ok('U4 card de não incorporado traz o botão "selecionar mesmo assim"', temBotaoNoInc);
    await page.waitForFunction(pid => PAC_DETAIL[pid] && (PAC_DETAIL[pid].linha_do_tempo || []).length > 0,
      pacienteId, { timeout: 25000 });

    const dep = await page.evaluate(pid => PAC_DETAIL[pid], pacienteId);
    const linha0 = dep.linha_do_tempo[0];
    avaliacaoPendenteId = linha0.id;
    ok('U5 seleção de não incorporado nasce PENDENTE',
      linha0.autorizacao_estado === 'pendente', linha0.autorizacao_estado);
    ok('U5 protocolo pendente NÃO é o vigente (ultima_avaliacao)',
      dep.ultima_avaliacao === null, JSON.stringify(dep.ultima_avaliacao && dep.ultima_avaliacao.regimen_id));
    const justGravada = await req('GET', `/pacientes/${pacienteId}/avaliacoes`, tkOnco);
    ok('U6 justificativa do médico gravada na ressalva (é o que o auditor lê)',
      /justificativa/i.test(JSON.stringify(justGravada.body[0].detalhe_semaforo || {})),
      JSON.stringify((justGravada.body[0].detalhe_semaforo || {}).ressalva || '').slice(0, 90));
    const telaPend = await page.evaluate(() => document.body.textContent);
    ok('U7 a tela do paciente avisa que aguarda autorização', /Aguardando autoriza/i.test(telaPend));
    ok('U8 console sem erro (fluxo do oncologista)', f1.errs.length === 0, f1.errs.join(' | '));
    await f1.ctx.close();

    // ═══ FASE 2 — auditor decide ═══
    const f2 = await ctxLogin(browser, 'auditor', 'auditor123');
    const pa = f2.page;
    tkAud = f2.tk;
    await pa.waitForSelector('#nav a', { timeout: 25000 });
    const abasAud = await pa.evaluate(() => Array.from(document.querySelectorAll('#nav a')).map(a => a.textContent.trim()));
    ok('A1 auditor vê a aba Autorizações', abasAud.some(a => /Autoriza/.test(a)), abasAud.join(','));
    await pa.click('#nav a:has-text("Autoriza")');
    await pa.waitForFunction(() => AUT_LISTA !== null, null, { timeout: 25000 });
    const naFila = await pa.evaluate(id => (AUT_LISTA || []).some(a => a.id === id), avaliacaoPendenteId);
    ok('A2 solicitação aparece na fila do auditor', naFila);
    const cardTxt = await pa.evaluate(() => document.body.textContent);
    ok('A3 card mostra o paciente', cardTxt.includes(NOME_TESTE));
    ok('A3 card mostra a justificativa do médico', cardTxt.includes(JUST_TESTE.slice(0, 40)));

    // parecer: digitar não re-renderiza a fila
    await pa.evaluate(() => { window.__rc = 0; const o = window.render; window.render = function () { window.__rc++; return o.apply(this, arguments); }; });
    const seletorParecer = `textarea`;
    await pa.waitForSelector(seletorParecer, { timeout: 10000 });
    await pa.type(seletorParecer, PARECER_TESTE, { delay: 12 });
    const rc = await pa.evaluate(() => window.__rc);
    const vParecer = await pa.evaluate(s => document.querySelector(s).value, seletorParecer);
    ok('A4 digitar parecer: 0 re-render', rc === 0, 'renders=' + rc);
    ok('A4 parecer intacto após digitação', vParecer === PARECER_TESTE, vParecer.slice(0, 60));

    await pa.click('button:has-text("Aprovar")');
    try {
      await pa.waitForFunction(id => (AUT_LISTA || []).every(a => a.id !== id), avaliacaoPendenteId, { timeout: 25000 });
    } catch (e) {
      throw new Error('aprovação não saiu da fila; AUT_ERRO=' + await pa.evaluate(() => AUT_ERRO)
        + ' | alertas=' + f2.alertas.join(' ; ') + ' | console=' + f2.errs.join(' ; '));
    }
    ok('A5 aprovada sai da fila de pendentes', true);
    ok('A5 nenhum alerta de erro na decisão', f2.alertas.length === 0, f2.alertas.join(' ; '));
    ok('A6 console sem erro (fluxo do auditor)', f2.errs.length === 0, f2.errs.join(' | '));
    await f2.ctx.close();

    const depoisAprov = await req('GET', `/pacientes/${pacienteId}`, tkOnco);
    ok('A7 aprovada vira o protocolo VIGENTE do paciente',
      depoisAprov.body.ultima_avaliacao && depoisAprov.body.ultima_avaliacao.id === avaliacaoPendenteId,
      JSON.stringify(depoisAprov.body.ultima_avaliacao && depoisAprov.body.ultima_avaliacao.regimen_id));
    const linhaAprov = depoisAprov.body.linha_do_tempo.find(l => l.id === avaliacaoPendenteId);
    ok('A7 parecer e auditor ficam registrados na trilha',
      linhaAprov.autorizacao_estado === 'aprovada' && linhaAprov.autorizacao_parecer === PARECER_TESTE
      && !!linhaAprov.autorizacao_auditor,
      `${linhaAprov.autorizacao_estado} · ${linhaAprov.autorizacao_auditor}`);

    // ═══ FASE 3 — API: o enforcement que a UI não garante ═══
    // tkOnco/tkAud vêm das sessões da UI acima; só o revisor precisa de um login próprio.
    const tkRev = await token('revisor', 'revisor123');

    // ★ a pergunta em aberto: POST DIRETO, sem autorizacao_estado, semáforo elegível.
    const direto = await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkOnco, avaliacaoBase(RID_NAO_INC));
    ok('E1 ★ não incorporado por POST direto (sem autorizacao_estado) nasce PENDENTE no servidor',
      direto.status === 201 && direto.body.autorizacao_estado === 'pendente',
      `${direto.status} estado=${direto.body && direto.body.autorizacao_estado}`);
    const idDireto = direto.body && direto.body.id;

    // cliente mentindo: manda 'nao_necessaria' de propósito para um não incorporado
    const mentira = await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkOnco,
      avaliacaoBase(RID_NAO_INC, { autorizacao_estado: 'nao_necessaria' }));
    ok('E2 ★ cliente não consegue declarar "nao_necessaria" para não incorporado',
      mentira.status === 201 && mentira.body.autorizacao_estado === 'pendente',
      `estado=${mentira.body && mentira.body.autorizacao_estado}`);

    // inelegível também é forçado pelo servidor
    const inelegivel = await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkOnco,
      avaliacaoBase(RID_INC, { semaforo: 'inelegivel' }));
    ok('E3 inelegível por POST direto nasce PENDENTE no servidor',
      inelegivel.body && inelegivel.body.autorizacao_estado === 'pendente',
      `estado=${inelegivel.body && inelegivel.body.autorizacao_estado}`);

    // seleção normal segue nascendo vigente (o enforcement não vira paranoia)
    const normal = await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkOnco, avaliacaoBase(RID_INC));
    ok('E4 protocolo incorporado + elegível nasce nao_necessaria (vigente na hora)',
      normal.body && normal.body.autorizacao_estado === 'nao_necessaria',
      `estado=${normal.body && normal.body.autorizacao_estado}`);

    // o cliente não escolhe o estado final
    const forjada = await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkOnco,
      avaliacaoBase(RID_INC, { autorizacao_estado: 'aprovada' }));
    ok('E5 cliente não consegue criar avaliação já "aprovada" (400 no DTO)',
      forjada.status === 400, String(forjada.status));

    // decisão: parecer obrigatório, única e imutável
    const semParecer = await req('POST', `/autorizacoes/${idDireto}/decidir`, tkAud, { decisao: 'negada' });
    ok('E6 decidir sem parecer → 400 (parecer obrigatório nas duas decisões)',
      semParecer.status === 400, String(semParecer.status));
    const negada = await req('POST', `/autorizacoes/${idDireto}/decidir`, tkAud,
      { decisao: 'negada', parecer: PARECER_TESTE });
    ok('E7 negar registra a decisão', negada.status === 201 && negada.body.estado === 'negada',
      `${negada.status} ${negada.body && negada.body.estado}`);
    const redecidir = await req('POST', `/autorizacoes/${idDireto}/decidir`, tkAud,
      { decisao: 'aprovada', parecer: 'tentando mudar de ideia' });
    ok('E8 decisão é ÚNICA e IMUTÁVEL (409 na segunda)', redecidir.status === 409, String(redecidir.status));
    const naoSolicitacao = await req('POST', `/autorizacoes/${normal.body.id}/decidir`, tkAud,
      { decisao: 'aprovada', parecer: 'x' });
    ok('E9 avaliação que não é solicitação não é decidível (409)', naoSolicitacao.status === 409, String(naoSolicitacao.status));

    // negada NÃO some e NÃO passa a vigente
    const depoisNegada = await req('GET', `/pacientes/${pacienteId}`, tkOnco);
    const naTrilha = depoisNegada.body.linha_do_tempo.find(l => l.id === idDireto);
    ok('E10 negada permanece na trilha com o parecer',
      !!naTrilha && naTrilha.autorizacao_estado === 'negada' && !!naTrilha.autorizacao_parecer,
      naTrilha && naTrilha.autorizacao_estado);
    ok('E10 negada nunca vira o protocolo vigente',
      depoisNegada.body.ultima_avaliacao.id !== idDireto,
      'vigente=' + depoisNegada.body.ultima_avaliacao.id);

    // pendente não conta como vigente, mas aparece como pendência na lista
    const lista = await req('GET', '/pacientes', tkOnco);
    const naLista = lista.body.find(p => p.id === pacienteId);
    ok('E11 lista conta as exceções pendentes do paciente',
      naLista.autorizacoes_pendentes >= 1, 'pendentes=' + naLista.autorizacoes_pendentes);

    // ---- matriz de perfil: auditor é eixo próprio, não degrau da hierarquia ----
    const semTk = await fetch(`${API}/autorizacoes`);
    ok('P1 fila sem token → 401', semTk.status === 401, String(semTk.status));
    ok('P2 oncologista na fila de autorizações → 403',
      (await req('GET', '/autorizacoes', tkOnco)).status === 403);
    ok('P3 revisor na fila de autorizações → 403',
      (await req('GET', '/autorizacoes', tkRev)).status === 403);
    ok('P4 auditor na fila → 200', (await req('GET', '/autorizacoes', tkAud)).status === 200);
    ok('P5 oncologista não decide exceção → 403',
      (await req('POST', `/autorizacoes/${idDireto}/decidir`, tkOnco, { decisao: 'aprovada', parecer: 'x' })).status === 403);
    ok('P6 auditor NÃO cria avaliação (não herda do oncologista) → 403',
      (await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkAud, avaliacaoBase(RID_INC))).status === 403);
    ok('P7 auditor NÃO entra na Revisão clínica → 403',
      (await req('GET', '/revisoes?regimen_id=' + RID_INC, tkAud)).status === 403);
    ok('P8 auditor NÃO exporta o pacote do squad (admin) → 403',
      (await req('GET', '/revisao/export', tkAud)).status === 403);
    ok('P9 auditor NÃO lista usuários (admin) → 403',
      (await req('GET', '/usuarios', tkAud)).status === 403);
    ok('P10 auditor lê a evidência (autenticado) → 200',
      (await req('GET', '/evidencia', tkAud)).status === 200);
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.message);
  } finally {
    if (pacienteId) {
      try {
        const admin = jwt.sign({ sub: 1, login: 'admin', perfil: 'admin' }, process.env.JWT_SECRET, { expiresIn: '5m' });
        const del = await req('DELETE', `/pacientes/${pacienteId}`, admin);
        ok('Z limpeza: paciente de teste removido', del.status === 200 || del.status === 204, String(del.status));
      } catch (e) { ok('Z limpeza: paciente de teste removido', false, e.message); }
    }
    await browser.close();
    const falhas = R.filter(r => !r[0]).length;
    console.log(`\n${R.length - falhas}/${R.length} checks passaram` + (falhas ? ` — ${falhas} FALHA(S)` : ' — portão OK'));
    process.exit(falhas ? 1 : 0);
  }
})();
