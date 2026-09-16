// Portão dos DRIVERS DE PULMÃO (EGFR/ALK/ROS1 + histologia) — decisão do revisor de 16/09/2026.
// Prova, clicando em browser isolado (headless) e por API, o que a decisão pediu:
//   D1 vocabulário: pulmao-nsclc expõe histologia/egfr_status/alk_status/ros1_status com os
//      rótulos do dado e NÃO expõe mais egfr_alk/egfr_mutado/.../mutacao_acionavel.
//   D2 default: simulador nasce com histologia=nao_escamoso e drivers=nao_testado → IO 1ª linha
//      (KEYNOTE-024) em 🟡, nunca verde por presunção; o "faltam" cita os três drivers.
//   D3 escamoso: histologia=escamoso → KEYNOTE-024 🟢 sem drivers; 407 🟢 e 189 🔴.
//   D4 não-escamoso: drivers todos negativos → 024 🟢; egfr mutado_sensibilizante → 024 🔴 e
//      FLAURA 🟢; alk rearranjado com os outros não testados → 024 🔴 (positivo vence o indet).
//   D5 tela: o widget mostra "Não testado" / "Escamoso (CEC)" (rotulos do dado), e o painel de
//      calculados traz a linha "Sem driver acionável (ou histologia escamosa)".
//   D6 corpus servido: 301 regimes; nsclc-met-io-qt-pdl1baixo-escamoso existe e é o KEYNOTE-407;
//      os 14 ajustados não têm decisão no hash novo (DEV: pendente; PROD: pendente_re_revisao,
//      porque a aprovação de 14/09 ficou no hash antigo) e o 407 nasce pendente — a fila é o referendo.
//   D7 paridade app × servidor: para os MESMOS valores informados, o interpretador da app e o
//      semaforo.ts compilado (backend/dist) dão o mesmo veredito em 30 combinações.
// Somente leitura: nenhum POST sai do browser; nada é criado no banco.
// Uso: node scripts/portao-drivers-pulmao.js  (app 5173 e API 3005 no ar).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const { loginNaTela, tokenApi } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');
const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';
const T = 'pulmao-nsclc';
const ID_024 = 'nsclc-met-io-mono-pdl1alto', ID_189 = 'nsclc-met-io-qt-pdl1baixo', ID_407 = 'nsclc-met-io-qt-pdl1baixo-escamoso',
      ID_FLAURA = 'nsclc-met-osimertinibe-egfr', ID_PACIFIC = 'nsclc-def-crt-durvalumab';
const AJUSTADOS = [ 'nsclc-neoadj-nivolumabe-qt','nsclc-periop-pembrolizumabe-qt','nsclc-def-crt-durvalumab','nsclc-adj-atezolizumabe-pdl1',
  'nsclc-met-io-mono-pdl1alto','nsclc-met-io-qt-pdl1baixo','nsclc-adj-osimertinibe-egfr','nsclc-met-osimertinibe-egfr','nsclc-met-osi-qt-egfr',
  'nsclc-met-amivantamab-nao-incluido','nsclc-met-papillon-exon20-nao-incluido','nsclc-adj-alectinibe-alk','nsclc-met-alectinibe-alk','nsclc-met-crizotinibe-ros1' ];
const APOSENTADOS = ['egfr_alk','egfr_mutado','egfr_negativo','egfr_exon20','alk_positivo','ros1_positivo','mutacao_acionavel'];
const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 200) + ']' : '')); };

async function req(rota, tk) { const r = await fetch(API + rota, { headers: { Authorization: 'Bearer ' + tk } }); return { status: r.status, body: await r.json().catch(() => null) }; }

