// Portão do lote 4 + salivar (run 2026-09-17-intake-revisao-4/v1) — SOMENTE LEITURA.
// O que prova, de ponta a ponta (API + browser isolado, sem o perfil do Opensquad):
//   L1 /evidencia serve o run do lote 4 (304 regimes) com o vocabulário novo de C&P
//      (tumor=glandula_salivar, histologia_salivar indeterminado) e os labels de colo-utero;
//   L2 KEYNOTE-A18 por estádio e CPS (III–IVA ∧ CPS≥1) no simulador, com o servidor em paridade;
//   L3 salivar: paciente glandula_salivar+metastático vê os 3 cards verdes; CEC os vê vermelhos;
//      histologia_salivar "Não informada" não trava;
//   L4 alçada do motivo (D1): oncologista vê "política institucional" e nenhuma nota no card do
//      toripalimabe; revisor vê "custo" + nota; PARP/AURELIA inalterados;
//   L5 pivôs: TCH = BCIRG-006, carbo+pacli = PATTERN (selo re_derivado); ovário beva com
//      evidência emergente e ainda "não incluído";
//   Z  nenhum POST/PUT/PATCH/DELETE; console limpo.
// Uso: node scripts/portao-lote4.js   (PORTAO_APP/PORTAO_API para produção; só leitura lá também)
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const { loginNaTela, tokenApi } = require('./portao-credenciais');
const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';
const T_COLO = 'colo-utero', T_CP = 'cabeca-pescoco', T_MAMA = 'mama', T_OV = 'ovario';
const ID_A18 = 'colo-qrt-io-keynote-a18', ID_TORI = 'cp-naso-toripalimabe-nao-incluido', ID_TCH = 'mama-neo-her2pos-ct1c-tch',
      ID_CARBO = 'mama-adj-her2neg-carbo-paclitaxel', ID_BEVA = 'ovario-resistente-bevacizumabe-nao-incluido', ID_PARP = 'prostata-mcrpc-1l-parp-nao-incorporado';
