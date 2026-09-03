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
    const tkOnco = await token('oncologista');
    const vencidoEm = somarMeses(hoje(), -2);
    await req('PATCH', `/pacientes/${pacienteId}/reestadiamento`, tkOnco, { proximo: vencidoEm });
    await page.evaluate(pid => carregarTrilha(pid).then(() => render()), pacienteId);
    await page.waitForSelector('.reest-venc', { timeout: 15000 });
    const txtVenc = await page.evaluate(() => document.querySelector('.reest-venc .rv-t').textContent);
    const [vy, vm, vd] = vencidoEm.split('-');
    ok('R12 reestadiamento vencido aparece como item pendente destacado',
      txtVenc.includes('vencido desde') && txtVenc.includes(`${vd}/${vm}/${vy}`), txtVenc);

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
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.message);
    try { await page.screenshot({ path: path.join(ROOT, 'portao-retorno-erro.png') }); } catch (_) { }
  } finally {
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
