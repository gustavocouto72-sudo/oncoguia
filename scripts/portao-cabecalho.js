// Portão do CABEÇALHO ONCOLÓGICO (lista de problemas · parte clínica) — Fase 1: modelo,
// tela e edição manual. API direta + fluxos reais em browser isolado (headless). É o check
// que NÃO passa pelo agente.
//
// O que está sob teste (item 13 do pedido):
//  • whitelist: PATCH /pacientes/:id/cabecalho = 403 para secretaria, revisor e auditor;
//  • a secretaria NÃO recebe a chave `cabecalho_oncologico` na leitura (lista e ficha) —
//    e revisor/auditor recebem (contraprova de presença);
//  • ordenação por data PARCIAL (2021 < 01/2021 < 01/01/2021), por tipo, sem completar nada;
//  • sublinha (intercorrência) só em terapêutica; um nível só; fica logo abaixo do pai;
//  • data inválida = 400 (31/02, mês 13, ISO, sem zero à esquerda, ano de 2 dígitos);
//  • remoção gera evento na trilha (append-only, com o autor e o "−linha …");
//  • série de marcador aceita ponto novo e mantém a ordem; nome duplicado = 409;
//  • bloco vazio não quebra a ficha (nem a cópia) — e, para quem edita, o vazio é UMA linha
//    clicável ("+ montar cabeçalho oncológico"): o esqueleto só aparece depois do clique,
//    sem chamada ao servidor; para quem lê, a linha discreta; o botão de copiar segue o TEXTO
//    gerado (some só quando não há nada — nem cabeçalho nem listas);
//  • o texto gerado bate com o GABARITO do formato do guia (comparação exata) — e é o que
//    vai para a área de transferência quando o botão é clicado;
//  • tela: digitar nos formulários não re-renderiza (contador = 0), "+ linha" no summary
//    não abre/fecha a seção, "ver N anteriores" expande, subida e último valor marcados.
//
// Contas: oncologista (tela + API), admin/revisor/auditor (API, .env.local) e uma
// SECRETARIA descartável criada pelo admin e apagada no fim. O revisor entra na tela por
// injeção do token na sessão (localStorage), sem login extra — 5 logins no total.
// NÃO ENCADEIE com outro portão sem ~1 min de janela (login limitado a 5/min por IP).
//
// Limpeza: apaga os dois pacientes e a usuária de teste, SEMPRE (finally). Etiqueta única
// por rodada no registro (TESTE-PORTAO-CAB-<etiqueta>) e no login.
//
// Uso: node scripts/portao-cabecalho.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const { tokenApi, loginNaTela, cred } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';

const ETIQUETA = String(Date.now()).slice(-7);
const LOGIN_S = `portao.cab.${ETIQUETA}`;
const NOME_S = 'Portao Cabecalho Secretaria';
const NOME_P1 = 'Paciente Portao Cabecalho A';
const NOME_P2 = 'Paciente Portao Cabecalho B (vazio → primeira linha pela tela)';
const NOME_P3 = 'Paciente Portao Cabecalho C (vazio, leitura do revisor)';
const IDENT = `TESTE-PORTAO-CAB-${ETIQUETA}`;
// Caso SINTÉTICO (inventado para o portão): nenhuma data, valor ou texto vem de prontuário real.
const TUMOR = 'mama';
const TITULO = `Carcinoma ductal invasivo de mama esquerda — EC IIB ao diagnóstico, atual IV (osso) [${ETIQUETA}]`;
const SUBTITULO = 'RH positivo · HER2 negativo · diagnóstico em 03/2022 · finalidade paliativa';
const STATUS = 'em seguimento sob 1ª linha paliativa; doença óssea estável';

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 200) + ']' : '')); };

async function req(metodo, rota, tk, body) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: Object.assign(tk ? { Authorization: 'Bearer ' + tk } : {}, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch (_) { }
  return { status: r.status, body: j };
}
const patch = (pid, tk, operacoes) => req('PATCH', `/pacientes/${pid}/cabecalho`, tk, { operacoes });
const cabDe = r => (r.body && r.body.cabecalho_oncologico) || {};
const seq = cab => (cab.linhas || []).map(l => (l.pai_id ? '↳' : '') + l.tipo[0] + ':' + (l.data || l.rotulo || '∅')).join(' ');

async function novoContexto(browser) {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  page.on('dialog', async d => d.accept());
  await page.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);
  return { ctx, page, errs };
}
// A lista de pacientes da sessão foi carregada no login, ANTES de o portão criar os seus:
// recarrega antes de abrir (a ficha só abre paciente que está na lista).
async function esperarFicha(page, pid) {
  await page.evaluate(() => carregarPacientes());
  await page.evaluate(id => abrir(id), pid);
  await page.waitForFunction(id => view === 'paciente' && PAC_DETAIL[id] && document.getElementById('co-bloco-in'), pid, { timeout: 25000 });
}
// Contador de render: digitar texto livre NÃO pode re-renderizar — nem a ficha (render)
// nem o bloco (coRepintar). Os dois são instrumentados.
const armarContador = page => page.evaluate(() => {
  window.__rc = 0;
  const o = window.render; window.render = function () { window.__rc++; return o.apply(this, arguments); };
  const c = window.coRepintar; window.coRepintar = function () { window.__rc++; return c.apply(this, arguments); };
});
const lerContador = page => page.evaluate(() => window.__rc);
const textoBloco = page => page.evaluate(() => (document.getElementById('co-bloco') || {}).textContent || '');

