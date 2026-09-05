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
//  Limpeza: apaga o paciente de teste (DELETE com a conta de teste admin) — cascata
//    leva retornos e avaliações.
//
// Uso: node scripts/portao-retorno.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005). As CREDENCIAIS de teste vêm de .env.local
// via scripts/portao-credenciais.js — nada de login/senha escrito aqui.
//
// Interação com a autorização: retorno pressupõe protocolo VIGENTE. Seleção Inelegível ou
// Não incorporado nasce como solicitação de exceção 'pendente' e não é vigente até o
// auditor aprovar — por isso o portão escolhe deliberadamente um candidato ELEGÍVEL.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const { tokenApi, loginNaTela } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';
const NOME_TESTE = 'Paciente Portao Retorno';
const IDENT_TESTE = 'TESTE-PORTAO-RET';
// Nascimento fixo: a coluna Idade mostra anos completos, e uma data fixa dá um número
// previsível para conferir (o portão calcula a idade esperada do mesmo jeito que a app).
const NASC_TESTE = '1971-03-12';
const OBS_TESTE = 'Observacao digitada no teste do portao de retorno - sera apagada';

const fmtBR = iso => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; };

// Lê a linha do paciente de teste na lista, célula a célula, indexada pelo RÓTULO da
// coluna — não por posição fixa. Assim o check continua válido quando uma coluna entra ou
// sai, e o cabeçalho passa a ser parte do que se verifica.
async function linhaLista(page, nome) {
  const r = await page.evaluate(n => {
    const heads = Array.from(document.querySelectorAll('thead th')).map(h => h.textContent.trim());
    const tr = Array.from(document.querySelectorAll('tbody tr')).find(x => x.textContent.includes(n));
    if (!tr) return null;
    const cel = {};
    Array.from(tr.children).forEach((td, i) => { cel[heads[i]] = td.textContent.replace(/\s+/g, ' ').trim(); });
    return { cel, html: tr.innerHTML };
  }, nome);
  if (!r) throw new Error(`linha de "${nome}" não encontrada na lista de pacientes`);
  return r;
}

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
function somarDias(iso, dias) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
}
function somarMeses(iso, meses) {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = m - 1 + meses, ano = y + Math.floor(alvo / 12), mes = ((alvo % 12) + 12) % 12;
  const ult = new Date(ano, mes + 1, 0).getDate(), p = n => String(n).padStart(2, '0');
  return `${ano}-${p(mes + 1)}-${p(Math.min(d, ult))}`;
}

