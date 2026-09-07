// Portão dos PERFIS MÚLTIPLOS — uma pessoa, vários chapéus, um por vez.
// Fluxos reais em browser isolado (headless) + API. É o check que NÃO passa pelo agente.
//
//  Fase 1 (UI, admin): a tela de acessos atribui uma LISTA de perfis (checkboxes, não
//    <select>), e o admin — que tem um chapéu só — continua vendo BADGE ESTÁTICO. O
//    seletor aparecendo para quem não tem escolha seria uma promessa vazia na tela.
//  Fase 2 (UI, usuário de dois chapéus): o badge vira SELETOR; trocar re-renderiza com
//    as abas do perfil novo (Autorizações entra e sai); o token no localStorage muda.
//  Fase 3 (UI): trocar com FORMULÁRIO ABERTO pede confirmação, e cancelar não troca nada.
//  Fase 4 (API): o que a UI não pode garantir — troca para perfil FORA da lista é 403; a
//    MATRIZ é por PERFIL ATIVO (a mesma pessoa, dois tokens, permissões diferentes); a
//    REGRA DE CONFLITO recusa quem decide a própria solicitação, e outro auditor decide;
//    retirar um perfil invalida o token que o usava; e o admin não se auto-deslogueia.
//  Limpeza: apaga o paciente e o usuário de teste (DELETE admin).
//
// NÃO ENCADEIE com outro portão sem uma janela de ~1 min: `POST /auth/login` é limitado a
// 5/min por IP. Este portão faz 3 logins (admin na tela, o usuário criado na tela, o
// auditor por API) — os demais tokens saem de /auth/trocar-perfil, que NÃO é login.
//
// Uso: node scripts/portao-perfis.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const { tokenApi, loginNaTela } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';

// Conta descartável, criada e apagada por este portão. Não vai para o .env.local de
// propósito: ela existe para testar a ATRIBUIÇÃO de perfis, então precisa nascer aqui.
const SUFIXO = String(Date.now()).slice(-7);
const LOGIN_X = `portao.perfis.${SUFIXO}`;
const NOME_X = 'Portao Perfis Multiplos';
const NOME_PACIENTE = 'Paciente Portao Perfis';
const JUST_TESTE = 'TESTE PORTAO PERFIS - justificativa clinica de fumaca, sera apagada';
const PARECER_TESTE = 'TESTE PORTAO PERFIS - parecer do auditor, sera apagado';
const RID_NAO_INC = 'mama-neo-her2pos-phesgo-nao-incorporado';
const RID_INC = 'mama-adj-her2neg-act';

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 160) + ']' : '')); };

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

// Contexto de browser com controle explícito do diálogo: a Fase 3 precisa CANCELAR um
// confirm() e depois ACEITAR outro. `dlg.acao` é lida na hora do evento.
async function ctxLogin(browser, quem) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  const dlg = { acao: 'aceitar', ultima: '', todos: [] };
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  page.on('dialog', async d => {
    dlg.ultima = d.message(); dlg.todos.push(d.type() + ': ' + d.message().slice(0, 200));
    if (d.type() === 'prompt') return d.accept(JUST_TESTE);
    return dlg.acao === 'cancelar' ? d.dismiss() : d.accept();
  });
  await page.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);
  await page.goto(APP);
  await loginNaTela(page, quem);
  await page.waitForFunction(() => !!localStorage.getItem('oncoguia_token'), null, { timeout: 25000 });
  await page.waitForSelector('#nav a', { timeout: 25000 });
  const tk = await page.evaluate(() => localStorage.getItem('oncoguia_token'));
  return { ctx, page, errs, dlg, tk };
}

const abasDe = page => page.evaluate(() => Array.from(document.querySelectorAll('#nav a')).map(a => a.textContent.trim()));

