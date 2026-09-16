// Portão da EXTRAÇÃO DE PRONTUÁRIO (entrega 2) — PDF → cabeçalho + raspagem no navegador
// → POST /importacao/extrair → formulário guiado → proposta.
//
//  Z0  varredura de resíduo + conta de secretaria descartável (API, admin).
//  P   PDF REAL do J.M.G.M. (dev only — `PORTAO_PDF_JMGM`, default ~/Downloads/paciente
//      exemplo.pdf; NÃO entra no repo): lido pela TELA da secretaria com pdf.js; cabeçalho
//      determinístico (iniciais J.M.G.M., atendimento 2525705, nascimento, sexo, convênio,
//      peso/altura, tipo de tumor); RASPAGEM AFIRMATIVA — o texto original (extraído aqui
//      no portão, pelo mesmo pdf.js, e que fica só no portão) CONTÉM nome, atendimento,
//      prontuário e nascimento, e o texto raspado NÃO contém nenhum deles; o estado da app
//      não guarda nome completo nem texto original.
//  A   API: 403 fora da whitelist (oncologista, revisor), 400 tumor inválido / texto curto,
//      503 SEM CHAVE — provado num backend efêmero subido pelo portão em outra porta com
//      ANTHROPIC_API_KEY vazia (o de 3005 fica como está).
//  E   extração REAL (custa centavos): com a chave em backend/.env, clica "Extrair dados
//      clínicos (IA)" — todo campo tem trecho, todo trecho está literalmente no texto
//      raspado, valores no vocabulário, e o esperado aparece (gleason 9, T3b). SEM chave
//      os checks E ficam VERMELHOS de propósito — não passam vazios.
//  D   evolucao-demo.pdf (sintética, no repo): mesmo caminho; com chave, a extração tem de
//      trazer o caminho feliz da demo (metastático, sensível à castração, nega convulsão,
//      Enzalutamida mCSPC) → enviar proposta → oncologista valida por API → VIGENTE.
//  Z   limpeza (pacientes, usuária) provada relendo a carteira.
//
// Logins: admin (API), secretaria (API + tela), oncologista (API), revisor (API) = 5.
// Uso: node scripts/portao-extracao.js
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const { tokenApi, loginNaTela } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';
const PDF_JMGM = process.env.PORTAO_PDF_JMGM || path.join(process.env.HOME || '', 'Downloads', 'paciente exemplo.pdf');
const PDF_DEMO = path.join(ROOT, 'scripts', 'exemplos', 'evolucao-demo.pdf');
const PORTA_SEM_CHAVE = Number(process.env.PORTAO_PORTA_SEM_CHAVE || 3016);
const TEM_CHAVE = !!(process.env.ANTHROPIC_API_KEY || '').trim();