(async () => {
  await exigirBancoDeDev();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const escritas = [], errs = [];
  try {
    // ---- D6 (API) ----
    const tkRev = await tokenApi(API, 'revisor');
    const ev = await req('/evidencia', tkRev);
    const regs = ev.body.regimes;
    ok('D6 /evidencia serve o run dos drivers (301 regimes, fonte 2026-09-16-drivers-pulmao)', ev.status === 200 && regs.length === 301 && /2026-09-16-drivers-pulmao/.test(ev.body._source.path), ev.body._source.path);
    const r407 = regs.find(r => r.regimen_id === ID_407), r189 = regs.find(r => r.regimen_id === ID_189);
    ok('D6 KEYNOTE-407 existe como regime próprio (escamoso, doi 10.1056/NEJMoa1810865) e o 189 ficou com o id antigo (não-escamoso)',
      !!r407 && r407.referencia.doi === '10.1056/NEJMoa1810865' && /escamoso/i.test(r407.nome) && !!r189 && /189/.test(r189.nome) && /não-escamoso/i.test(r189.nome), r407 && r407.nome);
    const cp = ev.body.campos_primitivos[T].map(s => s.campo);
    ok('D1 vocabulário de pulmao-nsclc: 4 novos presentes, 7 aposentados ausentes', ['histologia','egfr_status','alk_status','ros1_status'].every(c => cp.includes(c)) && APOSENTADOS.every(c => !cp.includes(c)), cp.join(','));
    const egfr = ev.body.campos_primitivos[T].find(s => s.campo === 'egfr_status');
    ok('D1 egfr_status: enum, nao_testado primeiro (default) e declarado indeterminado, rotulos no dado, estavel', egfr.tipo === 'enum' && egfr.opcoes[0] === 'nao_testado' && (egfr.indeterminado || []).includes('nao_testado') && egfr.rotulos && egfr.rotulos.nao_testado === 'Não testado' && egfr.estavel === true);
    // Estado de revisão: em DEV os pareceres de 14/09 não existem (vivem só em produção), então
    // os 14 aparecem SEM estado (pendente); em produção, com a aprovação gravada no hash antigo,
    // aparecem como pendente_re_revisao. O que NÃO pode acontecer em nenhum ambiente: um deles
    // constar como aprovado/ajuste/contestado NO HASH ATUAL — significaria que o hash não mudou.
    const resumo = (await req('/revisoes/resumo', tkRev)).body;
    const est = resumo.estados || {};
    const estadoDe = rid => { const e = est[rid]; return e ? (e.estado || String(e)) : 'pendente'; };
    const hashesNovos = Object.fromEntries(AJUSTADOS.map(rid => [rid, regs.find(r => r.regimen_id === rid).content_hash]));
    const noHashAtual = AJUSTADOS.filter(rid => est[rid] && est[rid].content_hash === hashesNovos[rid] && /aprovado|ajuste|contestado/.test(estadoDe(rid)));
    const estados = AJUSTADOS.map(rid => estadoDe(rid));
    ok('D6 /revisoes/resumo: nenhum dos 14 ajustados tem decisão no hash NOVO (todos pendente ou pendente_re_revisao — a fila do revisor é o referendo)',
      noHashAtual.length === 0 && estados.every(e => /pendente/.test(e)), `estados=${[...new Set(estados)].join(',')} hashes_carregados=${resumo.hashes_carregados}`);
    ok('D6 /revisoes/resumo: 407 nasce pendente (nunca revisado)', /pendente/.test(estadoDe(ID_407)), estadoDe(ID_407));
    // no CORPUS servido: as aprovações de 14/09 gravadas em consolidacao.aprovacoes apontam para o hash ANTIGO
    const expiradas = AJUSTADOS.filter(rid => { const r = regs.find(x => x.regimen_id === rid); return (r.consolidacao.aprovacoes || []).some(a => a.content_hash && a.content_hash !== r.content_hash); });
    ok('D6 corpus: os 14 carregam aprovação de 14/09 num hash que já não é o atual (expiram por construção)', expiradas.length === 14, `${expiradas.length}/14`);
    // vocabulário da importação (secretaria/admin) passa indeterminado e rotulos
    const tkAdm = await tokenApi(API, 'admin');
    const voc = await req('/importacao/vocabulario', tkAdm);
    const vEgfr = voc.body.tumores.find(t => t.id === T).campos.find(c => c.campo === 'egfr_status');
    ok('D1 /importacao/vocabulario carrega indeterminado e rotulos (a secretaria vê "Não testado")', voc.status === 200 && (vEgfr.indeterminado || []).includes('nao_testado') && vEgfr.rotulos && !!vEgfr.rotulos.mutado_exon20, JSON.stringify(vEgfr.rotulos).slice(0, 120));

    // ---- D2–D5 (UI, oncologista, somente leitura) ----
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
    await page.evaluate(t => { const g = agruparTumores(TUMORES).find(g => g.items.some(i => i.id === t)); toggleSysSim(g.id); setSimTumor(t); }, T);
    await page.waitForSelector('#sim-protos-live .proto', { timeout: 15000 });

    const sem = async rid => page.evaluate(id => { const el = document.getElementById('card-' + slug(id)); const s = el && el.querySelector('.semaphore'); return s ? (/s-green/.test(s.className) ? 'verde' : /s-red/.test(s.className) ? 'vermelho' : /s-amber/.test(s.className) ? 'amarelo' : 'classe?') + '|' + s.textContent.trim() : 'sem-card'; }, rid);
    const setClin = async (obj) => page.evaluate(o => { Object.assign(SIM.clin, o); recalcSim(); }, obj);
    const vals = async () => page.evaluate(t => clinValues(t, SIM.clin), T);

    const v0 = await vals();
    ok('D2 default do simulador: histologia=nao_escamoso e os três drivers=nao_testado', v0.histologia === 'nao_escamoso' && v0.egfr_status === 'nao_testado' && v0.alk_status === 'nao_testado' && v0.ros1_status === 'nao_testado', JSON.stringify(v0));
    await setClin({ metastatico: true, pdl1_alto: true });
    ok('D2 ★ KEYNOTE-024 com drivers não testados = 🟡 (nunca verde por presunção)', /^amarelo/.test(await sem(ID_024)), await sem(ID_024));
    const painel = await page.evaluate(() => (document.getElementById('sim-calc-live') || {}).innerText || '');
    ok('D5 painel de calculados: linha "Sem driver acionável (ou histologia escamosa)" = — com "faltam: EGFR, ALK, ROS1"', /Sem driver acionável/.test(painel) && /faltam:.*EGFR.*ALK.*ROS1/.test(painel), painel.replace(/\s+/g, ' ').slice(0, 200));
    const widget = await page.evaluate(() => (document.getElementById('sim-form') || document.querySelector('.pf-grid') || document.body).innerText);
    ok('D5 widget usa os rótulos do dado: "Não testado" e "Escamoso (CEC)" na tela', /Não testado/.test(widget) && /Escamoso \(CEC\)/.test(widget), '');
    ok('D5 nenhum campo aposentado no formulário (nem "Egfr alk", nem "Mutacao acionavel")', !/Egfr alk|Mutacao acionavel|Egfr mutado|Alk positivo/i.test(widget), '');

    await setClin({ histologia: 'escamoso' });
    ok('D3 ★ escamoso: KEYNOTE-024 = 🟢 sem nenhum driver informado', /^verde/.test(await sem(ID_024)), await sem(ID_024));
    await setClin({ pdl1_alto: false });
    ok('D3 ★ escamoso + PD-L1<50%: KEYNOTE-407 = 🟢 e KEYNOTE-189 = 🔴', /^verde/.test(await sem(ID_407)) && /^vermelho/.test(await sem(ID_189)), `407=${await sem(ID_407)} 189=${await sem(ID_189)}`);
    await setClin({ histologia: 'nao_escamoso' });
    ok('D4 não-escamoso + PD-L1<50% + drivers não testados: 189 = 🟡 e 407 = 🔴', /^amarelo/.test(await sem(ID_189)) && /^vermelho/.test(await sem(ID_407)), `189=${await sem(ID_189)} 407=${await sem(ID_407)}`);
    await setClin({ egfr_status: 'negativo', alk_status: 'negativo', ros1_status: 'negativo' });
    ok('D4 ★ não-escamoso, três negativos: KEYNOTE-189 = 🟢', /^verde/.test(await sem(ID_189)), await sem(ID_189));
    await setClin({ pdl1_alto: true });
    ok('D4 ★ não-escamoso, três negativos, PD-L1≥50%: KEYNOTE-024 = 🟢 e FLAURA = 🔴', /^verde/.test(await sem(ID_024)) && /^vermelho/.test(await sem(ID_FLAURA)), `024=${await sem(ID_024)} FLAURA=${await sem(ID_FLAURA)}`);
    await setClin({ egfr_status: 'mutado_sensibilizante' });
    ok('D4 ★ EGFR mutado sensibilizante: KEYNOTE-024 = 🔴 e FLAURA = 🟢', /^vermelho/.test(await sem(ID_024)) && /^verde/.test(await sem(ID_FLAURA)), `024=${await sem(ID_024)} FLAURA=${await sem(ID_FLAURA)}`);
    await setClin({ egfr_status: 'nao_testado', alk_status: 'rearranjado', ros1_status: 'nao_testado' });
    ok('D4 ★ ALK rearranjado com EGFR/ROS1 não testados: KEYNOTE-024 = 🔴 (positivo vence o indeterminado)', /^vermelho/.test(await sem(ID_024)), await sem(ID_024));
    await setClin({ metastatico: false, estadio: 'III_irressecavel', histologia: 'escamoso', egfr_status: 'nao_testado', alk_status: 'nao_testado' });
    ok('D4 PACIFIC escamoso com EGFR não testado = 🟢 (inline: escamoso ∨ EGFR negativo)', /^verde/.test(await sem(ID_PACIFIC)), await sem(ID_PACIFIC));
    await setClin({ histologia: 'nao_escamoso' });
    ok('D4 PACIFIC não-escamoso com EGFR não testado = 🟡', /^amarelo/.test(await sem(ID_PACIFIC)), await sem(ID_PACIFIC));

    // ---- D7 paridade app × servidor (mesmos valores, dois interpretadores) ----
    const { classificarRegra } = require(path.join(ROOT, 'backend/dist/evidencia/semaforo.js'));
    const primMap = {}; ev.body.campos_primitivos[T].forEach(s => primMap[s.campo] = s);
    const crit = {}, labels = {}; regs.filter(r => r.tumor === T).forEach(r => (r.elegibilidade.criterios || []).forEach(c => { if (!(c.id in crit)) { crit[c.id] = c.expr; labels[c.id] = c.label; } }));
    const casos = [
      { metastatico: true, pdl1_alto: true, histologia: 'nao_escamoso', egfr_status: 'nao_testado', alk_status: 'nao_testado', ros1_status: 'nao_testado' },
      { metastatico: true, pdl1_alto: true, histologia: 'escamoso' },
      { metastatico: true, pdl1_alto: true, histologia: 'nao_escamoso', egfr_status: 'negativo', alk_status: 'negativo', ros1_status: 'negativo' },
      { metastatico: true, pdl1_alto: true, histologia: 'nao_escamoso', egfr_status: 'mutado_sensibilizante', alk_status: 'nao_testado', ros1_status: 'nao_testado' },
      { metastatico: true, pdl1_alto: false, histologia: 'escamoso' },
      { estadio: 'III_irressecavel', histologia: 'nao_escamoso', egfr_status: 'nao_testado' },
    ];
    const ids = [ID_024, ID_189, ID_407, ID_FLAURA, ID_PACIFIC];
    let iguais = 0, total = 0, dif = [];
    for (const v of casos) for (const rid of ids) {
      const reg = regs.find(r => r.regimen_id === rid);
      const srv = classificarRegra(reg.elegibilidade.regra, v, crit, primMap, labels).semaforo;
      const app = await page.evaluate(([rid, v, t]) => { const r = REGIMES.find(x => x.regimen_id === rid); const pm = primByCampo(t), cm = CRIT_EXPR_POR_TUMOR[t] || {}; const res = evalExpr(r.elegibilidade.regra, v, cm, pm); return res === true ? 'elegivel' : res === false ? 'inelegivel' : 'atencao'; }, [rid, v, T]);
      total++; if (srv === app) iguais++; else dif.push(`${rid}:${JSON.stringify(v)} app=${app} srv=${srv}`);
    }
    ok('D7 ★ paridade app × semaforo.ts nos mesmos valores informados (sem default) — 30 combinações', iguais === total, dif[0] || `${iguais}/${total}`);

    ok('Z somente leitura: nenhum POST/PUT/PATCH/DELETE saiu do browser no simulador', escritas.length === 0, escritas[0] || '');
    ok('Z console limpo', errs.length === 0, errs[0] || '');
    await ctx.close();
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.stack || e.message);
  } finally {
    await browser.close();
  }
  const fails = R.filter(r => !r[0]).length;
  console.log(`\n${R.length - fails}/${R.length} checks passaram${fails ? ` — ${fails} FALHA(S)` : ' — portão OK'}`);
  process.exit(fails ? 1 : 0);
})();