// A troca termina quando o USUARIO É outro **E a tela já foi redesenhada** — não quando o
// token chega. Entre as duas coisas há um `await carregarSessao()` (carteira, selo da
// fila), e esperar só por `USUARIO.perfil` lia o DOM do chapéu ANTERIOR: a primeira versão
// deste portão acusou "Autorizações não entrou" com a app correta, e depois "Autorizações
// não saiu" — o sintoma clássico de estar sempre um render atrasado. `TROCANDO_PERFIL`
// volta a false na mesma linha síncrona do render, então é ele o sinal de "acabou".
const trocaConcluida = (page, perfil) => page.waitForFunction(
  p => USUARIO && USUARIO.perfil === p && !TROCANDO_PERFIL, perfil, { timeout: 25000 });

(async () => {
  // Primeira linha: sobre QUE BANCO este resultado vale. Aborta se não for o de dev.
  exigirBancoDeDev('perfis múltiplos (troca de chapéu)');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let pacienteId = null, usuarioXId = null, senhaX = null;
  let tkAdm = null, tkAud = null, tkXOnco = null, tkXAud = null;
  let ctxX = null;

  try {
    // ═══ FASE 1 — UI do ADMIN: atribuir a LISTA de perfis ═══
    const fa = await ctxLogin(browser, 'admin');
    tkAdm = fa.tk;
    const pa = fa.page;

    // O admin tem UM chapéu: badge estático, sem seletor. É a metade da regra que some
    // primeiro numa regressão ("mostra sempre o select, é mais simples").
    ok('A1 ★ usuário de UM perfil vê badge estático, sem seletor',
      await pa.evaluate(() => !!document.querySelector('#userbox .uperfil')
        && !document.querySelector('#ub_perfil')));

    await pa.evaluate(() => go('admin'));
    await pa.waitForFunction(() => view === 'admin' && ADM_USUARIOS !== null, null, { timeout: 25000 });
    const caixas = await pa.evaluate(() =>
      ['oncologista', 'revisor', 'auditor', 'admin', 'gestor']
        .filter(p => !!document.getElementById('adm_perfil_' + p)));
    ok('A2 cadastro de usuário traz CHECKBOX para os 5 perfis', caixas.length === 5, caixas.join(','));

    await pa.fill('#adm_nome', NOME_X);
    await pa.fill('#adm_login', LOGIN_X);
    // [oncologista, auditor]: os dois chapéus que a regra de conflito precisa ver juntos
    // na mesma pessoa — pedir a exceção e decidi-la.
    await pa.check('#adm_perfil_auditor');
    await pa.click('button:has-text("Criar usuário")');
    await pa.waitForSelector('.senha-tmp .pw', { timeout: 25000 });
    senhaX = (await pa.textContent('.senha-tmp .pw') || '').trim();
    ok('A3 usuário de dois perfis criado com senha temporária', !!senhaX, 'login=' + LOGIN_X);

    const criado = await pa.evaluate(l => (ADM_USUARIOS || []).find(u => u.login === l), LOGIN_X);
    usuarioXId = criado && criado.id;
    ok('A4 backend gravou a LISTA (não só um perfil)',
      !!criado && Array.isArray(criado.perfis) && criado.perfis.length === 2
      && criado.perfis.includes('oncologista') && criado.perfis.includes('auditor'),
      JSON.stringify(criado && criado.perfis));
    // O perfil ATIVO PADRÃO é o primeiro da lista normalizada — e a tabela o destaca.
    ok('A4 perfil ativo padrão é membro da lista', !!criado && criado.perfis.includes(criado.perfil),
      'padrão=' + (criado && criado.perfil));
    const linhaTxt = await pa.evaluate(l => {
      const tr = Array.from(document.querySelectorAll('tr')).find(t => t.textContent.includes(l));
      return tr ? tr.textContent.replace(/\s+/g, ' ') : '';
    }, LOGIN_X);
    ok('A5 a tabela de acessos mostra os dois perfis',
      /Oncologista/.test(linhaTxt) && /Auditor/.test(linhaTxt), linhaTxt.slice(0, 120));
    ok('A6 console limpo na tela de acessos', fa.errs.length === 0, fa.errs.join(' | '));
    await fa.ctx.close();

    // ═══ FASE 2 — UI do usuário de DOIS chapéus: o seletor e a troca ═══
    ctxX = await ctxLogin(browser, { login: LOGIN_X, senha: senhaX });
    const px = ctxX.page;
    tkXOnco = ctxX.tk;

    ok('B1 ★ usuário de DOIS perfis vê SELETOR no lugar do badge',
      await px.evaluate(() => !!document.getElementById('ub_perfil')));
    const opcoes = await px.evaluate(() =>
      Array.from(document.querySelectorAll('#ub_perfil option')).map(o => o.value));
    ok('B1 o seletor oferece exatamente os perfis da lista',
      opcoes.length === 2 && opcoes.includes('oncologista') && opcoes.includes('auditor'), opcoes.join(','));
    ok('B2 login entrega o perfil ativo PADRÃO',
      await px.evaluate(() => USUARIO.perfil) === 'oncologista');

    const abasOnco = await abasDe(px);
    ok('B3 como oncologista NÃO vê a aba Autorizações',
      !abasOnco.some(a => /Autoriza/.test(a)), abasOnco.join(','));

    // ---- a troca ----
    await px.selectOption('#ub_perfil', 'auditor');
    await trocaConcluida(px, 'auditor');
    ok('B4 ★ trocar para um perfil DA LISTA funciona', true, 'oncologista → auditor');
    const tkDepois = await px.evaluate(() => localStorage.getItem('oncoguia_token'));
    ok('B4 o token no localStorage é OUTRO (troca = token novo, não flag de tela)',
      !!tkDepois && tkDepois !== tkXOnco);
    tkXAud = tkDepois;

    const abasAud = await abasDe(px);
    ok('B5 ★ re-renderiza com as abas do perfil novo (Autorizações entra)',
      abasAud.some(a => /Autoriza/.test(a)), abasAud.join(','));
    ok('B5 o seletor reflete o perfil ativo depois da troca',
      await px.evaluate(() => document.getElementById('ub_perfil').value) === 'auditor');
    // A fila do auditor abre de verdade — trocar de chapéu não é só pintar a aba.
    await px.evaluate(() => go('autorizacoes'));
    await px.waitForFunction(() => view === 'autorizacoes' && AUT_LISTA !== null, null, { timeout: 25000 });
    ok('B6 a aba Autorizações do perfil novo carrega a fila', true);

    // ---- e de volta ----
    await px.selectOption('#ub_perfil', 'oncologista');
    await trocaConcluida(px, 'oncologista');
    const abasVolta = await abasDe(px);
    ok('B7 ★ trocar de volta devolve as abas do outro perfil (Autorizações sai)',
      !abasVolta.some(a => /Autoriza/.test(a)), abasVolta.join(','));
    tkXOnco = await px.evaluate(() => localStorage.getItem('oncoguia_token'));
    ok('B8 console limpo nas duas trocas', ctxX.errs.length === 0, ctxX.errs.join(' | '));

    // ═══ FASE 3 — texto livre: trocar com FORMULÁRIO ABERTO pede confirmação ═══
    await px.evaluate(() => go('lista'));
    await px.waitForSelector('button:has-text("+ Novo paciente")', { timeout: 25000 });
    await px.click('button:has-text("+ Novo paciente")');
    await px.waitForSelector('#f_nome', { timeout: 25000 });
    await px.fill('#f_nome', 'RASCUNHO QUE NAO PODE SUMIR CALADO');

    // 1) CANCELAR: a confirmação aparece, e nada muda.
    ctxX.dlg.acao = 'cancelar'; ctxX.dlg.ultima = '';
    await px.selectOption('#ub_perfil', 'auditor');
    await px.waitForTimeout(1200);
    ok('C1 ★ trocar com formulário aberto PEDE confirmação',
      /perfil/i.test(ctxX.dlg.ultima) && /perdid/i.test(ctxX.dlg.ultima), ctxX.dlg.ultima.slice(0, 120));
    ok('C1 a confirmação NOMEIA o que se perde (não é um "tem certeza?" genérico)',
      /cadastro de paciente/i.test(ctxX.dlg.ultima), ctxX.dlg.ultima.slice(0, 120));
    ok('C2 ★ cancelar NÃO troca o perfil',
      await px.evaluate(() => USUARIO.perfil) === 'oncologista');
    ok('C2 cancelar devolve o seletor ao perfil ativo de verdade',
      await px.evaluate(() => document.getElementById('ub_perfil').value) === 'oncologista');
    const rasc = await px.evaluate(() => ({
      view, temEstado: !!CADASTRO, temCampo: !!document.getElementById('f_nome'),
      valor: (document.getElementById('f_nome') || {}).value || '',
    }));
    ok('C2 cancelar preserva o rascunho digitado',
      rasc.temEstado && rasc.temCampo && /RASCUNHO QUE NAO PODE SUMIR/.test(rasc.valor),
      JSON.stringify(rasc));

    // 2) ACEITAR: aí sim troca.
    ctxX.dlg.acao = 'aceitar'; ctxX.dlg.ultima = '';
    await px.selectOption('#ub_perfil', 'auditor');
    await trocaConcluida(px, 'auditor');
    ok('C3 confirmar troca de verdade', true);
    ok('C3 o rascunho abandonado não sobrevive à troca',
      await px.evaluate(() => CADASTRO === null));

    // Sem formulário aberto NÃO pode perguntar nada — aviso que aparece sempre é aviso
    // que se aprende a clicar sem ler, e aí o da Fase 3 também some.
    ctxX.dlg.acao = 'cancelar'; ctxX.dlg.ultima = '';
    await px.selectOption('#ub_perfil', 'oncologista');
    await trocaConcluida(px, 'oncologista');
    ok('C4 ★ sem rascunho aberto, a troca NÃO pergunta nada', ctxX.dlg.ultima === '', ctxX.dlg.ultima);
    tkXOnco = await px.evaluate(() => localStorage.getItem('oncoguia_token'));
    // A UI acabou aqui: a Fase 4 é só API, com os tokens já em mãos. Fechar agora encurta
    // a vida do browser e tira o `close()` do caminho crítico do veredito.
    await ctxX.ctx.close(); ctxX = null;

    // ═══ FASE 4 — API: o que a tela não pode garantir ═══
    // ---- troca: a lista é a fronteira, e quem a aplica é o servidor ----
    const semTk = await req('POST', '/auth/trocar-perfil', null, { perfil: 'auditor' });
    ok('P1 trocar de perfil sem token → 401', semTk.status === 401, String(semTk.status));
    const fora = await req('POST', '/auth/trocar-perfil', tkXOnco, { perfil: 'gestor' });
    ok('P2 ★ trocar para perfil FORA da lista → 403 (por API direta, JWT válido)',
      fora.status === 403, `${fora.status} ${fora.body && fora.body.message}`);
    const invalido = await req('POST', '/auth/trocar-perfil', tkXOnco, { perfil: 'chefe' });
    ok('P3 perfil fora do vocabulário → 400', invalido.status === 400, String(invalido.status));
    const trocaOk = await req('POST', '/auth/trocar-perfil', tkXOnco, { perfil: 'auditor' });
    ok('P4 trocar para perfil DA lista → token novo com o perfil pedido',
      trocaOk.status === 201 && trocaOk.body.usuario.perfil === 'auditor' && !!trocaOk.body.access_token,
      `${trocaOk.status} ${trocaOk.body && trocaOk.body.usuario && trocaOk.body.usuario.perfil}`);
    tkXAud = trocaOk.body.access_token;

    // ---- MATRIZ POR PERFIL ATIVO: a mesma pessoa, dois tokens ----
    // Este é o coração do desenho. Nada afrouxa por a pessoa "ter" o outro chapéu: o que
    // vale é o que ela está VESTINDO. Se algum guard passasse a olhar a LISTA, os dois
    // checks abaixo virariam 200 e o portão pegaria na hora.
    ok('P5 ★ com o chapéu de ONCOLOGISTA, a fila de autorizações é 403',
      (await req('GET', '/autorizacoes', tkXOnco)).status === 403);
    ok('P5 ★ com o chapéu de AUDITOR, a MESMA PESSOA entra na fila (200)',
      (await req('GET', '/autorizacoes', tkXAud)).status === 200);
    ok('P6 ★ com o chapéu de AUDITOR ela NÃO cria avaliação (403)',
      (await req('POST', `/pacientes/1/avaliacoes`, tkXAud, avaliacaoBase(RID_INC))).status === 403);
    ok('P7 nenhum dos dois chapéus lê dinheiro (403 em /custos)',
      (await req('GET', '/custos', tkXOnco)).status === 403
      && (await req('GET', '/custos', tkXAud)).status === 403);
    ok('P8 nenhum dos dois chapéus lista usuários (403 — admin não está na lista dela)',
      (await req('GET', '/usuarios', tkXOnco)).status === 403
      && (await req('GET', '/usuarios', tkXAud)).status === 403);

    // ---- REGRA DE CONFLITO: ninguém decide a própria solicitação ----
    const pac = await req('POST', '/pacientes', tkXOnco, {
      nome: NOME_PACIENTE, identificador: 'TESTE-PORTAO-PERFIS', sexo: 'F', tumor: 'mama',
    });
    pacienteId = pac.body && pac.body.id;
    ok('K1 paciente de teste criado pelo chapéu de oncologista', !!pacienteId, `${pac.status} id=${pacienteId}`);
    const propria = await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkXOnco,
      avaliacaoBase(RID_NAO_INC, { detalhe_semaforo: { ressalva: JUST_TESTE } }));
    ok('K2 seleção de não incorporado nasce PENDENTE',
      propria.body && propria.body.autorizacao_estado === 'pendente',
      `${propria.status} ${propria.body && propria.body.autorizacao_estado}`);
    const idPropria = propria.body.id;

    // A solicitação DELA aparece na fila DELA — ou seja, o conflito é alcançável, e não
    // está sendo "prevenido" por a fila simplesmente não mostrar o cartão.
    const filaX = await req('GET', '/autorizacoes', tkXAud);
    ok('K3 a própria solicitação ESTÁ na fila do chapéu de auditor dela',
      (filaX.body || []).some(a => a.id === idPropria));
    const autoDecisao = await req('POST', `/autorizacoes/${idPropria}/decidir`, tkXAud,
      { decisao: 'aprovada', parecer: PARECER_TESTE });
    ok('K4 ★★ REGRA DE CONFLITO: trocar de chapéu NÃO deixa decidir a própria solicitação (403)',
      autoDecisao.status === 403, `${autoDecisao.status} ${autoDecisao.body && autoDecisao.body.message}`);
    ok('K4 a recusa DIZ que é conflito (mensagem clara, não "acesso negado")',
      /conflito/i.test((autoDecisao.body && autoDecisao.body.message) || ''),
      (autoDecisao.body && autoDecisao.body.message) || '');
    const aindaPendente = await req('GET', '/autorizacoes', tkXAud);
    ok('K5 a solicitação continua PENDENTE depois da recusa (nada foi gravado)',
      (aindaPendente.body || []).some(a => a.id === idPropria && a.estado === 'pendente'));

    // ---- e OUTRO auditor decide normalmente: a regra é sobre PESSOA, não sobre a fila ----
    tkAud = await tokenApi(API, 'auditor');
    const outraDecisao = await req('POST', `/autorizacoes/${idPropria}/decidir`, tkAud,
      { decisao: 'negada', parecer: PARECER_TESTE });
    ok('K6 ★ OUTRO auditor decide a mesma solicitação normalmente',
      outraDecisao.status === 201 && outraDecisao.body.estado === 'negada',
      `${outraDecisao.status} ${outraDecisao.body && outraDecisao.body.estado}`);
    ok('K6 a decisão registra o perfil ATIVO de quem decidiu',
      outraDecisao.body.auditor && outraDecisao.body.auditor.perfil === 'auditor',
      JSON.stringify(outraDecisao.body.auditor));
    ok('K7 ★ o pedido guarda o chapéu com que foi FEITO (oncologista), não o de hoje',
      outraDecisao.body.solicitante && outraDecisao.body.solicitante.perfil === 'oncologista',
      JSON.stringify(outraDecisao.body.solicitante));

    // ---- retirar um perfil corta o token que o usava, sem esperar expirar ----
    const semAuditor = await req('PATCH', `/usuarios/${usuarioXId}`, tkAdm, { perfis: ['oncologista'] });
    ok('P9 admin retira um perfil da lista', semAuditor.status === 200
      && JSON.stringify(semAuditor.body.perfis) === JSON.stringify(['oncologista']),
      JSON.stringify(semAuditor.body && semAuditor.body.perfis));
    ok('P10 ★ o token que usava o perfil retirado deixa de valer NA HORA (401)',
      (await req('GET', '/autorizacoes', tkXAud)).status === 401);
    ok('P10 o token do perfil que ela AINDA tem continua valendo',
      (await req('GET', '/pacientes', tkXOnco)).status === 200);
    ok('P11 e trocar para o perfil retirado agora é 403',
      (await req('POST', '/auth/trocar-perfil', tkXOnco, { perfil: 'auditor' })).status === 403);

    // ---- trava anti-lockout ----
    const eu = await req('GET', '/auth/perfil', tkAdm);
    const meuId = eu.body && eu.body.id;
    const lockout = await req('PATCH', `/usuarios/${meuId}`, tkAdm, { perfis: ['oncologista'] });
    ok('P12 ★ admin NÃO remove o próprio perfil de admin (trava anti-lockout, 400)',
      lockout.status === 400, `${lockout.status} ${lockout.body && lockout.body.message}`);
    ok('P12 e continua admin depois da tentativa',
      (await req('GET', '/usuarios', tkAdm)).status === 200);
  } catch (e) {
    // Diálogos e erros de console da sessão do usuário de dois chapéus entram no relatório
    // da exceção: um timeout de waitForFunction sozinho não diz NADA sobre a causa, e a
    // causa costuma estar num alert() que o portão aceitou sem mostrar a ninguém.
    if (ctxX) {
      console.log('  diálogos:', JSON.stringify(ctxX.dlg.todos));
      console.log('  console:', JSON.stringify(ctxX.errs));
    }
    ok('EXCEÇÃO no portão', false, e.message);
  } finally {
    // Regra dos portões: devolver o banco como encontrou, SEMPRE. Aqui o portão só CRIA
    // (um paciente e um usuário), nunca altera registro preexistente — então devolver
    // como encontrou é apagar os dois. No finally de propósito: check que estoura no meio
    // não pode deixar um usuário de teste com acesso vivo no banco.
    if (ctxX) { try { await ctxX.ctx.close(); } catch (_) { } }

    if (pacienteId) {
      try {
        const del = await req('DELETE', `/pacientes/${pacienteId}`, tkAdm || await tokenApi(API, 'admin'));
        ok('Z limpeza: paciente de teste removido', del.status === 200 || del.status === 204, String(del.status));
      } catch (e) { ok('Z limpeza: paciente de teste removido', false, e.message); }
    }
    if (usuarioXId) {
      try {
        const del = await req('DELETE', `/usuarios/${usuarioXId}`, tkAdm || await tokenApi(API, 'admin'));
        ok('Z limpeza: usuário de teste removido', del.status === 200 || del.status === 204, String(del.status));
      } catch (e) { ok('Z limpeza: usuário de teste removido', false, e.message); }
    }
    // `browser.close()` com PRAZO. Numa execução ele pendurou depois de todos os checks já
    // impressos: 52 PASS na tela e nenhum veredito — indistinguível, para quem lê, de um
    // portão que quebrou no meio. O `process.exit` abaixo leva o Chrome junto de qualquer
    // forma; o que não pode é o encerramento do browser decidir se o resultado aparece.
    await Promise.race([browser.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
    const falhas = R.filter(r => !r[0]).length;
    console.log(`\n${R.length - falhas}/${R.length} checks passaram` + (falhas ? ` — ${falhas} FALHA(S)` : ' — portão OK'));
    process.exit(falhas ? 1 : 0);
  }
})();