const ETIQUETA = Date.now().toString(36);
const IDENT_PREFIXO = 'TESTE-PORTAO-EXT';
const LOGIN_PREFIXO = 'portao.ext.';
const LOGIN_S = `${LOGIN_PREFIXO}${ETIQUETA}`;
const NOME_S = `Portao Extracao Secretaria ${ETIQUETA}`;

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 220) + ']' : '')); };
async function req(metodo, rota, tk, body, base = API) {
  const r = await fetch(base + rota, {
    method: metodo,
    headers: Object.assign(tk ? { Authorization: 'Bearer ' + tk } : {}, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch (_) { }
  return { status: r.status, body: j };
}
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '');

async function ctxLogin(browser, quem) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  page.on('dialog', async d => d.accept());
  await page.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);
  await page.goto(APP);
  await loginNaTela(page, quem);
  await page.waitForFunction(() => !!localStorage.getItem('oncoguia_token'), null, { timeout: 25000 });
  await page.waitForSelector('#nav a', { timeout: 25000 });
  const tk = await page.evaluate(() => localStorage.getItem('oncoguia_token'));
  return { ctx, page, errs, tk };
}
// Texto ORIGINAL do PDF, extraído pelo MESMO pdf.js da app — mas devolvido ao portão e
// nunca guardado na app. É a contraprova afirmativa da raspagem.
async function textoOriginal(page, arquivo) {
  const b64 = fs.readFileSync(arquivo).toString('base64');
  return page.evaluate(async b => { const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return pdfParaTexto(u.buffer); }, b64);
}
async function abrirImportar(page) {
  await page.evaluate(() => { CADASTRO = null; IMP = null; go('lista'); });
  await page.waitForSelector('button:has-text("+ Novo paciente")', { timeout: 25000 });
  await page.click('button:has-text("+ Novo paciente")');
  await page.waitForSelector('#cad_modo_importar', { timeout: 10000 });
  await page.click('#cad_modo_importar');
  await page.waitForSelector('#imp_pdf', { timeout: 15000 });
}
async function lerPdfNaTela(page, arquivo) {
  await page.setInputFiles('#imp_pdf', arquivo);
  await page.waitForFunction(() => IMP && IMP.pdf && typeof IMP.pdf.raspado === 'string', null, { timeout: 30000 });
  return page.evaluate(() => ({ cab: IMP.pdf.cab, raspado: IMP.pdf.raspado, removidos: IMP.pdf.removidos, chaves: Object.keys(IMP.pdf), tumor: IMP.tumor,
    form: { nome: document.getElementById('f_nome').value, ident: document.getElementById('f_ident').value, nasc: document.getElementById('f_nasc').value, sexo: document.getElementById('f_sexo').value, oper: document.getElementById('f_oper').value, plano: document.getElementById('f_plano').value, peso: document.getElementById('f_peso').value, altura: document.getElementById('f_altura').value } }));
}
async function extrairNaTela(page) {
  await page.waitForSelector('#imp_extrair:not([disabled])', { timeout: 10000 });
  await page.click('#imp_extrair');
  await page.waitForFunction(() => (IMP.pdf && IMP.pdf.extraido) || /✖/.test((document.getElementById('imp_extrair_status') || {}).textContent || ''), null, { timeout: 180000 });
  return page.evaluate(() => ({ extraido: IMP.pdf.extraido, descartados: IMP.pdf.descartados, campos: IMP.campos, trechos: IMP.trechos, regimen_id: IMP.regimen_id, meta: IMP.meta, status: (document.getElementById('imp_extrair_status') || {}).textContent || '', raspado: IMP.pdf.raspado }));
}
function checarTrechos(nome, ext) {
  const campos = Object.keys(ext.campos || {});
  const semTrecho = campos.filter(c => !(ext.trechos[c] || '').trim());
  const foraDoTexto = campos.filter(c => ext.trechos[c] && !norm(ext.raspado).includes(norm(ext.trechos[c])));
  ok(`${nome} ★★ TODO campo extraído tem trecho, e TODO trecho está LITERALMENTE no texto raspado (${campos.length} campos)`,
    campos.length > 0 && semTrecho.length === 0 && foraDoTexto.length === 0, `semTrecho=${semTrecho.join(',') || '-'} foraDoTexto=${foraDoTexto.join(',') || '-'}`);
  ok(`${nome} nenhum trecho contém "[REMOVIDO]" nem identificador (o modelo só viu texto raspado)`,
    campos.every(c => !/REMOVIDO/.test(ext.trechos[c] || '')));
  console.log(`      ${nome} extraído: ${JSON.stringify(ext.campos)} regimen=${ext.regimen_id || '-'} meta=${JSON.stringify({ ev: ext.meta.data_evolucao, ret: ext.meta.proximo_retorno, ini: ext.meta.data_inicio, med: ext.meta.medico_assistente_texto })}`);
  if (ext.descartados && ext.descartados.length) console.log(`      ${nome} descartados pelo servidor: ${JSON.stringify(ext.descartados).slice(0, 400)}`);
}