const SALIVAR = ['cp-salivar-met-cap', 'cp-salivar-met-carboplatina-paclitaxel', 'cp-salivar-met-cisplatina-vinorelbina'];
const MUDARAM = [ID_A18, ID_TORI, ID_TCH, ID_CARBO];
const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 220) + ']' : '')); };
async function req(rota, tk) { const r = await fetch(API + rota, { headers: { Authorization: 'Bearer ' + tk } }); return { status: r.status, body: await r.json().catch(() => null) }; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const escritas = [], errs = [];
  try {
    // ---- L1 (API) ----
    const tkRev = await tokenApi(API, 'revisor');
    const ev = await req('/evidencia', tkRev);
    const regs = ev.body.regimes;
    ok('L1 /evidencia serve o run do lote 4 (304 regimes, fonte 2026-09-17-intake-revisao-4)', ev.status === 200 && regs.length === 304 && /2026-09-17-intake-revisao-4/.test(ev.body._source.path), ev.body._source.path);
    const cpCP = ev.body.campos_primitivos[T_CP];
    const tumorCP = cpCP.find(s => s.campo === 'tumor'), histo = cpCP.find(s => s.campo === 'histologia_salivar');
    ok('L1 vocabulário C&P: tumor tem glandula_salivar (com rótulo) e histologia_salivar é enum com nao_informada indeterminado, estavel',
      tumorCP.opcoes.includes('glandula_salivar') && tumorCP.rotulos && !!tumorCP.rotulos.glandula_salivar && histo && histo.tipo === 'enum' && histo.opcoes[0] === 'nao_informada' && (histo.indeterminado || []).includes('nao_informada') && histo.estavel === true, JSON.stringify(histo && histo.rotulos).slice(0, 120));
    const cpColo = ev.body.campos_primitivos[T_COLO];
    ok('L1 colo-utero: labels novos (FIGO III–IVA; PD-L1 CPS ≥1)', /III–IVA/.test(cpColo.find(s => s.campo === 'estadio_iii_iv_locavancado').label) && /CPS/.test(cpColo.find(s => s.campo === 'pdl1_cps1').label));
    const tori = regs.find(r => r.regimen_id === ID_TORI);
    ok('L1 toripalimabe: incorporacao explícita (custo / motivo_publico politica_institucional / alçada 4 perfis), MCBS diverge 4×3, selo divergencia',
      tori.incorporacao && tori.incorporacao.status === 'nao_incorporado' && tori.incorporacao.motivo === 'custo' && tori.incorporacao.motivo_publico === 'politica_institucional' && (tori.incorporacao.alcada_motivo || []).length === 4
      && tori.verificacao.esmo_mcbs.status === 'diverge' && tori.verificacao.esmo_mcbs.valor_rederivado === '4' && tori.consolidacao.selo_confianca === 'divergencia', tori.consolidacao.selo_confianca);
    const resumo = (await req('/revisoes/resumo', tkRev)).body;
    const est = resumo.estados || {};
    const noHashAtual = MUDARAM.filter(rid => { const r = regs.find(x => x.regimen_id === rid); return est[rid] && est[rid].content_hash === r.content_hash && /aprovado|ajuste|contestado/.test(est[rid].estado || String(est[rid])); });
    ok('L1 /revisoes/resumo: nenhum dos 4 com hash novo tem decisão no hash ATUAL (pendente / pendente_re_revisao)', noHashAtual.length === 0, `hashes_carregados=${resumo.hashes_carregados}`);
    ok('L1 salivar: 3 regimes servidos, selo incompleto, pendentes (nunca revisados)', SALIVAR.every(id => { const r = regs.find(x => x.regimen_id === id); return r && r.consolidacao.selo_confianca === 'incompleto' && r.consolidacao.decisao_revisao === 'rederivado_aguarda_revisao' && !(est[id] && /aprovado|ajuste|contestado/.test(est[id].estado || '')); }));

    // ---- UI oncologista (somente leitura) ----
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
    page.on('dialog', d => d.accept());
    await page.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);
    await page.goto(APP);
    await loginNaTela(page, 'oncologista');
    await page.waitForSelector('#nav a', { timeout: 25000 });
    page.on('request', r => { const m = r.method(); if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') escritas.push(m + ' ' + r.url()); });
    await page.evaluate(() => go('simulador'));
    await page.waitForSelector('.sys-nav', { timeout: 15000 });
    const setTumor = async t => { await page.evaluate(t => { const g = agruparTumores(TUMORES).find(g => g.items.some(i => i.id === t)); toggleSysSim(g.id); setSimTumor(t); }, t); await page.waitForSelector('#sim-protos-live .proto', { timeout: 15000 }); };
    const sem = async rid => page.evaluate(id => { const el = document.getElementById('card-' + slug(id)); const s = el && el.querySelector('.semaphore'); return s ? (/s-green/.test(s.className) ? 'verde' : /s-red/.test(s.className) ? 'vermelho' : /s-amber/.test(s.className) ? 'amarelo' : 'classe?') + '|' + s.textContent.trim() : 'sem-card'; }, rid);
    const cardTxt = async rid => page.evaluate(id => { const el = document.getElementById('card-' + slug(id)); return el ? el.textContent.replace(/\s+/g, ' ') : 'sem-card'; }, rid);
    const setClin = async (obj) => page.evaluate(o => { Object.assign(SIM.clin, o); recalcSim(); }, obj);
    const clearClin = async () => page.evaluate(() => { for (const k of Object.keys(SIM.clin)) delete SIM.clin[k]; recalcSim(); });

    // L2 A18
    await setTumor(T_COLO);
    await clearClin(); await setClin({ tumor: 'colo_utero', estadio_iii_iv_locavancado: true, pdl1_cps1: false });
    ok('L2 ★ A18: FIGO III–IVA com CPS<1 = 🔴', /^vermelho/.test(await sem(ID_A18)), await sem(ID_A18));
    await setClin({ pdl1_cps1: true });
    ok('L2 ★ A18: FIGO III–IVA com CPS≥1 = 🟢', /^verde/.test(await sem(ID_A18)), await sem(ID_A18));
    await setClin({ estadio_iii_iv_locavancado: false });
    ok('L2 ★ A18: IB2–IIB (não III–IVA) com CPS≥1 = 🔴', /^vermelho/.test(await sem(ID_A18)), await sem(ID_A18));
    await clearClin(); await setClin({ tumor: 'colo_utero', estadio_iii_iv_locavancado: true });
    // No simulador, booleano não marcado vale false (comportamento existente; 🟡 só existe para enum com `indeterminado`).
    ok('L2 A18: CPS não marcado no simulador = 🔴 (booleano default false — comportamento existente do simulador)', /^vermelho/.test(await sem(ID_A18)), await sem(ID_A18));
    const a18txt = await cardTxt(ID_A18);
    ok('L2 A18: card mostra os critérios com os rótulos novos (III–IVA, CPS ≥1)', /III–IVA/.test(a18txt) && /CPS/.test(a18txt));

    // L3 salivar
    await setTumor(T_CP);
    await clearClin(); await setClin({ tumor: 'glandula_salivar', metastatico: true });
    const semsSal = []; for (const id of SALIVAR) semsSal.push(await sem(id));
    ok('L3 ★ glândula salivar metastática: os 3 regimes novos = 🟢 (histologia "Não informada" não trava)', semsSal.every(s => /^verde/.test(s)), semsSal.join(' · '));
    const v0 = await page.evaluate(t => clinValues(t, SIM.clin), T_CP);
    ok('L3 default de histologia_salivar = nao_informada', v0.histologia_salivar === 'nao_informada', JSON.stringify(v0).slice(0, 120));
    const widget = await page.evaluate(() => (document.getElementById('sim-form') || document.querySelector('.pf-grid') || document.body).innerText);
    ok('L3 widget usa o rótulo do dado: "Carcinoma de glândula salivar" e "Adenoide cístico" na tela', /gl[âa]ndula salivar/i.test(widget) && /Adenoide c[íi]stico/.test(widget));
    const capTxt = await cardTxt('cp-salivar-met-cap');
    ok('L3 card do CAP: pendente, acrescido pelo revisor, dose do Dreyfuss (500/50/50)', /500 mg\/m²/.test(capTxt) && /Licitra|Dreyfuss/.test(capTxt));
    await setClin({ tumor: 'cec_cabeca_pescoco' });
    const semsCec = []; for (const id of SALIVAR) semsCec.push(await sem(id));
    ok('L3 ★ CEC de cabeça e pescoço metastático: os 3 salivar = 🔴 (nenhuma regra antiga disparou para salivar, nenhuma nova dispara para CEC)', semsCec.every(s => /^vermelho/.test(s)), semsCec.join(' · '));

    // L4 alçada — oncologista
    await setClin({ tumor: 'nasofaringe', metastatico: true });
    const toriOnc = await cardTxt(ID_TORI);
    // O bloco de incorporação (pill + texto público + "Decisão de revisão clínica") vem antes dos eixos; "Custo 4/5" é o rótulo do eixo NCCN e está em todo card.
    const blocoInc = toriOnc.split(/GRADE/)[0];
    ok('L4 ★ oncologista vê o toripalimabe como "Não incorporado — política institucional"; o motivo custo não aparece no bloco de incorporação', /Não incorporado — política institucional/.test(blocoInc) && !/custo/i.test(blocoInc) && !/impacto orçamentário/i.test(toriOnc), blocoInc.slice(0, 220));
    ok('L4 ★ oncologista não vê "Notas da revisão clínica" no card do toripalimabe (a nota discute custo)', !/Notas da revisão clínica/.test(toriOnc));
    ok('L4 oncologista vê a evidência do card (JUPITER-02, OS)', /JUPITER-02/.test(toriOnc) && /sobrevida global|OS/i.test(toriOnc));
    const incOnc = await page.evaluate(ids => ids.map(id => { const r = REGIMES.find(x => x.regimen_id === id); const i = incorporacao(r); return id + '=' + i.motivoLabel; }), [ID_PARP, ID_BEVA]);
    ok('L4 cards antigos não incorporados seguem com o motivo de sempre (PARP refutado; AURELIA evidência insuficiente)', /refutado pela evidência/.test(incOnc[0]) && /evidência insuficiente/.test(incOnc[1]), incOnc.join(' | '));

    // L5 pivôs (mama, ovário)
    await setTumor(T_MAMA);
    await clearClin(); await setClin({ cenario: 'neoadjuvancia', her2: 'positivo', t: 'T1c' });
    const tchTxt = await cardTxt(ID_TCH);
    ok('L5 ★ TCH mostra "Fonte: BCIRG-006" (pivô novo) e não TRAIN-2 como fonte', /Fonte: BCIRG-006/.test(tchTxt) && !/Fonte: TRAIN-2/.test(tchTxt), (tchTxt.match(/Fonte:[^→]{0,80}/) || [''])[0]);
    await clearClin(); await setClin({ cenario: 'adjuvancia', her2: 'negativo', rh: 'negativo' });
    const carboTxt = await cardTxt(ID_CARBO);
    ok('L5 ★ carbo+paclitaxel mostra "Fonte: PATTERN" e não CALGB 40603 como fonte', /Fonte: PATTERN/.test(carboTxt) && !/Fonte: CALGB/.test(carboTxt), (carboTxt.match(/Fonte:[^→]{0,80}/) || [''])[0]);
    ok('L5 carbo+paclitaxel: selo re_derivado (saiu de divergencia) e 🟢 para TNBC adjuvante', /^verde/.test(await sem(ID_CARBO)) && regs.find(r => r.regimen_id === ID_CARBO).consolidacao.selo_confianca === 're_derivado', await sem(ID_CARBO));
    await setTumor(T_OV);
    await clearClin(); await setClin({ tumor: 'ovario_epitelial', recidiva_platina_resistente: true });
    const bevaTxt = await cardTxt(ID_BEVA);
    ok('L5 ovário beva: ainda "Não incorporado", com a nota do revisor (ASCO 2026) e AURELIA como pivô', /Não incorporado/.test(bevaTxt) && /ASCO 2026/.test(bevaTxt) && /AURELIA/.test(bevaTxt), bevaTxt.slice(0, 160));
    ok('Z somente leitura (oncologista): nenhum POST/PUT/PATCH/DELETE saiu do browser', escritas.length === 0, escritas[0] || '');
    await ctx.close();

    // L4 alçada — revisor (dentro da alçada)
    await sleep(3000);
    const ctx2 = await browser.newContext(); const page2 = await ctx2.newPage();
    page2.on('console', m => { if (m.type() === 'error') errs.push('rev: ' + m.text().slice(0, 160)); });
    page2.on('pageerror', e => errs.push('rev pageerror: ' + e.message.slice(0, 160)));
    page2.on('dialog', d => d.accept());
    await page2.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);
    await page2.goto(APP);
    await loginNaTela(page2, 'revisor');
    await page2.waitForSelector('#nav a', { timeout: 25000 });
    page2.on('request', r => { const m = r.method(); if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') escritas.push('rev ' + m + ' ' + r.url()); });
    await page2.evaluate(() => go('simulador'));
    await page2.waitForSelector('.sys-nav', { timeout: 15000 });
    await page2.evaluate(t => { const g = agruparTumores(TUMORES).find(g => g.items.some(i => i.id === t)); toggleSysSim(g.id); setSimTumor(t); }, T_CP);
    await page2.waitForSelector('#sim-protos-live .proto', { timeout: 15000 });
    await page2.evaluate(() => { Object.assign(SIM.clin, { tumor: 'nasofaringe', metastatico: true }); recalcSim(); });
    const toriRev = await page2.evaluate(id => { const el = document.getElementById('card-' + slug(id)); return el ? el.textContent.replace(/\s+/g, ' ') : 'sem-card'; }, ID_TORI);
    ok('L4 ★ revisor vê o toripalimabe como "Não incorporado — custo", com a nota (Anvisa, MCBS 4)', /Não incorporado/.test(toriRev) && /custo/.test(toriRev) && /Anvisa/.test(toriRev) && !/política institucional/.test(toriRev.split('Notas da revisão')[0]), toriRev.slice(0, 200));
    ok('L4 ★ revisor vê "Notas da revisão clínica" no card do toripalimabe', /Notas da revisão clínica/.test(toriRev));
    const incRev = await page2.evaluate(ids => ids.map(id => incorporacao(REGIMES.find(x => x.regimen_id === id)).motivoLabel), [ID_TORI, ID_PARP]);
    ok('L4 incorporacao() para revisor: toripalimabe=custo, PARP=refutado', incRev[0] === 'custo' && /refutado/.test(incRev[1]), incRev.join(' | '));
    ok('Z somente leitura (revisor): nenhuma escrita', !escritas.some(e => /^rev /.test(e)), escritas.find(e => /^rev /.test(e)) || '');
    ok('Z console limpo (os dois perfis)', errs.length === 0, errs[0] || '');
    await ctx2.close();
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.stack || e.message);
  } finally {
    await browser.close();
  }
  const fails = R.filter(r => !r[0]).length;
  console.log(`\n${R.length - fails}/${R.length} checks passaram${fails ? ` — ${fails} FALHA(S)` : ' — portão OK'}`);
  process.exit(fails ? 1 : 0);
})();
