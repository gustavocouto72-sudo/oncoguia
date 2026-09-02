// Portão do módulo RETORNO / TRILHA — fluxos reais em browser isolado (headless).
// É o check que NÃO passa pelo agente: clica a app de verdade e bate na API de verdade.
//
//  Fase 1 (UI, oncologista): cadastro → 1ª avaliação → agenda de reestadiamento nasce (+3m)
//    → retorno SEM imagem (seletor de resposta travado, toxicidades vindas do regime,
//    digitação com contador de render = 0) → trilha mesclada e em ordem → retorno COM
//    imagem + conduta troca_protocolo → seleção de protocolo → avaliação nova VINCULADA
//    ao retorno → reestadiamento reagendado → vencido vira item pendente → guia SADT com
//    os exames digitados na hora.
//  Fase 2 (API): as travas que a UI não pode garantir — RECIST 400, grau fora de 1–5,
//    ausência de rota de edição (imutabilidade), whitelist de perfil (revisor 403 na
//    escrita, 200 na leitura).
//  Limpeza: apaga o paciente de teste (DELETE admin, JWT assinado) — cascata leva retornos.
//
// Uso: node scripts/portao-retorno.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005).
//
// Interação com a autorização: retorno pressupõe protocolo VIGENTE. Seleção Inelegível ou
// Não incorporado nasce como solicitação de exceção 'pendente' e não é vigente até o
// auditor aprovar — por isso o portão escolhe deliberadamente um candidato ELEGÍVEL.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env') });
const jwt = require(path.join(ROOT, 'backend/node_modules/jsonwebtoken'));

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';
const NOME_TESTE = 'Paciente Portao Retorno';
const OBS_TESTE = 'Observacao digitada no teste do portao de retorno - sera apagada';

// Clica no primeiro candidato com semáforo VERDE (elegível + incorporado, já que a lista de
// candidatos exclui os não incorporados). Devolve o regimen_id escolhido, ou null.
async function selecionarElegivel(page) {
  return page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('#reaval-protos .proto'))
      .find(c => c.querySelector('.semaphore.s-green') && c.querySelector('.sel-btn'));
    if (!card) return null;
    const b = card.querySelector('.sel-btn');
    const rid = (b.getAttribute('onclick') || '').split("'")[1];
    b.click();
    return rid;
  });
}

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 160) + ']' : '')); };