(async () => {
  exigirBancoDeDev('extração de prontuário (PDF → cabeçalho + raspagem no navegador → IA → proposta)');
  console.log(`= Chave da Anthropic no backend/.env: ${TEM_CHAVE ? 'SIM (extração real será executada — custa centavos)' : 'NÃO — os checks de extração real ficarão VERMELHOS'}`);
  console.log(`= PDF real (dev, fora do repo): ${PDF_JMGM} ${fs.existsSync(PDF_JMGM) ? '(encontrado)' : '(NÃO ENCONTRADO)'}`);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let tkAdm = null, tkSec = null, tkOnco = null, tkRev = null;
  let usuarioSId = null, senhaS = null;
  const pacientes = [];
  let ctxS = null, semChave = null;

  try {
    // ═══ Z0 ═══
    tkAdm = await tokenApi(API, 'admin');
    {
      const todos = await req('GET', '/pacientes', tkAdm);
      for (const p of (todos.body || []).filter(p => String(p.identificador || '').startsWith(IDENT_PREFIXO))) {
        const del = await req('DELETE', `/pacientes/${p.id}`, tkAdm);
        console.log(`AVISO: resíduo de rodada anterior removido — id=${p.id} reg=${p.identificador} → ${del.status}`);
      }
      const us = await req('GET', '/usuarios', tkAdm);
      for (const u of (us.body || []).filter(u => String(u.login || '').startsWith(LOGIN_PREFIXO))) {
        const del = await req('DELETE', `/usuarios/${u.id}`, tkAdm);
        console.log(`AVISO: usuária de rodada anterior removida — ${u.login} → ${del.status}`);
      }
      const sobra = ((await req('GET', '/pacientes', tkAdm)).body || []).filter(p => String(p.identificador || '').startsWith(IDENT_PREFIXO));
      ok('Z0 varredura: nenhum resíduo deste portão', sobra.length === 0);
    }
    const cu = await req('POST', '/usuarios', tkAdm, { nome: NOME_S, login: LOGIN_S, perfis: ['secretaria'] });
    usuarioSId = cu.body && cu.body.id; senhaS = cu.body && cu.body.senha_temporaria;
    ok('Z0 conta de secretaria descartável criada', cu.status === 201 && !!usuarioSId && !!senhaS);
    tkSec = (await req('POST', '/auth/login', null, { login: LOGIN_S, senha: senhaS })).body.access_token;
    tkOnco = await tokenApi(API, 'oncologista');
    tkRev = await tokenApi(API, 'revisor');

    // ═══ A — API ═══
    const TXT = 'Texto de teste com mais de quarenta caracteres para passar do mínimo da rota.';
    ok('A1 ★ /importacao/extrair: 403 para oncologista e revisor (whitelist literal secretaria/admin)',
      (await req('POST', '/importacao/extrair', tkOnco, { tumor: 'prostata', texto_raspado: TXT })).status === 403
      && (await req('POST', '/importacao/extrair', tkRev, { tumor: 'prostata', texto_raspado: TXT })).status === 403);
    const tRuim = await req('POST', '/importacao/extrair', tkSec, { tumor: 'inexistente', texto_raspado: TXT });
    const tCurto = await req('POST', '/importacao/extrair', tkSec, { tumor: 'prostata', texto_raspado: 'curto' });
    ok('A2 400 em tumor fora do corpus e em texto curto demais', tRuim.status === 400 && tCurto.status === 400, `${tRuim.status}/${tCurto.status}`);
    // 503 sem chave: backend efêmero em outra porta, mesma base de DEV, chave vazia.
    {
      const env = Object.assign({}, process.env, { PORT: String(PORTA_SEM_CHAVE), ANTHROPIC_API_KEY: '' });
      delete env.NODE_ENV;
      semChave = spawn('node', ['dist/main'], { cwd: path.join(ROOT, 'backend'), env, stdio: ['ignore', 'pipe', 'pipe'] });
      let saida = '';
      semChave.stdout.on('data', d => { saida += d.toString(); });
      semChave.stderr.on('data', d => { saida += d.toString(); });
      const t0 = Date.now();
      while (!/rodando em/.test(saida) && Date.now() - t0 < 40000) await new Promise(r => setTimeout(r, 500));
      const base2 = `http://localhost:${PORTA_SEM_CHAVE}/api`;
      const login2 = await req('POST', '/auth/login', null, { login: LOGIN_S, senha: senhaS }, base2);
      const tk2 = login2.body && login2.body.access_token;
      const r503 = await req('POST', '/importacao/extrair', tk2, { tumor: 'prostata', texto_raspado: TXT }, base2);
      ok('A3 ★ backend SEM ANTHROPIC_API_KEY: /importacao/extrair = 503 com instrução clara', r503.status === 503 && /ANTHROPIC_API_KEY/.test(r503.body && r503.body.message || ''), `${r503.status} ${r503.body && r503.body.message}`);
      const voc2 = await req('GET', '/importacao/vocabulario', tk2, null, base2);
      ok('A3 …e o resto da importação continua de pé no mesmo backend (vocabulário 200)', voc2.status === 200);
      semChave.kill('SIGTERM'); semChave = null;
    }

    // ═══ P — PDF REAL, tela da secretaria ═══
    ctxS = await ctxLogin(browser, { login: LOGIN_S, senha: senhaS });
    const ps = ctxS.page;
    if (!fs.existsSync(PDF_JMGM)) {
      ok('P0 PDF real do J.M.G.M. disponível em dev (PORTAO_PDF_JMGM)', false, PDF_JMGM);
    } else {
      await abrirImportar(ps);
      ok('P0 modo Importar tem o campo "Ler PDF"', !!(await ps.$('#imp_pdf')) && /Ler PDF da evolução/i.test(await ps.evaluate(() => document.getElementById('app').innerText)));
      const original = await textoOriginal(ps, PDF_JMGM);
      const ids = ['Jose', 'Mauricio', 'Goncalves', 'Mota', '2.525.705', '2525705', '92.027', '92027', '08/02/1958', '1958-02-08'];
      const noOriginal = ids.filter(t => original.includes(t));
      ok('P1 ★ contraprova: o texto ORIGINAL do PDF contém nome, atendimento, prontuário e nascimento', noOriginal.length >= 7, `presentes=${noOriginal.length}/${ids.length}`);
      const L = await lerPdfNaTela(ps, PDF_JMGM);
      ok('P2 ★ cabeçalho determinístico: iniciais J.M.G.M., atendimento 2525705, nascimento 1958-02-08, sexo M, Unimed / Única, peso 110,5, altura 171, tumor Próstata',
        L.cab.iniciais === 'J.M.G.M.' && L.form.nome === 'J.M.G.M.' && L.form.ident === '2525705' && L.form.nasc === '1958-02-08' && L.form.sexo === 'M'
        && L.form.oper === 'Unimed' && /Única/.test(L.form.plano) && /110[.,]5/.test(L.form.peso) && L.form.altura === '171' && L.tumor === 'prostata',
        JSON.stringify(L.form) + ` tumor=${L.tumor}`);
      ok('P2 cabeçalho traz também data da evolução 28/08/2026, retorno 25/09/2026 e a médica da assinatura',
        L.cab.data_evolucao_br === '28/08/2026' && L.cab.retorno_br === '25/09/2026' && /Kenia/.test(L.cab.medico || ''), JSON.stringify({ ev: L.cab.data_evolucao_br, ret: L.cab.retorno_br, med: L.cab.medico }));
      const sobraram = ids.filter(t => L.raspado.includes(t));
      ok('P3 ★★ RASPAGEM: o texto raspado NÃO contém nome (nem por token), atendimento (com/sem pontos), prontuário nem nascimento; removidos > 0',
        sobraram.length === 0 && L.removidos > 0 && /\[REMOVIDO\]/.test(L.raspado), `sobraram=${sobraram.join(',') || '-'} removidos=${L.removidos}`);
      ok('P3 ★ o estado da app NÃO guarda nome completo nem texto original (só iniciais + texto raspado)',
        !L.chaves.includes('original') && !('nome_completo' in L.cab) && !/Mauricio/.test(JSON.stringify(L.cab)), L.chaves.join(','));
      ok('P3 o texto raspado está na tela ("Isto será enviado para análise") ANTES de qualquer clique', await ps.evaluate(() => !!document.getElementById('imp_raspado') && /Isto será enviado para análise/.test(document.getElementById('app').innerText)));
      const naNarrativa = ['GLEASON 4+5=9', 'T3b', 'Enzalutamida', '0,02'];
      ok('P3 a narrativa clínica sobrevive à raspagem (Gleason, T3b, Enzalutamida, PSA)', naNarrativa.every(t => L.raspado.includes(t)));

      // ═══ E — extração REAL no J.M.G.M. ═══
      if (!TEM_CHAVE) {
        ok('E0 ★ extração real executada (exige ANTHROPIC_API_KEY em backend/.env) — SEM CHAVE, NÃO EXECUTADA', false, 'configure a chave e rode de novo');
      } else {
        const E = await extrairNaTela(ps);
        ok('E1 ★ extração respondeu e preencheu o formulário', !!E.extraido && !/✖/.test(E.status), E.status);
        checarTrechos('E2', E);
        ok('E3 ★ o esperado apareceu: gleason = 9 e estadio_t = T3b, cada um com trecho', E.campos.gleason === 9 && E.campos.estadio_t === 'T3b' && !!E.trechos.gleason && !!E.trechos.estadio_t, JSON.stringify({ g: E.campos.gleason, t: E.campos.estadio_t }));
        ok('E3 ★ não inventou: convulsao_previa AUSENTE (o texto não fala em convulsão) e quimio_naive ausente', !('convulsao_previa' in E.campos) && !('quimio_naive' in E.campos), Object.keys(E.campos).join(','));
        ok('E4 meta: evolução 2026-08-28 e retorno 2026-09-25 (da extração ou do cabeçalho determinístico)', E.meta.data_evolucao === '2026-08-28' && E.meta.proximo_retorno === '2026-09-25', JSON.stringify(E.meta));
        // Envia a proposta como a secretaria faria e confere pelo GET do oncologista.
        await ps.fill('#f_ident', `${IDENT_PREFIXO}-JMGM-${ETIQUETA}`);
        await ps.evaluate(v => { CADASTRO.ident = v; }, `${IDENT_PREFIXO}-JMGM-${ETIQUETA}`);
        await ps.click('button:has-text("Cadastrar e enviar proposta")');
        await ps.waitForFunction(() => view === 'paciente' && current && IMP_PROP[current] && IMP_PROP[current].estado === 'pendente', null, { timeout: 30000 });
        const pJ = await ps.evaluate(() => current); if (pJ) pacientes.push(pJ);
        const gp = await req('GET', `/pacientes/${pJ}/importacao-proposta`, tkOnco);
        const pl = gp.body.proposta.payload;
        ok('E5 ★ proposta enviada com os campos e trechos da extração; todo trecho gravado está no texto raspado', gp.body.proposta.estado === 'pendente' && pl.campos.length === Object.keys(E.campos).length
          && pl.campos.every(c => c.trecho && norm(E.raspado).includes(norm(c.trecho))), `${pl.campos.length} campos`);
      }
    }

    // ═══ D — DEMO sintética ═══
    await abrirImportar(ps);
    const originalD = await textoOriginal(ps, PDF_DEMO);
    const idsD = ['Antonio', 'Carlos', 'Ferreira', 'Lima', '1.234.567', '1234567', '45.678', '45678', '12/03/1957', '99876-5432'];
    ok('D1 contraprova: a demo sintética contém os identificadores fictícios', idsD.filter(t => originalD.includes(t)).length >= 8);
    const LD = await lerPdfNaTela(ps, PDF_DEMO);
    ok('D2 ★ demo: cabeçalho → A.C.F.L., 1234567, 1957-03-12, M, Unimed / Pleno, 82,4 kg, 175 cm, tumor Próstata, retorno 08/10/2026, Dra. Helena',
      LD.form.nome === 'A.C.F.L.' && LD.form.ident === '1234567' && LD.form.nasc === '1957-03-12' && LD.form.sexo === 'M' && LD.form.oper === 'Unimed' && LD.form.plano === 'Pleno'
      && /82[.,]4/.test(LD.form.peso) && LD.form.altura === '175' && LD.tumor === 'prostata' && LD.cab.retorno_br === '08/10/2026' && /Helena/.test(LD.cab.medico || ''),
      JSON.stringify(LD.form) + ` ${LD.cab.retorno_br} ${LD.cab.medico}`);
    const sobraD = idsD.filter(t => LD.raspado.includes(t));
    ok('D3 ★★ demo: raspagem zera nome, atendimento, prontuário, nascimento e telefone', sobraD.length === 0 && LD.removidos > 0, `sobraram=${sobraD.join(',') || '-'} removidos=${LD.removidos}`);
    if (!TEM_CHAVE) {
      ok('D4 ★ extração real na demo — SEM CHAVE, NÃO EXECUTADA', false, 'configure ANTHROPIC_API_KEY em backend/.env');
    } else {
      const ED = await extrairNaTela(ps);
      ok('D4 ★ demo: extração respondeu', !!ED.extraido && !/✖/.test(ED.status), ED.status);
      checarTrechos('D5', ED);
      ok('D6 ★★ demo (caminho feliz): metastatico = true, sensivel_castracao = true, convulsao_previa = false, gleason = 8, estadio_t = T3a',
        ED.campos.metastatico === true && ED.campos.sensivel_castracao === true && ED.campos.convulsao_previa === false && ED.campos.gleason === 8 && ED.campos.estadio_t === 'T3a', JSON.stringify(ED.campos));
      ok('D6 ★ demo: protocolo sugerido = Enzalutamida mCSPC (regimen_id prostata-mcspc-enzalutamida)', ED.regimen_id === 'prostata-mcspc-enzalutamida', ED.regimen_id || '-');
      ok('D6 demo: meta com evolução 2026-09-10, retorno 2026-10-08, início 2026-02-05, médica Helena', ED.meta.data_evolucao === '2026-09-10' && ED.meta.proximo_retorno === '2026-10-08' && ED.meta.data_inicio === '2026-02-05' && /Helena/.test(ED.meta.medico_assistente_texto || ''), JSON.stringify(ED.meta));
      await ps.fill('#f_ident', `${IDENT_PREFIXO}-DEMO-${ETIQUETA}`);
      await ps.evaluate(v => { CADASTRO.ident = v; }, `${IDENT_PREFIXO}-DEMO-${ETIQUETA}`);
      await ps.click('button:has-text("Cadastrar e enviar proposta")');
      await ps.waitForFunction(() => view === 'paciente' && current && IMP_PROP[current] && IMP_PROP[current].estado === 'pendente', null, { timeout: 30000 });
      const pD = await ps.evaluate(() => current); if (pD) pacientes.push(pD);
      const gpD = await req('GET', `/pacientes/${pD}/importacao-proposta`, tkOnco);
      const val = await req('POST', `/importacao-propostas/${gpD.body.proposta.id}/validar`, tkOnco, {});
      ok('D7 ★★ demo de ponta a ponta: oncologista valida a proposta extraída → VERDE, Enzalutamida mCSPC VIGENTE, retorno 08/10/2026',
        val.status === 201 && val.body.vigente === true && val.body.avaliacao && val.body.avaliacao.regimen_id === 'prostata-mcspc-enzalutamida' && val.body.retorno && val.body.retorno.proximo_retorno === '2026-10-08',
        `${val.status} vigente=${val.body && val.body.vigente} motivo=${val.body && val.body.motivo}`);
    }
    ok('U console da secretaria sem erro', ctxS.errs.length === 0, JSON.stringify(ctxS.errs));
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e.message);
  } finally {
    if (semChave) { try { semChave.kill('SIGTERM'); } catch (_) { } }
    if (ctxS) { try { await ctxS.ctx.close(); } catch (_) { } }
    const tk = tkAdm || await tokenApi(API, 'admin').catch(() => null);
    for (const pid of pacientes) {
      try {
        let del = await req('DELETE', `/pacientes/${pid}`, tk);
        if (del.status >= 500) { await new Promise(r => setTimeout(r, 2000)); del = await req('DELETE', `/pacientes/${pid}`, tk); }
        ok(`Z limpeza: paciente ${pid} removido`, del.status === 200 || del.status === 204, String(del.status));
      } catch (e) { ok(`Z limpeza: paciente ${pid} removido`, false, e.message); }
    }
    if (usuarioSId) {
      try { const del = await req('DELETE', `/usuarios/${usuarioSId}`, tk); ok('Z limpeza: usuária de teste removida', del.status === 200 || del.status === 204, String(del.status)); }
      catch (e) { ok('Z limpeza: usuária de teste removida', false, e.message); }
    }
    try {
      const sobra = ((await req('GET', '/pacientes', tk)).body || []).filter(p => String(p.identificador || '').startsWith(IDENT_PREFIXO));
      ok('Z limpeza provada: carteira sem paciente deste portão', sobra.length === 0, `sobra=${sobra.length}`);
    } catch (e) { ok('Z limpeza provada', false, e.message); }
    await Promise.race([browser.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
    const falhas = R.filter(r => !r[0]).length;
    console.log(`\n${R.length - falhas}/${R.length} checks passaram` + (falhas ? ` — ${falhas} FALHA(S)` : ' — portão OK'));
    process.exit(falhas ? 1 : 0);
  }
})();