// Login de API por PERFIL (nunca por login literal), com espera no 429 — ver
// scripts/portao-credenciais.js.
const token = perfil => tokenApi(API, perfil);
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
  // Primeira linha: sobre QUE BANCO este resultado vale. Aborta se não for o de dev.
  exigirBancoDeDev('retorno / trilha');
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
    await loginNaTela(page, 'oncologista');
    await page.waitForSelector('button:has-text("+ Novo paciente")', { timeout: 25000 });
    ok('R0 login oncologista', true);

    // ---- cadastro do paciente de teste ----
    await page.click('button:has-text("+ Novo paciente")');
    await page.waitForSelector('#f_nome');
    await page.fill('#f_nome', NOME_TESTE);
    await page.fill('#f_ident', IDENT_TESTE);
    await page.fill('#f_nasc', NASC_TESTE);
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

    // ---- formulário enxuto (feedback de uso real) ----
    // O campo de data agendada saiu do topo: marcar data é assunto do PRÓXIMO retorno.
    // E o jargão de imutabilidade saiu do texto — vira ⓘ com tooltip, sem sumir a regra.
    const forma = await page.evaluate(() => {
      const cab = document.querySelector('.card .section-t');
      const i = cab ? cab.querySelector('.info-i') : null;
      return {
        temAgendada: !!document.getElementById('ret_agendada'),
        cabecalho: cab ? cab.textContent.replace(/\s+/g, ' ').trim() : null,
        temInfo: !!i,
        tooltip: i ? (i.getAttribute('title') || '') : '',
        jargao: /registro é imutável|correção é um retorno novo/i.test(document.body.textContent),
        realizadaHoje: document.getElementById('ret_realizada').value,
      };
    });
    ok('R3 formulário sem o campo "Data agendada" no topo', forma.temAgendada === false);
    ok('R3 cabeçalho é só "Retorno — <protocolo> (linha)"',
      /^Retorno — .+\(\d+ª linha\)/.test(forma.cabecalho.replace(/ ⓘ.*$/, '').replace(/Cancelar$/, '').trim()),
      forma.cabecalho);
    ok('R3 jargão de imutabilidade fora da tela, preservado no ⓘ',
      forma.jargao === false && forma.temInfo === true && /retorno novo/i.test(forma.tooltip),
      `jargao=${forma.jargao} info=${forma.temInfo}`);
    ok('R3 data realizada já vem com hoje', forma.realizadaHoje === hoje(), forma.realizadaHoje);
    // Sem agendamento anterior não há linha informativa (só aparece se veio de um previsto).
    ok('R3 sem agendamento anterior, nenhuma linha de "retorno previsto"',
      await page.evaluate(() => !document.querySelector('.ret-previsto')));

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

    // ---- bloco "Próximo retorno" (fim do formulário) ----
    // Sem retorno anterior não há "último ciclo": nada pré-selecionado — a app não
    // arbitra ritmo de seguimento.
    ok('R5b sem histórico, nenhum intervalo vem pré-selecionado',
      await page.evaluate(() => RETORNO.prox_intervalo === null && !document.querySelector('.chip-int.on')));
    const chips = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.chip-int')).map(b => b.textContent.trim()));
    ok('R5b chips oferecidos conforme o pedido',
      JSON.stringify(chips) === JSON.stringify(['3 semanas', '1 mês', '2 meses', '3 meses', 'Data específica', 'Sem retorno programado']),
      chips.join(' · '));
    await page.click('.chip-int:has-text("1 mês")');
    const umMes = somarMeses(hoje(), 1);
    const [dy, dm, dd] = umMes.split('-');
    const previa = await page.evaluate(() => document.querySelector('.prox-res').textContent.trim());
    ok('R5b escolher "1 mês" mostra a data calculada',
      previa.includes(`${dd}/${dm}/${dy}`), previa);
    // Escolher intervalo não pode re-renderizar o formulário inteiro (texto já digitado).
    const rcChip = await page.evaluate(() => window.__rc);
    ok('R5b escolher intervalo: 0 re-render do formulário', rcChip === 0, 'renders=' + rcChip);
    ok('R5b texto digitado sobrevive à escolha do intervalo',
      await page.evaluate(o => document.getElementById('ret_obs').value === o, OBS_TESTE));

    await page.click('#ret_btn');
    await page.waitForFunction(pid => !RETORNO && TRILHA[pid]
      && TRILHA[pid].itens.some(i => i.tipo === 'retorno'), pacienteId, { timeout: 25000 });
    const t2 = await page.evaluate(pid => TRILHA[pid], pacienteId);
    const ret1 = t2.itens.find(i => i.tipo === 'retorno');
    ok('R5b gravar cria o próximo retorno agendado na trilha',
      t2.retorno && t2.retorno.proximo === umMes && t2.retorno.vencido === false,
      JSON.stringify(t2.retorno));
    ok('R5b a escolha fica congelada no registro do retorno',
      ret1.proximo_intervalo === '1m' && ret1.proximo_retorno === umMes,
      `${ret1.proximo_intervalo} → ${ret1.proximo_retorno}`);
    ok('R5b trilha mostra o agendado como item pendente',
      await page.evaluate(() => /Próximo retorno agendado/.test(document.body.textContent)));
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

    // Agora ESTE retorno nasceu de um agendamento: a linha informativa read-only aparece,
    // e o intervalo do último ciclo vem sugerido (sem ser imposto — é um chip marcado).
    const prevLinha = await page.evaluate(() => {
      const el = document.querySelector('.ret-previsto');
      return { texto: el ? el.textContent.replace(/\s+/g, ' ').trim() : null,
               editavel: !!(el && el.querySelector('input,select,textarea')) };
    });
    const [py, pm, pd] = somarMeses(hoje(), 1).split('-');
    ok('R7b retorno vindo de agendamento mostra linha read-only do previsto',
      !!prevLinha.texto && prevLinha.texto.includes(`${pd}/${pm}/${py}`) && prevLinha.editavel === false,
      prevLinha.texto);
    ok('R7b intervalo do último ciclo vem pré-selecionado',
      await page.evaluate(() => RETORNO.prox_intervalo === '1m'
        && /1 mês/.test((document.querySelector('.chip-int.on') || {}).textContent || '')));

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
    const tkOnco = await token('oncologista');
    const vencidoEm = somarMeses(hoje(), -2);
    await req('PATCH', `/pacientes/${pacienteId}/reestadiamento`, tkOnco, { proximo: vencidoEm });
    await page.evaluate(pid => carregarTrilha(pid).then(() => render()), pacienteId);
    await page.waitForSelector('.reest-venc', { timeout: 15000 });
    const txtVenc = await page.evaluate(() => document.querySelector('.reest-venc .rv-t').textContent);
    const [vy, vm, vd] = vencidoEm.split('-');
    ok('R12 reestadiamento vencido aparece como item pendente destacado',
      txtVenc.includes('vencido desde') && txtVenc.includes(`${vd}/${vm}/${vy}`), txtVenc);

    // ---- LISTA DE PACIENTES: colunas, busca e ordem ----
    // A lista é a tela em que o médico decide o que fazer hoje. O que se checa aqui é o
    // que ela promete: quem não veio no topo e em vermelho, idade legível, o protocolo
    // com os selos que mudam a leitura da linha, quem está cuidando do paciente, e uma
    // busca que não engole o que se digita.
    //
    // Força a agenda de RETORNO para o passado pela API e volta para a lista. Quem decide
    // "vencido" é o servidor (relógio dele); a app só desenha.
    const previstoVencido = somarMeses(hoje(), -1);
    await page.evaluate(async (a) => {
      await api(`/pacientes/${a.pid}/retornos`, { method: 'POST', body: JSON.stringify({
        data_realizada: a.data, com_imagem: false, conduta: 'mantem',
        proximo_intervalo: 'especifica', proximo_retorno: a.previsto,
      }) });
    }, { pid: pacienteId, data: hoje(), previsto: previstoVencido });
    await page.evaluate(() => carregarPacientes().then(() => { view = 'lista'; render(); }));
    await page.waitForSelector('.lista-filtros', { timeout: 15000 });
    const [ay, am, ad] = previstoVencido.split('-');

    // Cabeçalho: as sete colunas, na ordem, e a ausência das duas que saíram — a
    // "Nascimento" (virou o subtítulo da idade) e a "Última avaliação" (foi absorvida
    // pelo protocolo, como "· em dd/mm").
    const heads = await page.evaluate(() => Array.from(document.querySelectorAll('thead th')).map(h => h.textContent.trim()));
    ok('L1 colunas da lista, na ordem, sem "Nascimento" nem "Última avaliação" soltas',
      heads.join('|') === 'Paciente|Idade|Tumor|Último protocolo|Médico assistente|Próximo retorno|Semáforo',
      heads.join('|'));

    let linha = await linhaLista(page, NOME_TESTE);
    // A idade esperada é CALCULADA aqui (anos completos até hoje), não cravada: um número
    // fixo no arquivo passa a mentir no primeiro aniversário do paciente de teste.
    const anos = (() => {
      const [y, m, d] = NASC_TESTE.split('-').map(Number), h = new Date();
      return h.getFullYear() - y - ((h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) ? 1 : 0);
    })();
    ok('L2 idade em anos completos, com o nascimento embaixo',
      linha.cel['Idade'] === `${anos}a${fmtBR(NASC_TESTE)}`, `${linha.cel['Idade']} (esperado ${anos}a)`);
    ok('L3 protocolo traz nome, linha e o dia da última avaliação ("· em dd/mm")',
      linha.cel['Último protocolo'].includes('linha')
      && new RegExp('· em ' + hoje().slice(8) + '/' + hoje().slice(5, 7)).test(linha.cel['Último protocolo']),
      linha.cel['Último protocolo']);
    ok('L4 protocolo elegível e incorporado NÃO ganha selo "NÃO INCORPORADO"',
      !/tag-ni/.test(linha.html) && !linha.cel['Último protocolo'].includes('NÃO INCORPORADO'),
      linha.cel['Último protocolo']);
    ok('L4 o selo existe para quem é não incorporado (mesmo eixo do corpus do backend)',
      await page.evaluate(rid => {
        const ni = REGIMES.find(r => !incorporacao(r).incorporado);
        return !!ni && regimeNaoIncorporado(ni.regimen_id) === true && regimeNaoIncorporado(rid) === false;
      }, ridEscolhido));
    ok('L5 médico assistente = quem assinou o evento mais recente (derivado, não cadastrado)',
      linha.cel['Médico assistente'] === await page.evaluate(() => USUARIO.nome),
      linha.cel['Médico assistente']);
    ok('L6 próximo retorno vencido: data em vermelho + "atrasado há Xd"',
      linha.cel['Próximo retorno'].includes(`${ad}/${am}/${ay}`)
      && /atrasado há \d+d/.test(linha.cel['Próximo retorno'])
      && /class="ret-venc"/.test(linha.html),
      linha.cel['Próximo retorno']);
    ok('L7 atrasado vem PRIMEIRO na ordem padrão da lista',
      await page.evaluate(n => {
        const linhas = Array.from(document.querySelectorAll('tbody tr'));
        return linhas.length > 0 && linhas[0].textContent.includes(n);
      }, NOME_TESTE));
    await page.click('.lista-filtros button.atraso');
    const noFiltro = await page.evaluate(n => ({
      linhas: document.querySelectorAll('tbody tr').length,
      temPaciente: Array.from(document.querySelectorAll('tbody tr')).some(r => r.textContent.includes(n)),
      filtro: LISTA_FILTRO,
    }), NOME_TESTE);
    ok('L7 filtro "retornos atrasados" mostra o paciente',
      noFiltro.filtro === 'atrasados' && noFiltro.temPaciente && noFiltro.linhas >= 1,
      JSON.stringify(noFiltro));
    await page.evaluate(() => setListaFiltro('todos'));

    // ---- busca: filtra ao digitar, e o campo não é reconstruído ----
    // O ponto do check não é "filtrou": é que o INPUT sobrevive. Se a lista inteira for
    // re-renderizada a cada tecla, o campo perde foco e cursor e a busca fica intragável
    // — é o mesmo padrão de DOM persistente do cadastro e do formulário de retorno.
    await page.click('#lista-busca');
    await page.evaluate(() => { window.__rcL = 0; const o = window.render; window.render = function () { window.__rcL++; return o.apply(this, arguments); }; });
    await page.type('#lista-busca', 'portao retorno', { delay: 12 });
    const busca = await page.evaluate(n => {
      const el = document.getElementById('lista-busca');
      return {
        rc: window.__rcL,
        foco: document.activeElement === el,
        valor: el.value,
        cursor: el.selectionStart,
        linhas: document.querySelectorAll('tbody tr').length,
        temPaciente: Array.from(document.querySelectorAll('tbody tr')).some(r => r.textContent.includes(n)),
      };
    }, NOME_TESTE);
    ok('L8 buscar por nome: 0 re-render, campo mantém foco, valor e cursor',
      busca.rc === 0 && busca.foco && busca.valor === 'portao retorno' && busca.cursor === 14,
      JSON.stringify(busca));
    ok('L8 busca por nome filtra a lista (sem acento e sem caixa)',
      busca.temPaciente && busca.linhas === 1, JSON.stringify(busca));
    await page.fill('#lista-busca', 'teste-portao-ret');
    ok('L8 busca também casa o REGISTRO do paciente',
      await page.evaluate(n => document.querySelectorAll('tbody tr').length === 1
        && document.querySelector('tbody tr').textContent.includes(n), NOME_TESTE));
    await page.fill('#lista-busca', 'zzzz-nao-existe');
    ok('L8 busca sem resultado mostra estado vazio, não a lista inteira',
      await page.evaluate(() => document.querySelectorAll('tbody tr').length === 0
        && !!document.querySelector('#lista-corpo .empty')));
    await page.fill('#lista-busca', '');
    ok('L8 limpar a busca devolve a lista', await page.evaluate(n =>
      Array.from(document.querySelectorAll('tbody tr')).some(r => r.textContent.includes(n)), NOME_TESTE));

    // ---- registrar o retorno limpa o atraso ----
    // O DIA vem do Node (hoje(), LOCAL) e entra como argumento — não de
    // `new Date().toISOString()` dentro do navegador, que é UTC. O backend deriva o dia
    // com getters locais (hojeISO), e entre 21h e a meia-noite os dois divergem: com o
    // UTC aqui, este retorno nascia com data_realizada de AMANHÃ e dois checks caíam por
    // um motivo que não está no código sob teste — L6 esperava a agenda 3 meses à frente
    // de hoje e recebia a de amanhã, e L5 via este retorno como "mais recente" que o do
    // admin gravado depois. Portão que falha por causa do relógio ensina a ignorar portão.
    await page.evaluate(async ({ pid, dia }) => {
      await api(`/pacientes/${pid}/retornos`, { method: 'POST', body: JSON.stringify({
        data_realizada: dia, com_imagem: false, conduta: 'mantem',
        proximo_intervalo: '3m',
      }) });
      await carregarPacientes(); render();
    }, { pid: pacienteId, dia: hoje() });
    ok('L6 registrar o retorno tira o paciente da lista de atrasados',
      await page.evaluate(n => {
        const p = patients.find(x => x.nome === n);
        return !!p && p.retorno.vencido === false && p.retorno.proximo != null;
      }, NOME_TESTE));
    linha = await linhaLista(page, NOME_TESTE);
    ok('L6 com a agenda em dia, a coluna mostra a data e some o vermelho',
      linha.cel['Próximo retorno'] === fmtBR(somarMeses(hoje(), 3))
      && !/ret-venc|atrasado/.test(linha.html),
      linha.cel['Próximo retorno']);

    // ---- médico assistente segue o evento mais recente, não o cadastro ----
    // Um retorno gravado AGORA por outro profissional (admin) é o evento mais recente do
    // paciente — mesmo dia da avaliação, instante posterior, exatamente o desempate da
    // trilha. A coluna tem de acompanhar; e o nome esperado sai do próprio registro
    // gravado, não de um literal (a conta de teste vem do .env.local).
    const tkAdmin = await token('admin');
    const rAdm = await req('POST', `/pacientes/${pacienteId}/retornos`, tkAdmin,
      { data_realizada: hoje(), com_imagem: false, conduta: 'mantem', proximo_intervalo: '3m' });
    await page.evaluate(() => carregarPacientes().then(() => render()));
    linha = await linhaLista(page, NOME_TESTE);
    const nomeAdmin = rAdm.body && rAdm.body.registrado_por && rAdm.body.registrado_por.nome;
    ok('L5 médico assistente acompanha o último evento (retorno de outro profissional)',
      !!nomeAdmin && linha.cel['Médico assistente'] === nomeAdmin,
      `${linha.cel['Médico assistente']} (esperado ${nomeAdmin})`);
    // E é o mesmo "mais recente" que a TRILHA mostra no topo — a lista não pode chamar de
    // atual um evento que a trilha do paciente exibe no meio.
    const trilhaTopo = await req('GET', `/pacientes/${pacienteId}/trilha`, tkAdmin);
    const topo = trilhaTopo.body.itens[trilhaTopo.body.itens.length - 1];
    ok('L5 o "mais recente" da lista é o mesmo do topo da trilha',
      !!topo.por && topo.por.nome === linha.cel['Médico assistente'],
      `${topo.tipo} por ${topo.por && topo.por.nome}`);

    // ---- selo "aguardando autorização" na última avaliação ----
    // Solicitação de exceção pendente: o protocolo VIGENTE segue sendo o anterior (a
    // coluna não mente), mas a linha avisa que há decisão parada no auditor.
    const vigenteAntes = await page.evaluate(n => (patients.find(x => x.nome === n) || {}).ultimo_regimen_id, NOME_TESTE);
    await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkOnco, {
      regimen_id: ridEscolhido, linha_tratamento: 3, snapshot_campos: {},
      semaforo: 'inelegivel', autorizacao_estado: 'pendente',
    });
    await page.evaluate(() => carregarPacientes().then(() => render()));
    linha = await linhaLista(page, NOME_TESTE);
    ok('L9 última avaliação pendente → selo "⏳ aguardando autorização" na lista',
      linha.cel['Último protocolo'].includes('aguardando autorização') && /tag-aut/.test(linha.html),
      linha.cel['Último protocolo']);
    ok('L9 e o protocolo mostrado continua sendo o VIGENTE, não o solicitado',
      await page.evaluate(n => (patients.find(x => x.nome === n) || {}).ultimo_regimen_id, NOME_TESTE) === vigenteAntes);

    await page.evaluate(() => { LISTA_FILTRO = 'todos'; });
    await page.evaluate(pid => abrir(pid, 'trilha'), pacienteId);
    await page.waitForSelector('.hist-tl', { timeout: 15000 });
    // A guia lê PAC_DETAIL; `abrir` dispara o carregamento e ele pode não ter voltado.
    await page.waitForFunction(pid => PAC_DETAIL[pid] && PAC_DETAIL[pid].tumor,
      pacienteId, { timeout: 20000 });

    // ---- guia TISS SP/SADT ----
    // A guia é DOCUMENTO DE SAÍDA: o que se checa aqui é (a) o que a app pré-preenche,
    // (b) o que ela deliberadamente NÃO preenche, e (c) que a conferência e o papel são a
    // mesma coisa. Nada aqui pode gravar nada — por isso não há check de persistência.
    await page.click('button:has-text("Gerar guia SADT")');
    await page.waitForSelector('#sadt-proc input', { timeout: 15000 });
    // Lê a guia pelo rótulo numerado do campo, exatamente como um humano confere o papel:
    // para cada rótulo, o campo que vem DEPOIS dele na mesma célula. Percorrer assim (em
    // vez de "primeiro rótulo, primeiro input da célula") é o que faz o check enxergar
    // célula com mais de um campo — e de quebra prova a adjacência rótulo→campo, que é
    // justamente o que faz um formulário ser legível no papel.
    const dadosGuia = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.tiss .c').forEach(c => {
        const filhos = Array.from(c.children);
        filhos.forEach((el, i) => {
          if (!el.classList.contains('n')) return;
          for (let j = i + 1; j < filhos.length; j++) {
            if (filhos[j].classList.contains('n')) break;
            const campo = /^(INPUT|TEXTAREA|SELECT)$/.test(filhos[j].tagName)
              ? filhos[j] : filhos[j].querySelector('input,textarea,select');
            if (campo) { out.push([el.textContent.trim(), campo.value]); return; }
          }
        });
      });
      return out;
    });
    const val = rot => (dadosGuia.find(d => d[0] === rot) || [])[1];
    // O solicitante tem de ser o USUÁRIO LOGADO — comparado com o nome que a sessão
    // carrega, não com um literal, já que a conta de teste vem do .env.local.
    const nomeLogado = await page.evaluate(() => USUARIO.nome);
    ok('R13 guia TISS pré-preenchida: beneficiário, convênio, indicação e solicitante',
      val('10 - Nome') === NOME_TESTE && !!val('Operadora') && !!val('Plano')
      && val('15 - Nome do Profissional Solicitante') === nomeLogado
      && (val('23 - Indicação Clínica') || '').startsWith('Reestadiamento — Mama'),
      JSON.stringify([val('10 - Nome'), val('Operadora'), val('Plano'), val('15 - Nome do Profissional Solicitante'), val('23 - Indicação Clínica')]));
    const blocos = await page.evaluate(() => Array.from(document.querySelectorAll('.tiss .bar')).map(b => b.textContent.trim()));
    ok('R13 blocos oficiais da guia SP/SADT presentes, na ordem',
      ['Dados do Beneficiário', 'Dados do Solicitante',
       'Dados da Solicitação / Procedimentos ou Itens Assistenciais Solicitados',
       'Dados do Contratado Executante', 'Dados do Atendimento',
       'Dados da Execução / Procedimentos e Exames Realizados',
       'Identificação do(s) Profissional(is) Executante(s)'].every((b, i, arr) =>
         blocos.indexOf(b) >= 0 && (i === 0 || blocos.indexOf(b) > blocos.indexOf(arr[i - 1]))),
      blocos.join(' | '));
    // O CONTRÁRIO do pré-preenchimento, e igualmente obrigatório: a app não inventa
    // código TUSS, CID-10, número de guia, senha de autorização nem CNES.
    const EM_BRANCO = ['1 - Registro ANS', '3 - Número da Guia Principal', '5 - Senha',
      '7 - Número da Guia Atribuído pela Operadora', '31 - Código CNES', '13 - Código na Operadora'];
    ok('R13 o que a app não sabe sai EM BRANCO (nº guia, senha, CNES, código na operadora, TUSS)',
      EM_BRANCO.every(r => val(r) === '')
      && await page.evaluate(() => SADT.proc.every(pr => pr.codigo === '' && pr.tabela === '')),
      JSON.stringify(EM_BRANCO.map(r => [r, val(r)])));

    // exames digitados na hora, com adicionar/remover linhas e sem re-render
    // A 1ª célula de cada linha é a numeração impressa ("1 -"), então descrição e
    // quantidade são a 4ª e a 5ª coluna.
    const desc = i => `#sadt-proc .r:nth-child(${i}) .c:nth-child(4) input`;
    await page.evaluate(() => { window.__rc2 = 0; const o = window.render; window.render = function () { window.__rc2++; return o.apply(this, arguments); }; });
    await page.type(desc(1), 'TC de torax e abdome com contraste', { delay: 12 });
    await page.type(desc(2), 'Cintilografia ossea', { delay: 12 });
    const rc2 = await page.evaluate(() => window.__rc2);
    ok('R14 digitar exames: 0 re-render', rc2 === 0, 'renders=' + rc2);
    const qtds = await page.evaluate(() => Array.from(document.querySelectorAll('#sadt-proc .r'))
      .map(r => r.querySelectorAll('.c')[4].querySelector('input').value));
    ok('R14 quantidade solicitada só aparece na linha preenchida (linha vazia fica vazia)',
      qtds[0] === '1' && qtds[1] === '1' && qtds[2] === '', JSON.stringify(qtds));
    // O formulário oficial tem CINCO linhas de procedimento, numeradas no papel — não é
    // lista que a app possa crescer. Mais de cinco exames é outra guia, como manda o padrão.
    const nLinhas = await page.evaluate(() => document.querySelectorAll('#sadt-proc .r').length);
    const semBotaoAdd = await page.evaluate(() => !document.querySelector('.tiss .add-lin'));
    ok('R14 bloco de procedimentos tem as 5 linhas fixas do formulário oficial',
      nLinhas === 5 && semBotaoAdd, `linhas=${nLinhas} semBotaoAdd=${semBotaoAdd}`);
    const exames = await page.evaluate(() => SADT.proc.map(pr => pr.descricao).filter(Boolean));
    ok('R14 gancho examesReestadiamento(tumor) devolve vazio (pendência registrada)',
      await page.evaluate(() => examesReestadiamento('mama').length === 0));

    // ---- conferência × papel: mesma árvore, uma folha só ----
    // Editar na conferência TEM de refletir na impressão; se um dia alguém montar uma
    // segunda árvore só para o print, este check quebra — que é o ponto dele.
    await page.evaluate(() => { const el = document.querySelector('#sadt-proc .r:nth-child(1) .c:nth-child(4) input');
      el.value = 'RM de cranio com contraste'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.emulateMedia({ media: 'print' });
    const impresso = await page.evaluate(() => ({
      conferencia: getComputedStyle(document.querySelector('.tiss-nota')).display,
      alturaMm: Math.round(document.querySelector('.tiss').getBoundingClientRect().height / 96 * 25.4),
      descricoes: Array.from(document.querySelectorAll('#sadt-proc .r'))
        .map(r => r.querySelectorAll('.c')[3].querySelector('input').value).filter(Boolean),
      // É a classe na RAIZ que faz valer o `@page guia{size:A4 landscape}`.
      paisagem: document.documentElement.classList.contains('em-guia'),
    }));
    await page.emulateMedia({ media: null });
    ok('R15 impressão: barra de conferência some do papel e a guia vira paisagem',
      impresso.conferencia === 'none' && impresso.paisagem === true,
      `nota=${impresso.conferencia} paisagem=${impresso.paisagem}`);
    ok('R15 a guia cabe em UMA página A4 paisagem (área útil 198mm)',
      impresso.alturaMm > 0 && impresso.alturaMm <= 198, impresso.alturaMm + 'mm');
    ok('R15 o que foi editado na conferência é o que sai impresso',
      impresso.descricoes[0] === 'RM de cranio com contraste'
      && impresso.descricoes.length === exames.length, impresso.descricoes.join(' | '));

    ok('R16 console sem erro vermelho no fluxo inteiro', errs.length === 0, errs.join(' | '));

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
    const tkRev = await token('revisor');
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

    // data_agendada deixou de ser campo do cliente: "para quando este retorno estava
    // previsto" é a agenda do paciente, lida pelo servidor.
    //
    // O check é sobre o VALOR GRAVADO, e não sobre um 400, porque um 400 aqui não existe:
    // o `forbidNonWhitelisted: true` do PIPE da rota é INERTE — o pipe GLOBAL (main.ts)
    // roda antes com whitelist:true e já removeu o campo desconhecido, então não sobra
    // nada para a rota proibir. Verificar o valor é mais forte de qualquer forma: prova
    // que o servidor manda, em vez de provar que o cliente foi barrado.
    const marcado = somarMeses(hoje(), 2);
    await req('POST', `/pacientes/${pacienteId}/retornos`, tkOnco, Object.assign({}, base,
      { com_imagem: false, proximo_intervalo: 'especifica', proximo_retorno: marcado }));
    const rAgendada = await req('POST', `/pacientes/${pacienteId}/retornos`, tkOnco,
      Object.assign({}, base, { com_imagem: false, data_agendada: '2030-01-01' }));
    ok('A7 data_agendada vem da AGENDA do servidor, não do que o cliente mandou',
      rAgendada.status === 201 && rAgendada.body.data_agendada === marcado,
      `${rAgendada.status} → ${rAgendada.body && rAgendada.body.data_agendada} (agenda=${marcado})`);
    const rIntervalo = await req('POST', `/pacientes/${pacienteId}/retornos`, tkOnco,
      Object.assign({}, base, { com_imagem: false, proximo_intervalo: '18m' }));
    ok('A7 proximo_intervalo fora da lista → 400', rIntervalo.status === 400, String(rIntervalo.status));
    const rEspecifica = await req('POST', `/pacientes/${pacienteId}/retornos`, tkOnco,
      Object.assign({}, base, { com_imagem: false, proximo_intervalo: 'especifica' }));
    ok('A7 "especifica" sem data → 400', rEspecifica.status === 400, String(rEspecifica.status));
    // A data é do SERVIDOR: mandar uma data mentirosa junto de um intervalo não cola.
    const rMentira = await req('POST', `/pacientes/${pacienteId}/retornos`, tkOnco,
      Object.assign({}, base, { com_imagem: false, proximo_intervalo: '3s', proximo_retorno: '2030-01-01' }));
    ok('A7 servidor calcula a data do intervalo e ignora a que o cliente mandou',
      rMentira.status === 201 && rMentira.body.proximo_retorno === somarDias(hoje(), 21),
      `${rMentira.status} → ${rMentira.body && rMentira.body.proximo_retorno}`);
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.message);
    try { await page.screenshot({ path: path.join(ROOT, 'portao-retorno-erro.png') }); } catch (_) { }
  } finally {
    // Regra dos portões: devolver o banco como encontrou, SEMPRE. Aqui o portão só
    // CRIA (paciente e, sobre ele, avaliações/retornos/seleções), nunca altera registro
    // preexistente — então devolver como encontrou é apagar, e o DELETE do paciente
    // basta: as três tabelas filhas têm ON DELETE CASCADE. Está no finally de propósito:
    // check que estoura no meio não pode deixar resíduo para a rodada seguinte.
    // ---- limpeza: paciente de teste sai (cascata leva retornos e avaliações) ----
    if (pacienteId) {
      try {
        // Limpeza com LOGIN de verdade da conta de teste admin. Antes isto assinava um
        // JWT com o JWT_SECRET e sub:1 fixo — atalho que dependia do segredo do servidor
        // e presumia que o usuário 1 existia e estava ativo.
        const admin = await token('admin');
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