const hoje = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
function somarMeses(iso, meses) {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = m - 1 + meses, ano = y + Math.floor(alvo / 12), mes = ((alvo % 12) + 12) % 12;
  const ult = new Date(ano, mes + 1, 0).getDate(), p = n => String(n).padStart(2, '0');
  return `${ano}-${p(mes + 1)}-${p(Math.min(d, ult))}`;
}

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
    headers: Object.assign({ Authorization: 'Bearer ' + tk }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch (_) { }
  return { status: r.status, body: j };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  // A app de teste fala com a API efêmera 3007 (o default do arquivo é 3005).
  await page.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);

  let pacienteId = null;
  try {
    // ═══ FASE 1 — UI, perfil oncologista ═══
    await page.goto(APP);
    await page.fill('#lg_login', 'oncologista');
    await page.fill('#lg_senha', 'onco123');
    await page.click('#lg_btn');
    await page.waitForSelector('button:has-text("+ Novo paciente")', { timeout: 25000 });
    ok('R0 login oncologista', true);

    // ---- cadastro do paciente de teste ----
    await page.click('button:has-text("+ Novo paciente")');
    await page.waitForSelector('#f_nome');
    await page.fill('#f_nome', NOME_TESTE);
    await page.fill('#f_ident', 'TESTE-PORTAO-RET');
    await page.evaluate(() => {
      const g = agruparTumores(TUMORES).find(g => g.items.some(i => i.id === 'mama'));
      toggleSysCad(g.id); setCadTumor('mama');
    });
    await page.click('button:has-text("Salvar e abrir paciente")');
    await page.waitForSelector('#pac-protos-live', { timeout: 25000 });
    pacienteId = await page.evaluate(() => current);
    ok('R0 paciente de teste criado', !!pacienteId, 'id=' + pacienteId);

    // ---- 1ª avaliação (seleção de protocolo) → agenda o reestadiamento ----
    await page.click('button:has-text("Iniciar primeira avaliação")');
    await page.waitForSelector('#reaval-protos .sel-btn', { timeout: 15000 });
    const ridEscolhido = await selecionarElegivel(page);
    ok('R0 há candidato ELEGÍVEL para o retorno (pré-condição: protocolo vigente)',
      !!ridEscolhido, ridEscolhido || 'nenhum card verde — sem protocolo vigente não há retorno');
    await page.waitForFunction(pid => !REAVAL && PAC_DETAIL[pid] && PAC_DETAIL[pid].ultima_avaliacao,
      pacienteId, { timeout: 20000 });
    const reest1 = await page.evaluate(pid => (PAC_DETAIL[pid] || {}).reestadiamento, pacienteId);
    const estado1 = await page.evaluate(pid => PAC_DETAIL[pid].linha_do_tempo[0].autorizacao_estado, pacienteId);
    ok('R1 protocolo elegível+incorporado é vigente na hora (sem exceção)',
      estado1 === 'nao_necessaria', estado1);
    ok('R1 selecionar protocolo agenda reestadiamento (+3m, padrão)',
      !!reest1 && reest1.proximo === somarMeses(hoje(), 3) && reest1.intervalo_meses === 3,
      JSON.stringify(reest1));

    // ---- aba Trilha ----
    await page.click('.pac-tabs a:has-text("Trilha")');
    await page.waitForSelector('.hist-tl', { timeout: 15000 });
    const t1 = await page.evaluate(pid => TRILHA[pid], pacienteId);
    ok('R2 trilha traz a avaliação com o tipo visível',
      t1.itens.length === 1 && t1.itens[0].tipo === 'avaliacao',
      JSON.stringify(t1.itens.map(i => i.tipo)));
    const temBadge = await page.evaluate(() => !!document.querySelector('.tl-tipo.aval'));
    ok('R2 selo "Seleção de protocolo" na trilha', temBadge);

    // ---- RETORNO 1: sem imagem ----
    await page.click('.pac-tabs a:has-text("Seguimento")');
    await page.waitForSelector('button:has-text("Registrar retorno")', { timeout: 15000 });
    await page.click('button:has-text("Registrar retorno")');
    await page.waitForSelector('#ret_realizada', { timeout: 15000 });

    // A trava da UI: sem imagem, o seletor de resposta está desabilitado.
    const selDisabled = await page.evaluate(() => {
      const s = document.querySelector('#ret-resposta select');
      return { existe: !!s, disabled: s ? s.disabled : null, temInput: !!document.getElementById('ret_resposta') };
    });
    ok('R3 sem imagem: resposta TRAVADA na UI',
      selDisabled.disabled === true && selDisabled.temInput === false, JSON.stringify(selDisabled));

    // Toxicidades: a lista de nomes vem do regime em curso + "outra".
    await page.click('button:has-text("+ adicionar toxicidade")');
    await page.waitForSelector('#ret-tox select');
    const opts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#ret-tox select')[0].options).map(o => o.value));
    const doCorpus = await page.evaluate(rid => toxDoRegime(rid), ridEscolhido);
    ok('R4 toxicidades oferecem a lista do regime em curso',
      doCorpus.length > 0 && doCorpus.every(n => opts.includes(n)),
      `regime=${doCorpus.length} opcoes=${opts.length}`);
    ok('R4 opção "outra" (texto livre) presente', opts.includes('__outra'));

    // "outra" abre o campo livre; digitar nele não re-renderiza nada.
    await page.selectOption('#ret-tox select >> nth=0', '__outra');
    await page.waitForSelector('#ret-tox .outra input');
    await page.evaluate(() => { window.__rc = 0; const o = window.render; window.render = function () { window.__rc++; return o.apply(this, arguments); }; });
    await page.type('#ret-tox .outra input', 'Fadiga incapacitante', { delay: 15 });
    await page.type('#ret_obs', OBS_TESTE, { delay: 12 });
    await page.type('#ret_fonte', 'consulta presencial', { delay: 12 });
    const rc1 = await page.evaluate(() => window.__rc);
    const vals = await page.evaluate(() => ({
      tox: document.querySelector('#ret-tox .outra input').value,
      obs: document.getElementById('ret_obs').value,
      fonte: document.getElementById('ret_fonte').value,
    }));
    ok('R5 digitar em observações/toxicidade/fonte: 0 re-render', rc1 === 0, 'renders=' + rc1);
    ok('R5 texto digitado intacto (nada apagado)',
      vals.obs === OBS_TESTE && vals.tox === 'Fadiga incapacitante' && vals.fonte === 'consulta presencial',
      JSON.stringify(vals));

    await page.selectOption('#ret-tox select >> nth=1', '3');
    await page.click('#ret_btn');
    await page.waitForFunction(pid => !RETORNO && TRILHA[pid]
      && TRILHA[pid].itens.some(i => i.tipo === 'retorno'), pacienteId, { timeout: 25000 });
    const t2 = await page.evaluate(pid => TRILHA[pid], pacienteId);
    const ret1 = t2.itens.find(i => i.tipo === 'retorno');
    ok('R6 retorno sem imagem gravado com resposta nao_avaliada',
      !!ret1 && ret1.com_imagem === false && ret1.resposta === 'nao_avaliada', JSON.stringify(ret1 && ret1.resposta));
    ok('R6 toxicidade de texto livre gravada com o grau',
      !!ret1 && ret1.toxicidades.length === 1 && ret1.toxicidades[0].nome === 'Fadiga incapacitante' && ret1.toxicidades[0].grau === 3,
      JSON.stringify(ret1 && ret1.toxicidades));
    ok('R6 observações gravadas', !!ret1 && ret1.observacoes === OBS_TESTE);

    // ---- RETORNO 2: com imagem + progressão + troca de protocolo ----
    await page.click('.pac-tabs a:has-text("Seguimento")');
    await page.waitForSelector('button:has-text("Registrar retorno")', { timeout: 15000 });
    await page.click('button:has-text("Registrar retorno")');
    await page.waitForSelector('#ret_realizada');
    await page.click('#ret_img_sim');
    await page.waitForSelector('#ret_resposta', { timeout: 5000 });
    const habilitou = await page.evaluate(() => !document.getElementById('ret_resposta').disabled);
    ok('R7 com imagem: seletor de resposta HABILITA', habilitou);
    await page.selectOption('#ret_resposta', 'progressao');
    await page.click('button:has-text("Troca de protocolo")');
    await page.click('#ret_btn');
    // conduta troca_protocolo abre a seleção de protocolos (fluxo existente, com semáforo)
    try {
      await page.waitForSelector('#reaval-protos .sel-btn', { timeout: 20000 });
    } catch (e) {
      const diag = await page.evaluate(() => ({
        view, temRetorno: !!RETORNO, temReaval: !!REAVAL,
        troca: REAVAL ? !!REAVAL.troca : null,
        direita: (document.getElementById('reaval-protos') || {}).textContent ?
          document.getElementById('reaval-protos').textContent.slice(0, 200) : '(sem #reaval-protos)',
      }));
      throw new Error('troca não abriu a seleção: ' + JSON.stringify(diag) + ' | console=' + errs.join(' ; '));
    }
    const temSemaforo = await page.evaluate(() => !!document.querySelector('#reaval-protos .semaphore'));
    const motivo = await page.evaluate(() => (document.querySelector('#reaval-protos .disclaimer') || {}).textContent || '');
    ok('R8 troca_protocolo abre a seleção com semáforo', temSemaforo);
    ok('R8 a tela diz qual retorno motivou a troca', /motivada pelo retorno/i.test(motivo), motivo.slice(0, 110));
    const retornoIdEsperado = await page.evaluate(() => REAVAL.retorno_id);
    const ridTroca = await selecionarElegivel(page);
    ok('R8 há candidato elegível para a troca', !!ridTroca, ridTroca || 'nenhum');
    await page.waitForFunction(pid => !REAVAL && PAC_DETAIL[pid] && PAC_DETAIL[pid].ultima_avaliacao
      && PAC_DETAIL[pid].linha_do_tempo.length === 2, pacienteId, { timeout: 25000 });
    await page.waitForFunction(pid => TRILHA[pid] && TRILHA[pid].itens.length === 4,
      pacienteId, { timeout: 25000 });

    // ---- trilha: mescla, ordem e vínculo ----
    await page.click('.pac-tabs a:has-text("Trilha")');
    await page.waitForSelector('.hist-tl', { timeout: 15000 });
    const t3 = await page.evaluate(pid => TRILHA[pid], pacienteId);
    const tipos = t3.itens.map(i => i.tipo);
    ok('R9 trilha mescla avaliações e retornos', tipos.length === 4 && tipos.filter(t => t === 'retorno').length === 2, tipos.join(','));
    // Sequência REAL do fluxo — e não só "não decrescente", que com tudo no mesmo dia
    // passaria até invertido. Foi assim que o empate de mesmo-dia apareceu.
    const esperada = ['avaliacao', 'retorno', 'retorno', 'avaliacao'];
    ok('R9 trilha em ordem cronológica (sequência real do fluxo)',
      tipos.join(',') === esperada.join(','),
      `veio=${tipos.join(',')} esperado=${esperada.join(',')}`);
    const semImagemPrimeiro = t3.itens.filter(i => i.tipo === 'retorno').map(i => i.com_imagem);
    ok('R9 retornos na ordem em que foram registrados (desempate no mesmo dia)',
      JSON.stringify(semImagemPrimeiro) === JSON.stringify([false, true]), JSON.stringify(semImagemPrimeiro));
    const novaAval = t3.itens.filter(i => i.tipo === 'avaliacao').pop();
    ok('R10 avaliação da troca vinculada ao retorno que a motivou',
      novaAval.retorno_id === retornoIdEsperado && !!retornoIdEsperado,
      `retorno_id=${novaAval.retorno_id} esperado=${retornoIdEsperado}`);
    const marca = await page.evaluate(() => !!document.querySelector('.tl-motivado'));
    ok('R10 trilha mostra "motivada pelo retorno"', marca);

    // ---- reestadiamento: retorno com imagem reagenda +3m ----
    const dataRet2 = t3.itens.filter(i => i.tipo === 'retorno').pop().data;
    ok('R11 retorno com imagem reagenda o reestadiamento (+3m)',
      t3.reestadiamento.proximo === somarMeses(String(dataRet2).slice(0, 10), 3),
      `proximo=${t3.reestadiamento.proximo} base=${dataRet2}`);

    // ---- vencido → item pendente destacado ----
    const tkOnco = await token('oncologista', 'onco123');
    const vencidoEm = somarMeses(hoje(), -2);
    await req('PATCH', `/pacientes/${pacienteId}/reestadiamento`, tkOnco, { proximo: vencidoEm });
    await page.evaluate(pid => carregarTrilha(pid).then(() => render()), pacienteId);
    await page.waitForSelector('.reest-venc', { timeout: 15000 });
    const txtVenc = await page.evaluate(() => document.querySelector('.reest-venc .rv-t').textContent);
    const [vy, vm, vd] = vencidoEm.split('-');
    ok('R12 reestadiamento vencido aparece como item pendente destacado',
      txtVenc.includes('vencido desde') && txtVenc.includes(`${vd}/${vm}/${vy}`), txtVenc);

    // ---- guia SADT ----
    await page.click('button:has-text("Gerar guia SADT")');
    await page.waitForSelector('#sadt-exames input', { timeout: 15000 });
    const dadosGuia = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.sadt .sadt-f')).map(f =>
        [f.querySelector('.k').textContent, f.querySelector('.v').textContent]));
    const val = k => (dadosGuia.find(d => d[0] === k) || [])[1];
    ok('R13 guia SADT pré-preenchida com paciente + convênio',
      val('Nome do beneficiário') === NOME_TESTE && !!val('Operadora') && val('Operadora') !== '—' && val('Tumor') === 'Mama',
      JSON.stringify(dadosGuia.slice(0, 8)));
    // exames digitados na hora, com adicionar/remover linhas e sem re-render
    await page.evaluate(() => { window.__rc2 = 0; const o = window.render; window.render = function () { window.__rc2++; return o.apply(this, arguments); }; });
    await page.type('#sadt-exames input >> nth=0', 'TC de torax e abdome com contraste', { delay: 12 });
    await page.type('#sadt-exames input >> nth=1', 'Cintilografia ossea', { delay: 12 });
    const rc2 = await page.evaluate(() => window.__rc2);
    ok('R14 digitar exames: 0 re-render', rc2 === 0, 'renders=' + rc2);
    const antesAdd = await page.evaluate(() => document.querySelectorAll('#sadt-exames input').length);
    await page.click('button:has-text("+ adicionar exame")');
    const depoisAdd = await page.evaluate(() => document.querySelectorAll('#sadt-exames input').length);
    await page.click('#sadt-exames .ex-row:last-of-type .rm');
    const depoisRm = await page.evaluate(() => document.querySelectorAll('#sadt-exames input').length);
    ok('R14 adicionar/remover linhas de exame', depoisAdd === antesAdd + 1 && depoisRm === antesAdd, `${antesAdd}→${depoisAdd}→${depoisRm}`);
    const exames = await page.evaluate(() => SADT.exames.filter(Boolean));
    const naGuia = await page.evaluate(() => Array.from(document.querySelectorAll('#sadt-exames input')).map(i => i.value).filter(Boolean));
    ok('R14 guia sai com os exames digitados',
      exames.length === 2 && naGuia.join('|') === exames.join('|'), naGuia.join(' | '));
    ok('R14 gancho examesReestadiamento(tumor) devolve vazio (pendência registrada)',
      await page.evaluate(() => examesReestadiamento('mama').length === 0));

    ok('R15 console sem erro vermelho no fluxo inteiro', errs.length === 0, errs.join(' | '));

    // ═══ FASE 2 — API: as travas que a UI não garante ═══
    const base = { data_realizada: hoje(), conduta: 'mantem' };
    const r400 = await req('POST', `/pacientes/${pacienteId}/retornos`, tkOnco,
      Object.assign({}, base, { com_imagem: false, resposta: 'progressao' }));
    ok('A1 DTO: resposta sem imagem → 400 (RECIST)',
      r400.status === 400 && /RECIST/i.test(JSON.stringify(r400.body)), `${r400.status} ${JSON.stringify(r400.body && r400.body.message)}`);

    const r400b = await req('POST', `/pacientes/${pacienteId}/retornos`, tkOnco,
      Object.assign({}, base, { com_imagem: true }));
    ok('A2 DTO: com imagem exige resposta → 400', r400b.status === 400, String(r400b.status));

    const r400c = await req('POST', `/pacientes/${pacienteId}/retornos`, tkOnco,
      Object.assign({}, base, { com_imagem: false, toxicidades: [{ nome: 'Neutropenia', grau: 6 }] }));
    ok('A3 DTO: grau de toxicidade fora de 1–5 → 400', r400c.status === 400, String(r400c.status));

    const rets = await req('GET', `/pacientes/${pacienteId}/retornos`, tkOnco);
    const retId = rets.body[0].id;
    const rPatch = await req('PATCH', `/retornos/${retId}`, tkOnco, { observacoes: 'editado' });
    const rPut = await req('PUT', `/pacientes/${pacienteId}/retornos/${retId}`, tkOnco, { observacoes: 'editado' });
    const rDel = await req('DELETE', `/pacientes/${pacienteId}/retornos/${retId}`, tkOnco);
    ok('A4 imutável: não existe rota de editar/apagar retorno (404)',
      rPatch.status === 404 && rPut.status === 404 && rDel.status === 404,
      `PATCH=${rPatch.status} PUT=${rPut.status} DELETE=${rDel.status}`);

    // whitelist explícita de perfil
    const tkRev = await token('revisor', 'revisor123');
    const revEscreve = await req('POST', `/pacientes/${pacienteId}/retornos`, tkRev,
      Object.assign({}, base, { com_imagem: false }));
    const revLe = await req('GET', `/pacientes/${pacienteId}/trilha`, tkRev);
    const revAgenda = await req('PATCH', `/pacientes/${pacienteId}/reestadiamento`, tkRev, { intervalo_meses: 6 });
    ok('A5 guard: revisor NÃO escreve retorno (403)', revEscreve.status === 403, String(revEscreve.status));
    ok('A5 guard: revisor NÃO mexe na agenda (403)', revAgenda.status === 403, String(revAgenda.status));
    ok('A5 guard: leitura da trilha liberada a autenticado (200)', revLe.status === 200, String(revLe.status));
    const semToken = await fetch(`${API}/pacientes/${pacienteId}/trilha`);
    ok('A5 guard: sem token → 401', semToken.status === 401, String(semToken.status));

    // avaliacao_id de outro paciente não cola
    const rAlheio = await req('POST', `/pacientes/${pacienteId}/retornos`, tkOnco,
      Object.assign({}, base, { com_imagem: false, avaliacao_id: 999999 }));
    ok('A6 avaliacao_id de outro paciente → 400', rAlheio.status === 400, String(rAlheio.status));
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.message);
    try { await page.screenshot({ path: path.join(ROOT, 'portao-retorno-erro.png') }); } catch (_) { }
  } finally {
    // ---- limpeza: paciente de teste sai (cascata leva retornos e avaliações) ----
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