(async () => {
  exigirBancoDeDev('cabeçalho oncológico (lista de problemas · Fase 1)');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let tkAdm = null, tkOnco = null, tkRev = null, tkAud = null, tkSec = null, usuarioRev = null;
  let usuarioSId = null;
  const pacientes = [];
  let p1 = null, p2 = null, p3 = null;
  let co = null, cr = null;

  try {
    // ═══ SETUP ═══
    tkAdm = await tokenApi(API, 'admin');
    const cu = await req('POST', '/usuarios', tkAdm, { nome: NOME_S, login: LOGIN_S, perfis: ['secretaria'] });
    usuarioSId = cu.body && cu.body.id;
    const senhaS = cu.body && cu.body.senha_temporaria;
    ok('S0 conta de secretaria descartável criada (perfis = [secretaria])', cu.status === 201 && !!usuarioSId && !!senhaS, String(cu.status));
    tkSec = (await req('POST', '/auth/login', null, { login: LOGIN_S, senha: senhaS })).body.access_token;
    const cr0 = cred('revisor');
    const lr = await req('POST', '/auth/login', null, { login: cr0.login, senha: cr0.senha });
    tkRev = lr.body && lr.body.access_token; usuarioRev = lr.body && lr.body.usuario;
    tkAud = await tokenApi(API, 'auditor');
    // Oncologista: login REAL pela tela; o token dele serve para a API também.
    co = await novoContexto(browser);
    await co.page.goto(APP);
    await loginNaTela(co.page, 'oncologista');
    await co.page.waitForFunction(() => !!localStorage.getItem('oncoguia_token'), null, { timeout: 25000 });
    await co.page.waitForSelector('#nav a', { timeout: 25000 });
    tkOnco = await co.page.evaluate(() => localStorage.getItem('oncoguia_token'));
    ok('S0 tokens: admin, secretaria, revisor, auditor e oncologista (tela)', !!tkAdm && !!tkSec && !!tkRev && !!tkAud && !!tkOnco && !!usuarioRev);
    const NOME_ONCO = ((await req('GET', '/auth/perfil', tkOnco)).body || {}).nome;

    const c1 = await req('POST', '/pacientes', tkOnco, { nome: NOME_P1, identificador: `${IDENT}-A`, sexo: 'F', tumor: TUMOR, nasc: '1942-03-01' });
    p1 = c1.body && c1.body.id; if (p1) pacientes.push(p1);
    const c2 = await req('POST', '/pacientes', tkOnco, { nome: NOME_P2, identificador: `${IDENT}-B`, sexo: 'M', tumor: 'mama', nasc: '1958-01-20' });
    p2 = c2.body && c2.body.id; if (p2) pacientes.push(p2);
    const c3 = await req('POST', '/pacientes', tkOnco, { nome: NOME_P3, identificador: `${IDENT}-C`, sexo: 'F', tumor: 'mama', nasc: '1961-07-07' });
    p3 = c3.body && c3.body.id; if (p3) pacientes.push(p3);
    ok('S0 pacientes de teste criados', !!p1 && !!p2 && !!p3, `${c1.status}/${c2.status}/${c3.status}`);
    for (const [lista, adicionar] of [['comorbidades', ['HAS', 'DM2']], ['medicacoes_uso', ['Metformina 850 mg']], ['alergias', ['Penicilina']]]) {
      const r = await req('PATCH', `/pacientes/${p1}/lista-problemas`, tkOnco, { lista, adicionar });
      if (r.status !== 200) ok(`S0 lista ${lista}`, false, String(r.status));
    }
    // P3: cabeçalho vazio MAS com comorbidade — é o paciente real do dia do deploy: há o que copiar.
    const r3l = await req('PATCH', `/pacientes/${p3}/lista-problemas`, tkOnco, { lista: 'comorbidades', adicionar: ['DPOC'] });
    if (r3l.status !== 200) ok('S0 lista de P3', false, String(r3l.status));

    // ═══ FASE 1 — API ═══
    // --- bloco vazio ---
    const g0 = await req('GET', `/pacientes/${p1}`, tkOnco);
    ok('A1 ficha nova traz cabecalho_oncologico = {} (objeto vazio, nunca ausente para o perfil clínico)',
      g0.status === 200 && g0.body && typeof g0.body.cabecalho_oncologico === 'object' && Object.keys(g0.body.cabecalho_oncologico).length === 0, JSON.stringify(g0.body && g0.body.cabecalho_oncologico));

    // --- ordenação por data parcial, seções e título ---
    const r1 = await patch(p1, tkOnco, [
      { op: 'titulo', texto: TITULO },
      { op: 'subtitulo', texto: SUBTITULO },
      { op: 'linha_adicionar', tipo: 'terapeutica', data: '22/08/2025', texto: '1ª linha paliativa — Letrozol + Ribociclibe' },
      { op: 'linha_adicionar', tipo: 'propedeutica', data: '01/01/2021', texto: 'Linha completa' },
      { op: 'linha_adicionar', tipo: 'propedeutica', data: '2021', texto: 'Linha só com o ano' },
      { op: 'linha_adicionar', tipo: 'propedeutica', data: '01/2021', texto: 'Linha mês/ano' },
      { op: 'linha_adicionar', tipo: 'apresentacao', data: '02/2022', texto: 'Nódulo palpável em quadrante superior externo da mama esquerda' },
      { op: 'linha_adicionar', tipo: 'propedeutica', texto: 'Linha sem data nenhuma' },
      { op: 'linha_adicionar', tipo: 'terapeutica', data: '05/04/2022', texto: 'QT neoadjuvante — Doxorrubicina + Ciclofosfamida, 4 ciclos' },
      { op: 'linha_adicionar', tipo: 'propedeutica', data: '14/03/2022', texto: 'Core biopsy: carcinoma ductal invasivo, grau 2' },
      { op: 'linha_adicionar', tipo: 'propedeutica', data: '11/09/2025', texto: 'Cintilografia óssea (reestadiamento): lesões em L3 e ilíaco direito estáveis; sem lesões novas' },
    ]);
    const cab1 = cabDe(r1);
    ok('A2 ★ PATCH com linhas fora de ordem = 200; resposta ordenada por tipo e por data PARCIAL (2021 < 01/2021 < 01/01/2021), sem data no fim da seção',
      r1.status === 200 && seq(cab1) === 'a:02/2022 p:2021 p:01/2021 p:01/01/2021 p:14/03/2022 p:11/09/2025 p:∅ t:05/04/2022 t:22/08/2025', seq(cab1));
    ok('A2 data parcial fica PARCIAL na resposta (2021 e 01/2021 não viraram dia)',
      (cab1.linhas || []).some(l => l.data === '2021') && (cab1.linhas || []).some(l => l.data === '01/2021'));
    ok('A2 título e subtítulo gravados com autor e instante do servidor',
      cab1.titulo && cab1.titulo.texto === TITULO && cab1.titulo.por && cab1.titulo.por.nome === NOME_ONCO && !!cab1.titulo.em && cab1.subtitulo && cab1.subtitulo.texto === SUBTITULO);
    ok('A2 cada linha nasce com origem "manual", autor e instante', (cab1.linhas || []).every(l => l.origem === 'manual' && l.por && l.por.nome === NOME_ONCO && l.em && l.id));
    ok('A2 o PATCH devolve o evento da trilha com os "+" (nota começa com "Cabeçalho oncológico atualizado por")',
      r1.body.evento && /^Cabeçalho oncológico atualizado por /.test(r1.body.evento.nota) && r1.body.evento.nota.includes('+linha terapêutica 22/08/2025') && r1.body.evento.tipo === 'cabecalho_oncologico', r1.body.evento && r1.body.evento.nota);

    // --- sublinha só em terapêutica, um nível, logo abaixo do pai ---
    const pai = cab1.linhas.find(l => l.data === '05/04/2022');
    const prop = cab1.linhas.find(l => l.data === '14/03/2022');
    const rs1 = await patch(p1, tkOnco, [{ op: 'linha_adicionar', pai_id: prop.id, rotulo: 'S1', texto: 'x' }]);
    ok('A3 ★ intercorrência sob linha PROPEDÊUTICA = 400 (só terapêutica aceita filhos)', rs1.status === 400 && /terapêutica/.test(rs1.body.message), `${rs1.status} ${rs1.body && rs1.body.message}`);
    const rs2 = await patch(p1, tkOnco, [
      { op: 'linha_adicionar', pai_id: pai.id, rotulo: 'S3', texto: 'Neutropenia febril, internação' },
      { op: 'linha_adicionar', pai_id: pai.id, rotulo: 'S11', texto: 'Anemia G3 — ciclo adiado' },
      { op: 'linha_adicionar', pai_id: pai.id, rotulo: 'S1', texto: 'Náusea G2' },
    ]);
    const cab2 = cabDe(rs2);
    ok('A3 ★ intercorrências sob linha TERAPÊUTICA = 200; ficam logo abaixo do pai, em ordem natural de rótulo (S1 < S3 < S11), antes do tratamento seguinte',
      rs2.status === 200 && seq(cab2).includes('t:05/04/2022 ↳t:S1 ↳t:S3 ↳t:S11 t:22/08/2025'), seq(cab2));
    ok('A3 intercorrência herda tipo terapêutica e aponta para o pai', cab2.linhas.filter(l => l.pai_id === pai.id).every(l => l.tipo === 'terapeutica'));
    const filho = cab2.linhas.find(l => l.rotulo === 'S3');
    const rs3 = await patch(p1, tkOnco, [{ op: 'linha_adicionar', pai_id: filho.id, texto: 'neto' }]);
    ok('A3 intercorrência de intercorrência = 400 (um nível só)', rs3.status === 400, `${rs3.status}`);
    const rs4 = await patch(p1, tkOnco, [{ op: 'linha_adicionar', pai_id: pai.id, tipo: 'apresentacao', texto: 'tipo divergente' }]);
    ok('A3 intercorrência com tipo diferente do pai = 400', rs4.status === 400, `${rs4.status}`);

    // --- datas inválidas ---
    const ruins = ['31/02/2026', '13/2026', '2026-03-10', '1/3/2026', '03/26', '00/2026', '1850', 'ontem'];
    const statusRuins = {};
    for (const d of ruins) statusRuins[d] = (await patch(p1, tkOnco, [{ op: 'linha_adicionar', tipo: 'apresentacao', data: d, texto: 't' }])).status;
    ok('A4 ★ data inválida = 400 em todas as formas (31/02, mês 13, ISO, sem zero, ano de 2 dígitos, mês 00, ano < 1900, texto)',
      Object.values(statusRuins).every(s => s === 400), JSON.stringify(statusRuins));
    const gA4 = await req('GET', `/pacientes/${p1}`, tkOnco);
    ok('A4 nenhuma das tentativas inválidas gravou linha (nada é aceito "em parte")', (cabDe(gA4).linhas || []).length === cab2.linhas.length);
    const rt = await patch(p1, tkOnco, [{ op: 'linha_adicionar', tipo: 'exame', texto: 't' }]);
    ok('A4 tipo fora do vocabulário = 400', rt.status === 400, `${rt.status} ${rt.body && rt.body.message}`);
    const rop = await patch(p1, tkOnco, [{ op: 'apagar_tudo' }]);
    ok('A4 operação desconhecida = 400', rop.status === 400, `${rop.status}`);

    // --- marcador em série ---
    const rm1 = await patch(p1, tkOnco, [{ op: 'marcador_adicionar', nome: 'CEA', unidade: 'ng/mL', pontos: [{ valor: '12', data: '06/2022' }, { valor: '48', data: '03/2022' }, { valor: '5', data: '10/2022' }] }]);
    const mk1 = (cabDe(rm1).marcadores || [])[0];
    ok('A5 ★ marcador criado com pontos fora de ordem; a série volta ORDENADA por data', rm1.status === 200 && mk1 && mk1.pontos.map(p => p.valor).join(',') === '48,12,5', mk1 && mk1.pontos.map(p => p.valor + '@' + p.data).join(' '));
    const rm2 = await patch(p1, tkOnco, [{ op: 'ponto_adicionar', marcador_id: mk1.id, valor: '31', data: '04/2025' }, { op: 'ponto_adicionar', marcador_id: mk1.id, valor: '8', data: '08/2022' }]);
    const mk2 = (cabDe(rm2).marcadores || [])[0];
    ok('A5 ★ ponto novo entra e a ordem se mantém (8 em 08/2022 cai entre 12 e 5)', rm2.status === 200 && mk2.pontos.map(p => p.valor).join(',') === '48,12,8,5,31', mk2.pontos.map(p => p.valor + '@' + p.data).join(' '));
    const rm3 = await patch(p1, tkOnco, [{ op: 'marcador_adicionar', nome: 'cea' }]);
    ok('A5 marcador com o mesmo nome (sem caixa) = 409', rm3.status === 409, `${rm3.status}`);
    const rm4 = await patch(p1, tkOnco, [{ op: 'ponto_remover', marcador_id: mk1.id, valor: '8', data: '08/2022' }]);
    ok('A5 ponto removido pelo par valor+data; evento diz "−ponto CEA 8 (08/2022)"', rm4.status === 200 && cabDe(rm4).marcadores[0].pontos.length === 4 && rm4.body.evento.nota.includes('−ponto CEA 8 (08/2022)'), rm4.body.evento && rm4.body.evento.nota);
    const rm5 = await patch(p1, tkOnco, [{ op: 'ponto_adicionar', marcador_id: mk1.id, valor: '12', data: '2026-01-01' }]);
    ok('A5 ponto com data inválida = 400', rm5.status === 400);
    await patch(p1, tkOnco, [{ op: 'ponto_adicionar', marcador_id: mk1.id, valor: '9', data: '08/2025' }]);   // série final: 48 → 12 → 5 → 31 → 9

    // --- status e remoção com rastro ---
    const rstat = await patch(p1, tkOnco, [{ op: 'status_atual', texto: STATUS }]);
    ok('A6 status atual gravado', rstat.status === 200 && cabDe(rstat).status_atual && cabDe(rstat).status_atual.texto === STATUS);
    const trilhaAntes = (await req('GET', `/pacientes/${p1}/trilha`, tkOnco)).body.itens.filter(i => i.evento === 'cabecalho_oncologico');
    const semData = cab2.linhas.find(l => l.texto === 'Linha sem data nenhuma');
    const rrem = await patch(p1, tkOnco, [{ op: 'linha_remover', id: semData.id }]);
    const trilhaDepois = (await req('GET', `/pacientes/${p1}/trilha`, tkOnco)).body.itens.filter(i => i.evento === 'cabecalho_oncologico');
    ok('A6 ★ remoção de linha = 200 e gera evento na TRILHA (append-only): um item a mais, tipo administrativo, nota com "−linha propedêutica", autor = oncologista',
      rrem.status === 200 && trilhaDepois.length === trilhaAntes.length + 1
      && trilhaDepois.some(i => i.tipo === 'administrativo' && /−linha propedêutica/.test(i.nota) && i.por && i.por.nome === NOME_ONCO),
      `${trilhaAntes.length} → ${trilhaDepois.length}`);
    ok('A6 a linha removida não está mais no cabeçalho', !(cabDe(rrem).linhas || []).some(l => l.id === semData.id));
    const rnop = await patch(p1, tkOnco, [{ op: 'status_atual', texto: STATUS }]);
    const trilhaNop = (await req('GET', `/pacientes/${p1}/trilha`, tkOnco)).body.itens.filter(i => i.evento === 'cabecalho_oncologico');
    ok('A6 PATCH sem mudança efetiva (mesmo texto) = 200 com evento null e NADA novo na trilha', rnop.status === 200 && rnop.body.evento === null && trilhaNop.length === trilhaDepois.length);
    const rrem2 = await patch(p1, tkOnco, [{ op: 'linha_remover', id: 'nao-existe' }]);
    ok('A6 remover linha inexistente = 404', rrem2.status === 404);

    // --- whitelist ---
    const opW = [{ op: 'titulo', texto: 'INVASAO' }];
    const wS = await patch(p1, tkSec, opW), wR = await patch(p1, tkRev, opW), wA = await patch(p1, tkAud, opW);
    ok('W1 ★ PATCH /cabecalho = 403 para SECRETARIA', wS.status === 403, `${wS.status}`);
    ok('W1 ★ PATCH /cabecalho = 403 para REVISOR', wR.status === 403, `${wR.status}`);
    ok('W1 PATCH /cabecalho = 403 para AUDITOR', wA.status === 403, `${wA.status}`);
    const gT = await req('GET', `/pacientes/${p1}`, tkOnco);
    ok('W1 nenhuma das três tentativas alterou o título', cabDe(gT).titulo.texto === TITULO);
    const gS = await req('GET', `/pacientes/${p1}`, tkSec);
    const lS = await req('GET', '/pacientes', tkSec);
    const linhaS = (lS.body || []).find(p => p.id === p1);
    ok('W2 ★ GET /pacientes/:id (secretaria) = 200 SEM a chave cabecalho_oncologico — e o JSON dela não contém o título',
      gS.status === 200 && gS.body && !Object.prototype.hasOwnProperty.call(gS.body, 'cabecalho_oncologico') && !JSON.stringify(gS.body).includes('Carcinoma ductal'), Object.keys(gS.body || {}).join(','));
    ok('W2 GET /pacientes (secretaria): a linha do paciente também não traz a chave nem o título',
      lS.status === 200 && !!linhaS && !Object.prototype.hasOwnProperty.call(linhaS, 'cabecalho_oncologico') && !JSON.stringify(lS.body).includes('Carcinoma ductal'));
    ok('W2 a ficha da secretaria não traz o evento do cabeçalho nos eventos administrativos dela',
      !(gS.body.eventos_administrativos || []).some(e => e.tipo === 'cabecalho_oncologico'));
    const gR = await req('GET', `/pacientes/${p1}`, tkRev), gA = await req('GET', `/pacientes/${p1}`, tkAud);
    ok('W3 contraprova: REVISOR e AUDITOR recebem a chave com o título (leem, não escrevem)',
      gR.status === 200 && cabDe(gR).titulo && cabDe(gR).titulo.texto === TITULO && gA.status === 200 && cabDe(gA).titulo && cabDe(gA).titulo.texto === TITULO);

    // ═══ FASE 2 — TELA do oncologista ═══
    const po = co.page;
    await esperarFicha(po, p1);
    const html1 = await po.evaluate(() => document.getElementById('co-bloco').innerHTML);
    const txt1 = await textoBloco(po);
    ok('U1 ★ o bloco "Lista de problemas · cabeçalho oncológico" aparece ACIMA das três caixas, com título, subtítulo e as três etiquetas',
      txt1.includes('Lista de problemas · cabeçalho oncológico') && txt1.includes(TITULO) && txt1.includes(SUBTITULO)
      && html1.includes('co-tag apresentacao') && html1.includes('co-tag propedeutica') && html1.includes('co-tag terapeutica')
      && await po.evaluate(() => { const a = document.getElementById('co-bloco'), b = document.getElementById('lp-faixa'); return !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0; }));
    ok('U1 as três caixas de baixo continuam (comorbidades, medicações, alergias)', await po.evaluate(() => document.querySelectorAll('#lp-faixa .lp-box').length === 3));
    ok('U1 botões "Copiar para o prontuário" e "+ Linha" no cabeçalho do bloco', txt1.includes('Copiar para o prontuário') && /\+ Linha/.test(txt1));
    // seções e recolhimento
    const secs = await po.evaluate(() => Array.from(document.querySelectorAll('details.co-sec')).map(d => [d.getAttribute('data-tipo'), d.open]));
    ok('U2 três seções <details>, abertas por padrão', secs.length === 3 && secs.every(s => s[1] === true), JSON.stringify(secs));
    const antesClique = await po.evaluate(() => document.querySelector('details.co-sec[data-tipo="terapeutica"]').open);
    await po.click('details.co-sec[data-tipo="terapeutica"] > summary .co-add');
    await po.waitForSelector('#co-form', { timeout: 5000 });
    const depoisClique = await po.evaluate(() => document.querySelector('details.co-sec[data-tipo="terapeutica"]').open);
    ok('U2 ★ "+ linha" no summary abre o formulário e NÃO fecha a seção (stopPropagation)', antesClique === true && depoisClique === true && !!(await po.$('details.co-sec[data-tipo="terapeutica"] #co-form')));
    await po.evaluate(() => coFecharForm());
    await po.click('details.co-sec[data-tipo="apresentacao"] > summary');
    await po.waitForTimeout(150);
    const fechada = await po.evaluate(() => { const d = document.querySelector('details.co-sec[data-tipo="apresentacao"]'); return { open: d.open, resumoVisivel: getComputedStyle(d.querySelector('.co-resumo')).display !== 'none', resumo: d.querySelector('.co-resumo').textContent }; });
    ok('U2 seção fechada mostra o resumo no summary ("1 linha · última 02/2022")', fechada.open === false && fechada.resumoVisivel && /1 linha · última 02\/2022/.test(fechada.resumo), JSON.stringify(fechada));
    await po.click('details.co-sec[data-tipo="apresentacao"] > summary');
    // "ver N anteriores": propedêutica tem 5 linhas de topo → 3 visíveis + 2 anteriores
    const vm = await po.evaluate(() => { const d = document.querySelector('details.co-sec[data-tipo="propedeutica"]'); return { linhas: d.querySelectorAll('.co-row').length, btn: (d.querySelector('.co-vermais') || {}).textContent || '' }; });
    ok('U3 ★ propedêutica mostra só as 3 mais recentes e "▸ ver 2 anteriores"', vm.linhas === 3 && /ver 2 anteriores/.test(vm.btn), JSON.stringify(vm));
    await po.click('details.co-sec[data-tipo="propedeutica"] .co-vermais');
    await po.waitForTimeout(100);
    const vm2 = await po.evaluate(() => { const d = document.querySelector('details.co-sec[data-tipo="propedeutica"]'); return { linhas: d.querySelectorAll('.co-row').length, btn: !!d.querySelector('.co-vermais'), primeira: (d.querySelector('.co-row .dt') || {}).textContent }; });
    ok('U3 expandiu: 5 linhas, sem botão, a primeira é a de 2021 (ordem cronológica)', vm2.linhas === 5 && !vm2.btn && vm2.primeira === '2021', JSON.stringify(vm2));
    // sublinhas
    const subs = await po.evaluate(() => Array.from(document.querySelectorAll('details.co-sec[data-tipo="terapeutica"] .co-row')).map(r => (r.classList.contains('filha') ? '↳' : '') + r.querySelector('.dt').textContent));
    ok('U4 intercorrências indentadas (↳) logo abaixo da QT neoadjuvante, antes da 1ª linha paliativa', subs.join(' ') === '05/04/2022 ↳S1 ↳S3 ↳S11 22/08/2025', subs.join(' '));
    // marcador: subida e último
    const serie = await po.evaluate(() => Array.from(document.querySelectorAll('.co-mk .co-serie .pt')).map(s => s.className.replace('pt', '').trim() + ':' + s.textContent.replace('×', '').trim()));
    ok('U5 ★ série do marcador: 31 marcado como SUBIDA (up) em relação a 5, o último (9) em destaque (last), datas curtas', serie.join(' | ') === ':48 03/22 | :12 06/22 | :5 10/22 | up:31 04/25 | last:9 08/25', serie.join(' | '));
    // digitar não re-renderiza
    await po.click('details.co-sec[data-tipo="apresentacao"] > summary .co-add');
    await po.waitForSelector('#co_texto', { timeout: 5000 });
    await armarContador(po);
    await po.type('#co_data', '03/2022');
    await po.type('#co_texto', 'Perda ponderal de 4 kg em 3 meses, digitada devagar');
    const rc = await lerContador(po);
    ok('U6 ★ digitar data e texto no formulário NÃO re-renderiza (contador = 0)', rc === 0, `render=${rc}`);
    const estado = await po.evaluate(() => ({ data: CO_FORM.data, texto: CO_FORM.texto }));
    ok('U6 o que foi digitado está no estado (CO_FORM), não só no DOM', estado.data === '03/2022' && /Perda ponderal/.test(estado.texto));
    await po.click('#co-form .btn.primary');
    await po.waitForFunction(id => !CO_FORM && (coDados(id).linhas || []).some(l => l.data === '03/2022'), p1, { timeout: 15000 });
    const txtU6 = await textoBloco(po);
    ok('U6 ★ linha gravada pela tela: aparece na apresentação, depois de 02/2022, e o cache da ficha foi atualizado',
      txtU6.includes('Perda ponderal de 4 kg') && await po.evaluate(() => Array.from(document.querySelectorAll('details.co-sec[data-tipo="apresentacao"] .co-row .dt')).map(d => d.textContent).join(' ') === '02/2022 03/2022'));
    // edição de título pela tela
    await po.click('#co-bloco .co-title');
    await po.waitForSelector('#co_texto', { timeout: 5000 });
    await armarContador(po);
    await po.type('#co_texto', ' — editado');
    ok('U7 editar o título: digitar não re-renderiza', (await lerContador(po)) === 0);
    await po.click('#co-form .btn.primary');
    await po.waitForFunction(t => !CO_FORM && document.querySelector('#co-bloco .co-title').textContent === t, TITULO + ' — editado', { timeout: 15000 });
    ok('U7 título editado aparece no bloco', true);
    await patch(p1, tkOnco, [{ op: 'titulo', texto: TITULO }]);   // volta ao gabarito
    await po.evaluate(id => { delete PAC_DETAIL[id]; abrir(id); }, p1);
    await po.waitForFunction(id => PAC_DETAIL[id] && document.getElementById('co-bloco-in'), p1, { timeout: 25000 });
    // remoção pela tela (confirm aceito pelo handler de dialog) e trilha
    await po.evaluate(id => { const l = coDados(id).linhas.find(x => x.rotulo === 'S11'); coRemoverLinha(id, l.id); }, p1);
    await po.waitForFunction(id => !(coDados(id).linhas || []).some(l => l.rotulo === 'S11'), p1, { timeout: 15000 });
    await po.evaluate(id => abrir(id, 'trilha'), p1);
    await po.waitForFunction(id => view === 'paciente' && pacTab === 'trilha' && TRILHA[id] && TRILHA[id].itens, p1, { timeout: 25000 });
    const txtT = await po.evaluate(() => document.getElementById('app').textContent);
    ok('U8 ★ na trilha: "Cabeçalho oncológico atualizado" como item administrativo, com o autor e a nota "−linha terapêutica (intercorrência) S11"',
      txtT.includes('Cabeçalho oncológico atualizado') && txtT.includes('−linha terapêutica (intercorrência) S11') && txtT.includes(NOME_ONCO));
    await po.evaluate(id => abrir(id), p1);
    // abrir() renderiza com o detalhe ANTIGO antes de recarregar — exigir PAC_DETAIL[id] evita ler o bloco no meio da recarga.
    await po.waitForFunction(id => view === 'paciente' && pacTab !== 'trilha' && PAC_DETAIL[id] && document.getElementById('co-bloco-in'), p1, { timeout: 25000 });

    // --- COPIAR PARA O PRONTUÁRIO: gabarito exato + área de transferência ---
    const GABARITO = [
      TITULO.toLocaleUpperCase('pt-BR'),
      SUBTITULO,
      '',
      '- Linha só com o ano (2021)',
      '- Linha mês/ano (01/2021)',
      '- Linha completa (01/01/2021)',
      '- Nódulo palpável em quadrante superior externo da mama esquerda (02/2022)',
      '- Perda ponderal de 4 kg em 3 meses, digitada devagar (03/2022)',
      '- Core biopsy (14/03/2022): carcinoma ductal invasivo, grau 2',
      '- QT neoadjuvante (05/04/2022): Doxorrubicina + Ciclofosfamida, 4 ciclos',
      '     > Náusea G2 (S1); Neutropenia febril, internação (S3)',
      '- 1ª linha paliativa (22/08/2025): Letrozol + Ribociclibe',
      '- Cintilografia óssea (reestadiamento) (11/09/2025): lesões em L3 e ilíaco direito estáveis; sem lesões novas',
      `- Status atual: ${STATUS}`,
      '',
      'Comorbidades: HAS; DM2',
      '',
      'Alergias: Penicilina',
      '',
      'Medicações de uso domiciliar: Metformina 850 mg',
      '',
      'Marcadores tumorais:',
      'CEA (ng/mL): 48 (03/2022) -> 12 (06/2022) -> 5 (10/2022) -> 31 (04/2025) -> 9 (08/2025)',
      '',
      'Exames relevantes:',
      'Cintilografia óssea (reestadiamento) (11/09/2025): lesões em L3 e ilíaco direito estáveis; sem lesões novas',
    ].join('\n');
    const gerado = await po.evaluate(id => coTextoProntuario(id), p1);
    const iguais = gerado === GABARITO;
    if (!iguais) {
      const a = gerado.split('\n'), b = GABARITO.split('\n');
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log(`   diff linha ${i + 1}:\n     gerado:   ${JSON.stringify(a[i])}\n     gabarito: ${JSON.stringify(b[i])}`); break; }
    }
    ok('C1 ★★ texto do prontuário IGUAL ao gabarito do guia (título em caixa, cronologia mesclada por data parcial, "> " sob o tratamento, listas, marcadores com setas, exames relevantes)', iguais, `${gerado.length} chars`);
    // "> " da intercorrência e "->" das setas são do guia; fora isso, nenhum sinal de marcação.
    ok('C1 texto puro: sem markdown, asterisco, emoji ou tag', !/[*#_`<>]|[\u{1F300}-\u{1FAFF}]/u.test(gerado.replace(/^\s+> /gm, '').replace(/ -> /g, ' ')));
    await po.evaluate(() => { window.__toast = null; const o = window.toast; window.toast = function (m) { window.__toast = m; return o.apply(this, arguments); }; });
    await po.click('#co-bloco .co-head .btn.ghost');
    await po.waitForFunction(() => !!window.__toast, null, { timeout: 5000 });
    const clip = await po.evaluate(() => navigator.clipboard.readText());
    ok('C2 ★ o botão copia exatamente esse texto para a ÁREA DE TRANSFERÊNCIA e confirma com aviso discreto', clip === GABARITO && /copiado/i.test(await po.evaluate(() => window.__toast)), await po.evaluate(() => window.__toast));

    // --- ESTADO VAZIO na tela de quem edita: uma linha, esqueleto só depois do clique ---
    await esperarFicha(po, p2);
    const vazio1 = await po.evaluate(() => { const b = document.getElementById('co-bloco'); return { txt: b.textContent, details: b.querySelectorAll('details.co-sec').length, montar: !!b.querySelector('.co-montar'), copiar: /Copiar para o prontuário/.test(b.textContent), placeholders: b.querySelectorAll('.co-ph').length, status: !!b.querySelector('.co-status'), mk: !!b.querySelector('.co-mk-add') }; });
    ok('U9 ★ paciente sem cabeçalho (oncologista): só o título do bloco e UMA linha "+ montar cabeçalho oncológico" — sem seções, placeholders, status, marcador nem botão de copiar',
      vazio1.txt.includes('Lista de problemas · cabeçalho oncológico') && vazio1.montar && vazio1.details === 0 && vazio1.placeholders === 0 && !vazio1.status && !vazio1.mk && !vazio1.copiar && !/\+ Linha/.test(vazio1.txt) && !vazio1.txt.includes('undefined') && !vazio1.txt.includes('null'),
      JSON.stringify(vazio1).slice(0, 200));
    const vazioGerado = await po.evaluate(id => coTextoProntuario(id), p2);
    ok('U9 cópia do paciente vazio = texto vazio (nada de "sem dados" inventado)', vazioGerado === '', JSON.stringify(vazioGerado));
    // o clique é estado de SESSÃO: nenhuma chamada ao servidor
    const reqs = []; const ouvir = r => { if (r.url().startsWith(API)) reqs.push(r.method() + ' ' + r.url().slice(API.length)); };
    po.on('request', ouvir);
    await po.click('#co-bloco .co-montar');
    await po.waitForSelector('#co-bloco details.co-sec', { timeout: 5000 });
    await po.waitForTimeout(300);
    po.off('request', ouvir);
    const vazio2 = await po.evaluate(() => { const b = document.getElementById('co-bloco'); return { details: b.querySelectorAll('details.co-sec').length, placeholders: b.querySelectorAll('.co-ph').length, status: !!b.querySelector('.co-status'), mk: !!b.querySelector('.co-mk-add'), montar: !!b.querySelector('.co-montar'), copiar: /Copiar para o prontuário/.test(b.textContent), flag: CO_UI.montar[current] === true }; });
    ok('U9 ★ o clique revela o esqueleto completo (3 seções, placeholders de título/subtítulo, status, "+ marcador") com ZERO chamada ao servidor — é flag de sessão (CO_UI.montar)',
      vazio2.details === 3 && vazio2.placeholders >= 2 && vazio2.status && vazio2.mk && !vazio2.montar && vazio2.flag && reqs.length === 0, `reqs=${JSON.stringify(reqs)} ${JSON.stringify(vazio2)}`);
    ok('U9 mesmo com o esqueleto aberto, "Copiar para o prontuário" continua ausente (ainda não há o que copiar)', !vazio2.copiar);
    // primeira linha pela tela: digitar sem re-render, gravar, e a recarga mostra o bloco normal sem flag
    await po.click('details.co-sec[data-tipo="apresentacao"] > summary .co-add');
    await po.waitForSelector('#co_texto', { timeout: 5000 });
    await armarContador(po);
    await po.type('#co_data', '2025');
    await po.type('#co_texto', 'Primeira linha do cabeçalho, digitada na tela');
    ok('U9 primeira linha: digitar não re-renderiza (contador = 0)', (await lerContador(po)) === 0);
    await po.click('#co-form .btn.primary');
    await po.waitForFunction(id => !CO_FORM && (coDados(id).linhas || []).length === 1, p2, { timeout: 15000 });
    const vazio3 = await po.evaluate(() => { const b = document.getElementById('co-bloco'); return { details: b.querySelectorAll('details.co-sec').length, linhas: b.querySelectorAll('.co-row').length, copiar: /Copiar para o prontuário/.test(b.textContent), montar: !!b.querySelector('.co-montar') }; });
    ok('U9 ★ primeira linha gravada: bloco normal (3 seções, 1 linha) e o botão de copiar APARECE', vazio3.details === 3 && vazio3.linhas === 1 && vazio3.copiar && !vazio3.montar, JSON.stringify(vazio3));
    await po.evaluate(id => { delete CO_UI.montar[id]; delete PAC_DETAIL[id]; abrir(id); }, p2);
    await po.waitForFunction(id => PAC_DETAIL[id] && document.getElementById('co-bloco-in'), p2, { timeout: 25000 });
    const vazio4 = await po.evaluate(() => { const b = document.getElementById('co-bloco'); return { details: b.querySelectorAll('details.co-sec').length, linhas: b.querySelectorAll('.co-row').length, copiar: /Copiar para o prontuário/.test(b.textContent), montar: !!b.querySelector('.co-montar'), flag: CO_UI.montar[current] }; });
    ok('U9 ★ recarga da ficha SEM a flag: com conteúdo, o bloco normal vem direto (a flag só existe para o vazio)', vazio4.details === 3 && vazio4.linhas === 1 && vazio4.copiar && !vazio4.montar && vazio4.flag === undefined, JSON.stringify(vazio4));
    // P3: cabeçalho vazio + comorbidade → "+ montar" E o botão de copiar (o texto não é vazio)
    await esperarFicha(po, p3);
    const p3o = await po.evaluate(id => { const b = document.getElementById('co-bloco'); return { montar: !!b.querySelector('.co-montar'), details: b.querySelectorAll('details.co-sec').length, copiar: /Copiar para o prontuário/.test(b.textContent), texto: coTextoProntuario(id) }; }, p3);
    ok('U9 ★ cabeçalho vazio mas com comorbidade (oncologista): a linha "+ montar" continua, sem esqueleto, e o botão de copiar APARECE — o texto gerado não é vazio',
      p3o.montar && p3o.details === 0 && p3o.copiar && p3o.texto === 'Comorbidades: DPOC', JSON.stringify(p3o));
    ok('U10 console do oncologista sem erro', co.errs.length === 0, JSON.stringify(co.errs));

    // ═══ FASE 3 — TELA do revisor (somente leitura), sessão injetada ═══
    cr = await novoContexto(browser);
    await cr.page.addInitScript(s => { localStorage.setItem('oncoguia_token', s.t); localStorage.setItem('oncoguia_usuario', JSON.stringify(s.u)); }, { t: tkRev, u: usuarioRev });
    await cr.page.goto(APP);
    await cr.page.waitForSelector('#nav a', { timeout: 25000 });
    await esperarFicha(cr.page, p1);
    const htmlR = await cr.page.evaluate(() => document.getElementById('co-bloco').innerHTML);
    const txtR = await textoBloco(cr.page);
    ok('R1 ★ revisor VÊ o cabeçalho (título, linhas, série) mas sem "+ Linha", "+ linha", ×, "+ ponto" nem campos editáveis',
      txtR.includes(TITULO) && txtR.includes('QT neoadjuvante') && htmlR.includes('co-serie')
      && !/\+ Linha/.test(txtR) && !htmlR.includes('co-add') && !htmlR.includes('class="acts"') && !htmlR.includes('co-edit pode') && !htmlR.includes('co-status pode'));
    ok('R1 revisor tem o botão "Copiar para o prontuário" (leitura)', txtR.includes('Copiar para o prontuário'));
    await esperarFicha(cr.page, p3);
    const vazioR = await cr.page.evaluate(() => { const b = document.getElementById('co-bloco'); return { txt: b.textContent, details: b.querySelectorAll('details.co-sec').length, montar: !!b.querySelector('.co-montar'), copiar: /Copiar para o prontuário/.test(b.textContent) }; });
    ok('R3 ★ cabeçalho vazio para o REVISOR: a linha discreta "— cabeçalho oncológico ainda não preenchido —", sem "+ montar", sem seções; o botão de copiar existe porque a comorbidade dá texto',
      vazioR.txt.includes('cabeçalho oncológico ainda não preenchido') && !vazioR.montar && vazioR.details === 0 && vazioR.copiar, JSON.stringify(vazioR).slice(0, 160));
    ok('R2 console do revisor sem erro', cr.errs.length === 0, JSON.stringify(cr.errs));
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.stack || e.message);
  } finally {
    if (co) { try { await co.ctx.close(); } catch (_) { } }
    if (cr) { try { await cr.ctx.close(); } catch (_) { } }
    const tk = tkAdm || await tokenApi(API, 'admin').catch(() => null);
    for (const pid of pacientes) {
      try {
        const del = await req('DELETE', `/pacientes/${pid}`, tk);
        ok(`Z limpeza: paciente ${pid} removido`, del.status === 200 || del.status === 204, String(del.status));
      } catch (e) { ok(`Z limpeza: paciente ${pid} removido`, false, e.message); }
    }
    if (usuarioSId) {
      try {
        const del = await req('DELETE', `/usuarios/${usuarioSId}`, tk);
        ok('Z limpeza: usuária de teste removida', del.status === 200 || del.status === 204, String(del.status));
      } catch (e) { ok('Z limpeza: usuária de teste removida', false, e.message); }
    }
    await Promise.race([browser.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
    const falhas = R.filter(r => !r[0]).length;
    console.log(`\n${R.length - falhas}/${R.length} checks passaram` + (falhas ? ` — ${falhas} FALHA(S)` : ' — portão OK'));
    process.exit(falhas ? 1 : 0);
  }
})();
