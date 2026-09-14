// Portão do PERFIL SECRETARIA — cadastro administrativo, sem dado clínico.
// Fluxos reais em browser isolado (headless) + API. É o check que NÃO passa pelo agente.
//
// A fronteira sob teste: administrativo = dela; clínico = nunca. E o corte é do SERVIDOR:
// o GET /pacientes dela não CARREGA tumor/protocolo/semáforo (payload reduzido no SELECT),
// não é a tela escondendo. Por isso a matriz é nas DUAS pontas (API direta + tela) e com
// testes AFIRMATIVOS de ausência: a resposta dela NÃO contém o tumor do paciente de teste
// enquanto a do oncologista, para o mesmo paciente, CONTÉM.
//
//  Fase 0 (UI, admin): a tela de acessos tem a caixa 'secretaria' e cria a conta com SÓ
//    esse chapéu. Conta descartável, apagada no fim (como no portao-perfis).
//  Setup (API, oncologista): dois pacientes — um com retorno agendado pelo médico (é o que
//    a secretaria pode reagendar) e um FALTOSO (retorno vencido; o chip da lista).
//  Fase 1 (API, secretaria): payload reduzido na lista e na ficha; contraprova do
//    oncologista; /evidencia 403 para ela e 200 para os CINCO perfis (afirmativo — a lista
//    completa é a intenção, pendência 3 do BACKLOG); 403 em toda rota clínica, de revisão,
//    autorização, custo, recursos e usuários; cadastro administrativo aceito e campo
//    clínico no body recusado (403); reagendamento move SÓ pacientes.proximo_retorno — a
//    coluna congelada do retorno do médico fica igual; sem retorno agendado não há o que
//    reagendar (409); contato append-only (sem rota de edição/remoção).
//  Fase 2 (UI, secretaria): só a aba Pacientes; lista com as colunas administrativas (e os
//    filtros de coluna no que ela vê); chip de faltosos; ficha administrativa SEM nada
//    clínico no DOM; reagendar e registrar contato pela tela, digitando com contador de
//    render = 0; cadastro e edição administrativa; rotas proibidas caem na lista.
//  Fase 3 (UI, oncologista): o reagendamento e o contato aparecem na TRILHA do médico como
//    evento administrativo, com o nome da secretaria — e o "próximo retorno marcado para"
//    do retorno dele continua com a data original.
//  Limpeza: apaga os pacientes e o usuário de teste (DELETE admin).
//
// NÃO ENCADEIE com outro portão sem uma janela de ~1 min: `POST /auth/login` é limitado a
// 5/min por IP e este portão faz 7 logins (admin, secretaria e oncologista na tela;
// oncologista, revisor, auditor e gestor por API). O helper espera no 429.
//
// Uso: node scripts/portao-secretaria.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const { tokenApi, loginNaTela } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';

const SUFIXO = String(Date.now()).slice(-7);
const LOGIN_S = `portao.secretaria.${SUFIXO}`;
const NOME_S = 'Portao Secretaria Teste';
const NOME_P1 = 'Paciente Portao Secretaria A';   // com retorno agendado pelo médico
const NOME_P2 = 'Paciente Portao Secretaria B';   // faltoso (retorno vencido)
const NOME_P3 = 'Paciente Portao Secretaria C';   // cadastrado pela secretaria (na tela)
const IDENT_PREFIXO = 'TESTE-PORTAO-SECRETARIA';
const TUMOR = 'mama';
const RID_INC = 'mama-adj-her2neg-act';
const MOTIVO = 'TESTE PORTAO SECRETARIA - paciente pediu para remarcar';
const NOTA_CONTATO = 'TESTE PORTAO SECRETARIA - nao atendeu, recado deixado';
const CART_NOVA = `CART-${SUFIXO}`;

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
// Dia LOCAL, no Node (nunca toISOString: vira UTC e, à noite, o dia seguinte).
function diaLocal(offsetDias = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDias);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const fmtBR = iso => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; };
// Chaves clínicas que NÃO podem chegar à secretaria — nem na lista, nem na ficha.
const CHAVES_CLINICAS = ['tumor', 'sistema', 'subtipo', 'valores_estaveis', 'ultimo_semaforo', 'ultimo_regimen_id',
  'ultima_linha', 'ultima_avaliacao', 'ultima_avaliacao_pendente', 'autorizacoes_pendentes', 'avaliacoes_total',
  'linha_do_tempo', 'reestadiamento'];
const chavesClinicasEm = o => CHAVES_CLINICAS.filter(k => o && Object.prototype.hasOwnProperty.call(o, k));

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
const abasDe = page => page.evaluate(() => Array.from(document.querySelectorAll('#nav a')).map(a => a.textContent.trim()));
const textoApp = page => page.evaluate(() => (document.getElementById('app') || {}).innerText || '');
const htmlApp = page => page.evaluate(() => (document.getElementById('app') || {}).innerHTML || '');
// Contador de render: digitar texto livre NÃO pode re-renderizar (é o bug do nome que apagava).
const armarContador = page => page.evaluate(() => { window.__rc = 0; const o = window.render; window.render = function () { window.__rc++; return o.apply(this, arguments); }; });
const lerContador = page => page.evaluate(() => window.__rc);
// Palavras/valores clínicos que a tela da secretaria não pode conter.
const PROIBIDO_NA_TELA = ['Semáforo', 'Protocolo', 'protocolo', 'Elegível', 'Inelegível', 'Trilha', 'Seguimento', 'Reavaliar', 'Fluxograma', 'R$', 'ESTIMATIVA'];

(async () => {
  exigirBancoDeDev('perfil secretaria (cadastro administrativo sem dado clínico)');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let tkAdm = null, tkOnco = null, tkSec = null;
  let usuarioSId = null, senhaS = null;
  const pacientes = [];   // ids criados, apagados no fim
  let p1 = null, p2 = null, p3 = null;
  let ctxS = null, ctxO = null, fa = null;
  let nomeRegimeP1 = null, retornoOriginal = null, dataNova = null;

  try {
    // ═══ FASE 0 — admin cria a conta de secretaria PELA TELA ═══
    fa = await ctxLogin(browser, 'admin');
    tkAdm = fa.tk;
    const pa = fa.page;
    await pa.evaluate(() => go('admin'));
    await pa.waitForFunction(() => view === 'admin' && ADM_USUARIOS !== null, null, { timeout: 25000 });
    const caixas = await pa.evaluate(() =>
      ['oncologista', 'revisor', 'auditor', 'admin', 'gestor', 'secretaria'].filter(p => !!document.getElementById('adm_perfil_' + p)));
    ok('A1 cadastro de usuário traz CHECKBOX para os 6 perfis (secretaria incluída)', caixas.length === 6, caixas.join(','));
    await pa.fill('#adm_nome', NOME_S);
    await pa.fill('#adm_login', LOGIN_S);
    await pa.uncheck('#adm_perfil_oncologista');   // SÓ secretaria: nada de chapéu clínico junto
    await pa.check('#adm_perfil_secretaria');
    await pa.click('button:has-text("Criar usuário")');
    await pa.waitForSelector('.senha-tmp .pw', { timeout: 25000 });
    senhaS = (await pa.textContent('.senha-tmp .pw') || '').trim();
    const criado = await pa.evaluate(l => (ADM_USUARIOS || []).find(u => u.login === l), LOGIN_S);
    usuarioSId = criado && criado.id;
    ok('A2 usuária criada com a LISTA [secretaria] e perfil ativo padrão = secretaria',
      !!senhaS && !!criado && Array.isArray(criado.perfis) && criado.perfis.length === 1 && criado.perfis[0] === 'secretaria' && criado.perfil === 'secretaria',
      JSON.stringify(criado && { perfil: criado.perfil, perfis: criado.perfis }));
    const rotulo = await pa.evaluate(l => { const tr = Array.from(document.querySelectorAll('tr')).find(t => t.textContent.includes(l)); return tr ? tr.textContent : ''; }, LOGIN_S);
    ok('A3 a tabela de acessos imprime "Secretária" (rótulo), não o valor cru', /Secretária/.test(rotulo), rotulo.slice(0, 80));

    // ═══ SETUP (API, oncologista) — dois pacientes com contexto CLÍNICO real ═══
    tkOnco = await tokenApi(API, 'oncologista');
    const c1 = await req('POST', '/pacientes', tkOnco, {
      nome: NOME_P1, identificador: `${IDENT_PREFIXO}-A`, sexo: 'F', tumor: TUMOR, nasc: '1970-05-10',
      operadora: 'Unimed', plano: 'Pleno', carteirinha: 'CART-ORIGINAL', cidade: 'Belo Horizonte/MG',
    });
    p1 = c1.body && c1.body.id; if (p1) pacientes.push(p1);
    const c2 = await req('POST', '/pacientes', tkOnco, {
      nome: NOME_P2, identificador: `${IDENT_PREFIXO}-B`, sexo: 'M', tumor: TUMOR, nasc: '1958-01-20',
    });
    p2 = c2.body && c2.body.id; if (p2) pacientes.push(p2);
    ok('S0 pacientes de teste criados pelo oncologista (com tumor)', !!p1 && !!p2, `${c1.status}/${c2.status}`);
    for (const pid of [p1, p2]) {
      const av = await req('POST', `/pacientes/${pid}/avaliacoes`, tkOnco,
        { regimen_id: RID_INC, linha_tratamento: 1, snapshot_campos: { teste: true }, semaforo: 'elegivel' });
      ok(`S0 avaliação vigente registrada (paciente ${pid})`, av.status === 201 && av.body && av.body.autorizacao_estado === 'nao_necessaria', String(av.status));
    }
    // P1: retorno HOJE com próximo em 1 mês → agenda futura (é o que a secretaria reagenda).
    const r1 = await req('POST', `/pacientes/${p1}/retornos`, tkOnco,
      { data_realizada: diaLocal(0), com_imagem: false, conduta: 'mantem', proximo_intervalo: '1m' });
    retornoOriginal = r1.body && r1.body.proximo_retorno;
    ok('S0 retorno do médico em P1 com próximo retorno em 1 mês (decisão clínica congelada)',
      r1.status === 201 && !!retornoOriginal && retornoOriginal > diaLocal(0), `${r1.status} proximo=${retornoOriginal}`);
    // P2: retorno há 60 dias com próximo em 1 mês → VENCIDO há ~30 dias (faltoso).
    const r2 = await req('POST', `/pacientes/${p2}/retornos`, tkOnco,
      { data_realizada: diaLocal(-60), com_imagem: false, conduta: 'mantem', proximo_intervalo: '1m' });
    ok('S0 P2 é FALTOSO (retorno previsto no passado, nada registrado depois)',
      r2.status === 201 && r2.body && r2.body.proximo_retorno < diaLocal(0), `${r2.status} proximo=${r2.body && r2.body.proximo_retorno}`);
    const ev = await req('GET', '/evidencia', tkOnco);
    const reg = ev.body && (ev.body.regimes || []).find(r => r.regimen_id === RID_INC);
    nomeRegimeP1 = reg && (reg.nome || reg.regimen_nome || reg.esquema) || null;

    // ═══ FASE 1 — API direta, com o token da SECRETARIA ═══
    ctxS = await ctxLogin(browser, { login: LOGIN_S, senha: senhaS });
    tkSec = ctxS.tk;
    const ps = ctxS.page;
    ok('S1 secretaria loga na tela e recebe token com perfil ativo = secretaria',
      !!tkSec && (await ps.evaluate(() => USUARIO && USUARIO.perfil)) === 'secretaria');

    // --- payload reduzido: LISTA ---
    const lista = await req('GET', '/pacientes', tkSec);
    const linhaS1 = (lista.body || []).find(p => p.id === p1);
    ok('S2 ★ GET /pacientes (secretaria) = 200 com o paciente de teste', lista.status === 200 && !!linhaS1, String(lista.status));
    const vazadas = new Set(); (lista.body || []).forEach(p => chavesClinicasEm(p).forEach(k => vazadas.add(k)));
    ok('S2 ★★ NENHUMA linha da lista dela carrega chave clínica (tumor, protocolo, semáforo, contagens)',
      lista.status === 200 && vazadas.size === 0, [...vazadas].join(',') || 'nenhuma');
    const jsonLista = JSON.stringify(lista.body || []);
    ok('S2 ★ teste AFIRMATIVO: o JSON da lista dela NÃO contém o tumor nem o protocolo do paciente de teste',
      !jsonLista.includes(`"${TUMOR}"`) && !jsonLista.includes(RID_INC), `len=${jsonLista.length}`);
    ok('S2 a linha dela TEM o administrativo: nome, registro, nascimento, médico assistente, retorno, flag administrativo',
      !!linhaS1 && linhaS1.nome === NOME_P1 && linhaS1.identificador === `${IDENT_PREFIXO}-A` && linhaS1.nasc === '1970-05-10'
      && !!linhaS1.medico_assistente && !!linhaS1.medico_assistente.nome && linhaS1.retorno && linhaS1.retorno.proximo === retornoOriginal
      && linhaS1.administrativo === true, JSON.stringify(linhaS1).slice(0, 200));
    const linhaS2 = (lista.body || []).find(p => p.id === p2);
    ok('S2 o faltoso vem com retorno.vencido = true e dias_atraso > 0 (decisão do servidor)',
      !!linhaS2 && linhaS2.retorno && linhaS2.retorno.vencido === true && linhaS2.retorno.dias_atraso > 0,
      JSON.stringify(linhaS2 && linhaS2.retorno));
    // --- contraprova: o oncologista, no MESMO paciente, recebe o tumor ---
    const listaO = await req('GET', '/pacientes', tkOnco);
    const linhaO1 = (listaO.body || []).find(p => p.id === p1);
    ok('S3 ★ contraprova: o ONCOLOGISTA recebe tumor e protocolo do mesmo paciente (o corte é por perfil, não sumiço de dado)',
      !!linhaO1 && linhaO1.tumor === TUMOR && linhaO1.ultimo_regimen_id === RID_INC && linhaO1.ultimo_semaforo === 'elegivel'
      && linhaO1.administrativo === undefined, JSON.stringify(linhaO1 && { tumor: linhaO1.tumor, rid: linhaO1.ultimo_regimen_id }));
    ok('S3 médico assistente é o MESMO nos dois payloads (derivado do mesmo evento)',
      !!linhaO1 && !!linhaS1 && JSON.stringify(linhaO1.medico_assistente) === JSON.stringify(linhaS1.medico_assistente));

    // --- payload reduzido: FICHA ---
    const ficha = await req('GET', `/pacientes/${p1}`, tkSec);
    ok('S4 ★ GET /pacientes/:id (secretaria) = 200, ficha administrativa', ficha.status === 200 && ficha.body && ficha.body.administrativo === true, String(ficha.status));
    ok('S4 ★★ a ficha dela NÃO carrega tumor, última avaliação, linha do tempo nem reestadiamento',
      ficha.status === 200 && chavesClinicasEm(ficha.body).length === 0 && !JSON.stringify(ficha.body).includes(RID_INC),
      chavesClinicasEm(ficha.body).join(',') || 'nenhuma');
    ok('S4 a ficha dela TEM carteirinha, convênio, medidas e a lista de eventos administrativos',
      ficha.body && ficha.body.carteirinha === 'CART-ORIGINAL' && ficha.body.operadora === 'Unimed'
      && 'peso_kg' in ficha.body && Array.isArray(ficha.body.eventos_administrativos), JSON.stringify(ficha.body).slice(0, 200));

    // --- /evidencia: 403 para ela, 200 AFIRMATIVO para os cinco (pendência 3 do BACKLOG) ---
    const evS = await req('GET', '/evidencia', tkSec);
    ok('E0 ★ secretaria NÃO lê o corpus de evidência (403 — whitelist literal, não "qualquer autenticado")', evS.status === 403, String(evS.status));
    const tokens5 = { oncologista: tkOnco, admin: tkAdm };
    for (const perfil of ['revisor', 'auditor', 'gestor']) tokens5[perfil] = await tokenApi(API, perfil);
    for (const perfil of ['oncologista', 'revisor', 'auditor', 'gestor', 'admin']) {
      const r = await req('GET', '/evidencia', tokens5[perfil]);
      ok(`E1 ${perfil} continua lendo /evidencia (200, check afirmativo — a lista completa é a intenção)`,
        r.status === 200 && r.body && Array.isArray(r.body.regimes) && r.body.regimes.length > 0, String(r.status));
    }

    // --- 403 em TUDO que não é cadastro/agenda ---
    const rotas403 = [
      ['GET', `/pacientes/${p1}/trilha`], ['GET', `/pacientes/${p1}/retornos`], ['GET', `/pacientes/${p1}/avaliacoes`],
      ['GET', `/pacientes/${p1}/selecoes`], ['GET', '/revisoes'], ['GET', '/revisoes/resumo'], ['GET', '/revisoes/fontes'],
      ['GET', '/autorizacoes'], ['GET', '/autorizacoes/contagem'], ['GET', '/custos'], ['GET', `/custos/paciente/${p1}`],
      ['GET', '/recursos/premissas'], ['GET', '/recursos/insumos'], ['GET', '/recursos/projecao?horizonte=6'],
      ['GET', '/usuarios'], ['GET', '/revisao/export'],
    ];
    {
      let todas403 = true, detalhe = '';
      for (const [m, rota] of rotas403) {
        const r = await req(m, rota, tkSec);
        if (r.status !== 403) { todas403 = false; detalhe += `${m} ${rota}=${r.status} `; }
      }
      ok(`M1 ★ secretaria levou 403 em TODA leitura clínica/revisão/autorização/custo/recursos/usuários (${rotas403.length} rotas)`, todas403, detalhe);
    }
    const escritas403 = [
      ['POST', `/pacientes/${p1}/avaliacoes`, { regimen_id: RID_INC, snapshot_campos: {}, semaforo: 'elegivel' }],
      ['POST', `/pacientes/${p1}/retornos`, { data_realizada: diaLocal(0), com_imagem: false, conduta: 'mantem' }],
      ['PATCH', `/pacientes/${p1}/reestadiamento`, { intervalo_meses: 4 }],
      ['POST', '/selecoes', { paciente_id: p1, regimen_id: RID_INC, regimen_nome: 'x' }],
      ['POST', '/revisoes', { regimen_id: RID_INC, decisao: 'aprovado' }],
      ['POST', '/autorizacoes/1/decidir', { decisao: 'aprovada', parecer: 'x' }],
      ['PUT', `/custos/${RID_INC}`, { custo_ciclo_tabela: 1, custo_ciclo_negociado: 1, fonte_tabela: 'x', fonte_negociado: 'x' }],
      ['POST', '/recursos/insumos', { farmaco: 'X' }],
      ['POST', '/usuarios', { nome: 'x', login: 'x' }],
      ['DELETE', `/pacientes/${p1}`],
    ];
    {
      let todas403 = true, detalhe = '';
      for (const [m, rota, body] of escritas403) {
        const r = await req(m, rota, tkSec, body);
        if (r.status !== 403) { todas403 = false; detalhe += `${m} ${rota}=${r.status} `; }
      }
      ok(`M2 ★ secretaria levou 403 em TODA escrita clínica/revisão/autorização/custo/recursos/usuários e na remoção (${escritas403.length} rotas)`, todas403, detalhe);
    }
    ok('M3 secretaria não cria retorno do zero (POST /retornos = 403 — intervalo é decisão clínica)',
      (await req('POST', `/pacientes/${p1}/retornos`, tkSec, { data_realizada: diaLocal(0), com_imagem: false, conduta: 'mantem', proximo_intervalo: '1m' })).status === 403);

    // --- cadastro administrativo por API: aceito; clínico no body: 403 ---
    const comTumor = await req('POST', '/pacientes', tkSec, { nome: 'X', tumor: TUMOR });
    ok('C1 ★ POST /pacientes com `tumor` no body (secretaria) = 403, e a mensagem NOMEIA o campo',
      comTumor.status === 403 && /tumor/.test((comTumor.body && comTumor.body.message) || ''), `${comTumor.status} ${comTumor.body && comTumor.body.message}`);
    const comNulo = await req('POST', '/pacientes', tkSec, { nome: 'X', tumor: null });
    ok('C1 `tumor: null` também é recusado (apagar tumor é mexer no clínico)', comNulo.status === 403, String(comNulo.status));
    const cAdm = await req('POST', '/pacientes', tkSec, {
      nome: 'Paciente Portao Secretaria API', identificador: `${IDENT_PREFIXO}-API`, nasc: '1980-02-02', sexo: 'F',
      operadora: 'Amil', plano: 'Executivo', carteirinha: 'CART-API', cidade: 'Contagem/MG', peso_kg: 70.5, altura_cm: 165,
    });
    const pApi = cAdm.body && cAdm.body.id; if (pApi) pacientes.push(pApi);
    ok('C2 POST /pacientes só com administrativo (secretaria) = 201', cAdm.status === 201 && !!pApi, String(cAdm.status));
    const pApiOnco = await req('GET', `/pacientes/${pApi}`, tkOnco);
    ok('C2 o paciente nasce SEM tumor (o oncologista o vê como "tumor não definido")',
      pApiOnco.status === 200 && pApiOnco.body && pApiOnco.body.tumor === null && pApiOnco.body.carteirinha === 'CART-API', JSON.stringify(pApiOnco.body && { tumor: pApiOnco.body.tumor }));
    const patchOk = await req('PATCH', `/pacientes/${pApi}`, tkSec, { carteirinha: 'CART-API-2', operadora: 'Bradesco Saúde' });
    ok('C3 PATCH administrativo (secretaria) = 200 e devolve a FICHA ADMINISTRATIVA (não a clínica)',
      patchOk.status === 200 && patchOk.body && patchOk.body.carteirinha === 'CART-API-2' && patchOk.body.administrativo === true && chavesClinicasEm(patchOk.body).length === 0,
      `${patchOk.status} ${JSON.stringify(patchOk.body && { cart: patchOk.body.carteirinha, adm: patchOk.body.administrativo })}`);
    for (const [k, v] of [['tumor', TUMOR], ['sistema', 'mama'], ['subtipo', 'x'], ['valores_estaveis', {}]]) {
      const r = await req('PATCH', `/pacientes/${p1}`, tkSec, { nome: NOME_P1, [k]: v });
      ok(`C4 ★ PATCH com \`${k}\` no body (secretaria) = 403`, r.status === 403, String(r.status));
    }
    const p1Depois = await req('GET', `/pacientes/${p1}`, tkOnco);
    ok('C4 o tumor do paciente do médico continua intacto depois das tentativas', p1Depois.body && p1Depois.body.tumor === TUMOR);

    // --- reagendamento: só a agenda anda; a decisão do médico fica ---
    dataNova = diaLocal(45);
    const semMotivo = await req('PATCH', `/pacientes/${p1}/agenda-retorno`, tkSec, { proximo_retorno: dataNova });
    ok('R1 reagendar sem motivo = 400', semMotivo.status === 400, String(semMotivo.status));
    const mesmaData = await req('PATCH', `/pacientes/${p1}/agenda-retorno`, tkSec, { proximo_retorno: retornoOriginal, motivo: MOTIVO });
    ok('R1 reagendar para a MESMA data = 400 (nada a mover)', mesmaData.status === 400, String(mesmaData.status));
    const reag = await req('PATCH', `/pacientes/${p1}/agenda-retorno`, tkSec, { proximo_retorno: dataNova, motivo: MOTIVO });
    ok('R2 ★ PATCH agenda-retorno (secretaria) = 200: agenda aponta para a data nova',
      reag.status === 200 && reag.body && reag.body.retorno && reag.body.retorno.proximo === dataNova, `${reag.status} ${JSON.stringify(reag.body && reag.body.retorno)}`);
    ok('R2 o evento gravado diz DE ONDE → PARA ONDE, o motivo, e o autor com perfil ativo = secretaria',
      reag.body && reag.body.evento && reag.body.evento.tipo === 'reagendamento' && reag.body.evento.data_anterior === retornoOriginal
      && reag.body.evento.data === dataNova && reag.body.evento.nota === MOTIVO && reag.body.evento.por && reag.body.evento.por.nome === NOME_S
      && reag.body.evento.por.perfil === 'secretaria', JSON.stringify(reag.body && reag.body.evento));
    const retsO = await req('GET', `/pacientes/${p1}/retornos`, tkOnco);
    const ultimoRet = (retsO.body || []).slice(-1)[0];
    ok('R3 ★★ a COLUNA CONGELADA do retorno do médico NÃO mudou (retornos.proximo_retorno = data original, intervalo = 1m)',
      !!ultimoRet && ultimoRet.proximo_retorno === retornoOriginal && ultimoRet.proximo_intervalo === '1m',
      JSON.stringify(ultimoRet && { proximo_retorno: ultimoRet.proximo_retorno, proximo_intervalo: ultimoRet.proximo_intervalo }));
    const listaO2 = await req('GET', '/pacientes', tkOnco);
    const linhaO1b = (listaO2.body || []).find(p => p.id === p1);
    ok('R3 a lista do médico já mostra a agenda nova (pacientes.proximo_retorno)', !!linhaO1b && linhaO1b.retorno.proximo === dataNova);
    const semAgenda = await req('PATCH', `/pacientes/${pApi}/agenda-retorno`, tkSec, { proximo_retorno: dataNova, motivo: MOTIVO });
    ok('R4 ★ paciente SEM retorno agendado: 409 — a secretaria não cria retorno do zero, e a mensagem diz que é decisão do médico',
      semAgenda.status === 409 && /médico/i.test((semAgenda.body && semAgenda.body.message) || ''), `${semAgenda.status} ${semAgenda.body && semAgenda.body.message}`);
    const reagOnco = await req('PATCH', `/pacientes/${p2}/agenda-retorno`, tkOnco, { proximo_retorno: diaLocal(10), motivo: 'TESTE PORTAO SECRETARIA - remarcado pelo medico' });
    ok('R5 o oncologista também reagenda pela mesma rota (whitelist oncologista/admin/secretaria)', reagOnco.status === 200, String(reagOnco.status));
    const tkRev = tokens5.revisor, tkGes = tokens5.gestor;
    ok('R5 revisor e gestor NÃO reagendam (403)',
      (await req('PATCH', `/pacientes/${p2}/agenda-retorno`, tkRev, { proximo_retorno: diaLocal(11), motivo: 'x' })).status === 403
      && (await req('PATCH', `/pacientes/${p2}/agenda-retorno`, tkGes, { proximo_retorno: diaLocal(11), motivo: 'x' })).status === 403);
    // Volta P2 ao estado de faltoso para a Fase 2 (o reagendamento do médico moveu a agenda).
    // Não é UPDATE de registro: é outro reagendamento, evento novo — a trilha guarda os dois.
    const voltaP2 = await req('PATCH', `/pacientes/${p2}/agenda-retorno`, tkOnco, { proximo_retorno: diaLocal(-30), motivo: 'TESTE PORTAO SECRETARIA - devolve ao passado para o chip de faltosos' });
    ok('R5 P2 devolvido a faltoso por um NOVO evento (append-only, nada sobrescrito)', voltaP2.status === 200 && voltaP2.body.retorno.vencido === true);

    // --- contato com faltoso: append-only ---
    const meioRuim = await req('POST', `/pacientes/${p2}/contatos`, tkSec, { data: diaLocal(0), meio: 'pombo', nota: 'x' });
    ok('K1 contato com meio fora do vocabulário = 400', meioRuim.status === 400, String(meioRuim.status));
    const cont = await req('POST', `/pacientes/${p2}/contatos`, tkSec, { data: diaLocal(0), meio: 'telefone', nota: NOTA_CONTATO });
    const contId = cont.body && cont.body.id;
    ok('K2 ★ POST contatos (secretaria) = 201 com autor e perfil ativo',
      cont.status === 201 && !!contId && cont.body.tipo === 'contato' && cont.body.meio === 'telefone' && cont.body.nota === NOTA_CONTATO
      && cont.body.por && cont.body.por.nome === NOME_S && cont.body.por.perfil === 'secretaria', JSON.stringify(cont.body));
    const fichaP2 = await req('GET', `/pacientes/${p2}`, tkSec);
    ok('K3 o contato aparece na ficha administrativa dela (eventos_administrativos), e a agenda NÃO mudou',
      fichaP2.body && (fichaP2.body.eventos_administrativos || []).some(e => e.id === contId && e.tipo === 'contato')
      && fichaP2.body.retorno.vencido === true, JSON.stringify(fichaP2.body && fichaP2.body.retorno));
    ok('K4 ★ append-only: não existe rota de edição nem de remoção de evento administrativo (404)',
      (await req('PATCH', `/pacientes/${p2}/contatos/${contId}`, tkSec, { nota: 'x' })).status === 404
      && (await req('DELETE', `/pacientes/${p2}/contatos/${contId}`, tkSec)).status === 404
      && (await req('DELETE', `/pacientes/${p2}/contatos/${contId}`, tkAdm)).status === 404);
    const trilhaO = await req('GET', `/pacientes/${p1}/trilha`, tkOnco);
    const itAdm = (trilhaO.body && trilhaO.body.itens || []).filter(i => i.tipo === 'administrativo');
    ok('K5 ★ na TRILHA do médico o reagendamento entra como item "administrativo" com autor = secretaria e de→para',
      itAdm.some(i => i.evento === 'reagendamento' && i.data_anterior === retornoOriginal && i.data === dataNova && i.por && i.por.nome === NOME_S && i.por.perfil === 'secretaria'),
      JSON.stringify(itAdm).slice(0, 200));
    const trilhaP2 = await req('GET', `/pacientes/${p2}/trilha`, tkOnco);
    ok('K5 na trilha de P2 o contato entra como "administrativo/contato" com a nota',
      (trilhaP2.body.itens || []).some(i => i.tipo === 'administrativo' && i.evento === 'contato' && i.nota === NOTA_CONTATO && i.por && i.por.nome === NOME_S));
    ok('K5 o retorno do médico na trilha continua com "próximo retorno" = data ORIGINAL (a trilha mostra a decisão, a agenda mostra o dia)',
      (trilhaO.body.itens || []).some(i => i.tipo === 'retorno' && i.proximo_retorno === retornoOriginal)
      && trilhaO.body.retorno && trilhaO.body.retorno.proximo === dataNova);

    // ═══ FASE 2 — TELA da secretaria ═══
    await ps.evaluate(() => carregarPacientes().then(() => { view = 'lista'; render(); }));
    await ps.waitForSelector('tbody tr', { timeout: 25000 });
    const abas = await abasDe(ps);
    ok('U1 ★ abas da secretaria = só Pacientes', abas.length === 1 && abas[0] === 'Pacientes', abas.join('|'));
    const heads = await ps.evaluate(() => Array.from(document.querySelectorAll('thead th')).map(h => (h.querySelector('.th-t') || h).textContent.trim()));
    ok('U2 ★ colunas da lista dela = Paciente | Idade | Médico assistente | Próximo retorno (sem Tumor, Último protocolo, Semáforo)',
      heads.join('|') === 'Paciente|Idade|Médico assistente|Próximo retorno', heads.join('|'));
    const filtros = await ps.evaluate(() => Array.from(document.querySelectorAll('thead select[data-col]')).map(s => s.dataset.col));
    ok('U2 filtros de coluna funcionam no que ela vê (idade, médico, retorno) e não existem para as colunas ausentes',
      filtros.join(',') === 'idade,medico,retorno', filtros.join(','));
    const html2 = await htmlApp(ps);
    const txt2 = await textoApp(ps);
    ok('U2 ★ teste AFIRMATIVO na tela: o DOM da lista NÃO contém o protocolo nem o nome do tumor do paciente de teste',
      !html2.includes(RID_INC) && !(nomeRegimeP1 && html2.includes(nomeRegimeP1)) && !/\bMama\b/.test(txt2) && !/Semáforo|Protocolo/.test(txt2),
      `regime=${nomeRegimeP1}`);
    const chip = await ps.evaluate(() => { const b = Array.from(document.querySelectorAll('.lista-filtros button')).find(x => /atrasados/.test(x.textContent)); return b ? b.textContent.trim() : ''; });
    const nAtras = parseInt((chip.match(/\((\d+)\)/) || [])[1] || '0', 10);
    ok('U3 chip "Retornos atrasados (N)" com N ≥ 1 (P2 é faltoso)', nAtras >= 1, chip);
    const linhaP2 = await ps.evaluate(n => { const tr = Array.from(document.querySelectorAll('tbody tr')).find(x => x.textContent.includes(n)); return tr ? { venc: !!tr.querySelector('.ret-venc'), tds: tr.querySelectorAll('td').length, txt: tr.textContent } : null; }, NOME_P2);
    ok('U3 a linha do faltoso mostra o atraso em vermelho e tem exatamente 4 células', !!linhaP2 && linhaP2.venc && linhaP2.tds === 4, JSON.stringify(linhaP2));
    // Filtro de coluna funcionando no que ela vê: médico assistente.
    const medNome = linhaS1.medico_assistente.nome;
    await ps.evaluate(() => setListaFiltro('atrasados'));
    const soAtras = await ps.evaluate(() => Array.from(document.querySelectorAll('tbody tr')).map(t => t.textContent));
    ok('U3 filtro "atrasados" deixa só quem tem retorno vencido (P2 sim, P1 não)',
      soAtras.some(t => t.includes(NOME_P2)) && !soAtras.some(t => t.includes(NOME_P1)));
    await ps.evaluate(() => setListaFiltro('todos'));
    const opMed = await ps.evaluate(n => { const s = document.querySelector('thead select[data-col=medico]'); const o = Array.from(s.options).find(x => x.textContent.startsWith(n)); return o ? o.value : null; }, medNome);
    await ps.evaluate(v => setListaCol('medico', v), opMed);
    const filtrado = await ps.evaluate(() => Array.from(document.querySelectorAll('tbody tr')).length);
    ok('U3 filtro por Médico assistente aplica na lista dela', !!opMed && filtrado >= 2 && filtrado <= (lista.body || []).length, `opção=${opMed} linhas=${filtrado}`);
    await ps.evaluate(() => limparListaFiltros());

    // --- ficha administrativa ---
    await ps.evaluate(id => abrir(id), p1);
    await ps.waitForFunction(id => view === 'paciente' && PAC_DETAIL[id] && PAC_DETAIL[id].administrativo === true, p1, { timeout: 25000 });
    const txtF = await textoApp(ps);
    const htmlF = await htmlApp(ps);
    ok('U4 ★ ficha administrativa: nome, registro, carteirinha, convênio e médico assistente na tela',
      txtF.includes(NOME_P1) && txtF.includes(`${IDENT_PREFIXO}-A`) && txtF.includes('CART-ORIGINAL') && txtF.includes('Unimed') && txtF.includes(medNome));
    const proib = PROIBIDO_NA_TELA.filter(w => txtF.includes(w));
    ok('U4 ★★ NADA clínico no DOM da ficha dela: sem Trilha/Seguimento/Reavaliar/Semáforo/Protocolo/R$, sem tumor, sem protocolo',
      proib.length === 0 && !htmlF.includes(RID_INC) && !(nomeRegimeP1 && htmlF.includes(nomeRegimeP1)) && !/\bMama\b/.test(txtF) && !htmlF.includes('pac-tabs'),
      proib.join(',') || 'limpo');
    ok('U4 a agenda mostra o próximo retorno (já reagendado pela API) e os dois botões: Reagendar data / Registrar contato',
      txtF.includes(fmtBR(dataNova)) && txtF.includes('Reagendar data') && txtF.includes('Registrar contato'));
    ok('U4 o reagendamento feito por API aparece na lista de eventos da ficha, com autor',
      txtF.includes('Reagendado') && txtF.includes(fmtBR(retornoOriginal)) && txtF.includes(MOTIVO) && txtF.includes(NOME_S));

    // --- reagendar PELA TELA, digitando sem re-render ---
    await armarContador(ps);
    await ps.click('button:has-text("Reagendar data")');
    await ps.waitForSelector('#ag_motivo', { timeout: 10000 });
    const rcAbrir = await lerContador(ps);
    const dataTela = diaLocal(50);
    await ps.fill('#ag_data', dataTela);
    await ps.evaluate(() => { document.getElementById('ag_data').dispatchEvent(new Event('change')); });
    const motivoTela = 'TESTE PORTAO SECRETARIA - remarcado pela tela por pedido do paciente';
    await ps.type('#ag_motivo', motivoTela, { delay: 5 });
    const rcDigita = await lerContador(ps);
    const valorMotivo = await ps.inputValue('#ag_motivo');
    ok('U5 ★ digitar o motivo inteiro: 0 re-render e o texto está íntegro', rcDigita === rcAbrir && valorMotivo === motivoTela, `renders=${rcDigita - rcAbrir}`);
    await ps.click('#ag_salvar');
    await ps.waitForFunction(a => PAC_DETAIL[a[0]] && PAC_DETAIL[a[0]].retorno && PAC_DETAIL[a[0]].retorno.proximo === a[1] && !AGENDA_FORM, [p1, dataTela], { timeout: 25000 });
    const txtR = await textoApp(ps);
    ok('U5 ★ reagendou pela tela: a agenda mostra a data nova e o evento entra na lista com de→para, motivo e autora',
      txtR.includes(`Próximo retorno: ${fmtBR(dataTela)}`) && txtR.includes(`${fmtBR(dataNova)} → ${fmtBR(dataTela)}`) && txtR.includes(motivoTela) && txtR.includes(NOME_S),
      txtR.slice(txtR.indexOf('Agenda'), txtR.indexOf('Agenda') + 200).replace(/\n/g, ' '));
    const retsO2 = await req('GET', `/pacientes/${p1}/retornos`, tkOnco);
    ok('U5 ★★ depois do reagendamento pela tela a coluna congelada do médico CONTINUA original',
      (retsO2.body || []).slice(-1)[0].proximo_retorno === retornoOriginal);

    // --- registrar contato PELA TELA ---
    await ps.evaluate(id => abrir(id), p2);
    await ps.waitForFunction(id => view === 'paciente' && PAC_DETAIL[id] && PAC_DETAIL[id].administrativo === true, p2, { timeout: 25000 });
    const txtP2 = await textoApp(ps);
    ok('U6 ficha do faltoso: aviso de retorno atrasado com os dias, e o contato feito por API listado',
      /Retorno atrasado/.test(txtP2) && /dias? sem retorno/.test(txtP2) && txtP2.includes(NOTA_CONTATO));
    await armarContador(ps);
    await ps.click('button:has-text("Registrar contato")');
    await ps.waitForSelector('#ag_nota', { timeout: 10000 });
    const rc0 = await lerContador(ps);
    await ps.selectOption('#ag_meio', 'whatsapp');
    const notaTela = 'TESTE PORTAO SECRETARIA - respondeu no whatsapp, vira na proxima semana';
    await ps.type('#ag_nota', notaTela, { delay: 5 });
    ok('U6 ★ digitar a nota do contato: 0 re-render', (await lerContador(ps)) === rc0 && (await ps.inputValue('#ag_nota')) === notaTela);
    await ps.click('#ag_salvar');
    await ps.waitForFunction(a => PAC_DETAIL[a[0]] && (PAC_DETAIL[a[0]].eventos_administrativos || []).some(e => e.nota === a[1]) && !AGENDA_FORM, [p2, notaTela], { timeout: 25000 });
    const txtK = await textoApp(ps);
    ok('U6 ★ contato registrado pela tela: entra na lista com meio WhatsApp, nota e autora; a agenda continua vencida',
      txtK.includes(notaTela) && txtK.includes('WhatsApp') && /Retorno atrasado/.test(txtK));

    // --- cadastro novo PELA TELA (administrativo) ---
    await ps.evaluate(() => go('lista'));
    await ps.click('button:has-text("+ Novo paciente")');
    await ps.waitForSelector('#f_nome', { timeout: 10000 });
    const cadHtml = await htmlApp(ps);
    const cadTxt = await textoApp(ps);
    // No HTML, não no innerText: o <label> é uppercase por CSS e o innerText vem transformado.
    ok('U7 ★ cadastro da secretaria: formulário administrativo, com a orientação do piloto (iniciais + nº de atendimento)',
      cadHtml.includes('Iniciais + nº de atendimento (não usar nome)') && !!(await ps.$('#f_nasc')) && !!(await ps.$('#f_cart')));
    ok('U7 ★ sem bloco "Tumor do paciente", sem #cad-onco, sem biologia',
      !cadHtml.includes('cad-onco') && !cadTxt.includes('Tumor do paciente') && !cadTxt.includes('Biologia'));
    await armarContador(ps);
    await ps.type('#f_nome', NOME_P3, { delay: 5 });
    ok('U7 digitar o nome inteiro no cadastro: 0 re-render', (await lerContador(ps)) === 0 && (await ps.inputValue('#f_nome')) === NOME_P3);
    await ps.fill('#f_ident', `${IDENT_PREFIXO}-C`);
    await ps.fill('#f_nasc', '1965-03-03');
    await ps.fill('#f_cart', 'CART-TELA');
    await ps.click('button:has-text("Salvar e abrir paciente")');
    await ps.waitForFunction(n => view === 'paciente' && current && PAC_DETAIL[current] && PAC_DETAIL[current].nome === n, NOME_P3, { timeout: 25000 });
    p3 = await ps.evaluate(() => current); if (p3) pacientes.push(p3);
    const p3Onco = await req('GET', `/pacientes/${p3}`, tkOnco);
    ok('U7 ★ paciente cadastrado pela secretaria abre na ficha administrativa; o servidor gravou SEM tumor e com a carteirinha',
      !!p3 && p3Onco.status === 200 && p3Onco.body.tumor === null && p3Onco.body.carteirinha === 'CART-TELA' && p3Onco.body.nasc === '1965-03-03',
      JSON.stringify(p3Onco.body && { tumor: p3Onco.body.tumor, cart: p3Onco.body.carteirinha }));
    const txt3 = await textoApp(ps);
    ok('U7 ficha do recém-cadastrado: "Sem retorno agendado" e SEM botão Reagendar (não cria retorno do zero)',
      /Sem retorno agendado/.test(txt3) && !txt3.includes('Reagendar data') && txt3.includes('Registrar contato'));

    // --- edição administrativa PELA TELA ---
    await ps.click('button:has-text("Editar cadastro")');
    await ps.waitForSelector('#f_cart', { timeout: 10000 });
    ok('U8 edição da secretaria mostra nascimento, convênio e carteirinha pré-preenchidos (a edição clínica não os mostra)',
      (await ps.inputValue('#f_cart')) === 'CART-TELA' && (await ps.inputValue('#f_nasc')) === '1965-03-03' && !(await ps.$('#cad-onco')));
    await ps.fill('#f_cart', CART_NOVA);
    await ps.click('button:has-text("Salvar correções")');
    await ps.waitForFunction(a => view === 'paciente' && PAC_DETAIL[a[0]] && PAC_DETAIL[a[0]].carteirinha === a[1], [p3, CART_NOVA], { timeout: 25000 });
    ok('U8 ★ correção salva: a ficha mostra a carteirinha nova', (await textoApp(ps)).includes(CART_NOVA));

    // --- rotas proibidas caem na lista ---
    const quedas = {};
    for (const v of ['fluxograma', 'revclin', 'simulador', 'autorizacoes', 'recursos', 'admin', 'sadt']) {
      quedas[v] = await ps.evaluate(x => { go(x); return view; }, v);
    }
    ok('U9 ★ go() para qualquer tela clínica/financeira/admin cai em "lista" para a secretaria',
      Object.values(quedas).every(v => v === 'lista'), JSON.stringify(quedas));
    ok('U9 a secretaria nunca carregou o corpus (EVIDENCIA nula na sessão dela)', (await ps.evaluate(() => EVIDENCIA === null && REGIMES.length === 0)));
    ok('U10 console da secretaria sem erro', ctxS.errs.length === 0, JSON.stringify(ctxS.errs));

    // ═══ FASE 3 — TELA do oncologista: a trilha mostra o que a secretaria fez ═══
    ctxO = await ctxLogin(browser, 'oncologista');
    const po = ctxO.page;
    await po.evaluate(id => abrir(id, 'trilha'), p1);
    await po.waitForFunction(id => view === 'paciente' && pacTab === 'trilha' && TRILHA[id] && TRILHA[id].itens, p1, { timeout: 25000 });
    const txtT = await textoApp(po);
    const htmlT = await htmlApp(po);
    ok('T1 ★ na trilha do médico: item "Administrativo" de reagendamento com a autora e de→para',
      htmlT.includes('tl-tipo adm') && txtT.includes('Retorno reagendado') && txtT.includes(NOME_S) && txtT.includes(fmtBR(retornoOriginal)) && txtT.includes(fmtBR(dataTela)));
    ok('T1 o item do retorno do médico continua dizendo "próximo retorno marcado para" a data ORIGINAL',
      txtT.includes(`próximo retorno marcado para ${fmtBR(retornoOriginal)}`));
    ok('T1 o topo da trilha mostra a agenda NOVA (o ponteiro para a frente)', txtT.includes(`Próximo retorno agendado: ${fmtBR(dataTela)}`));
    await po.evaluate(id => abrir(id, 'trilha'), p2);
    await po.waitForFunction(id => view === 'paciente' && pacTab === 'trilha' && TRILHA[id] && TRILHA[id].itens, p2, { timeout: 25000 });
    const txtT2 = await textoApp(po);
    ok('T2 na trilha do faltoso: o contato da secretaria (WhatsApp + nota) como evento administrativo',
      txtT2.includes('Contato com o paciente') && txtT2.includes('WhatsApp') && txtT2.includes(notaTela) && txtT2.includes(NOME_S));
    ok('T3 console do oncologista sem erro', ctxO.errs.length === 0, JSON.stringify(ctxO.errs));
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.message);
  } finally {
    if (ctxS) { try { await ctxS.ctx.close(); } catch (_) { } }
    if (ctxO) { try { await ctxO.ctx.close(); } catch (_) { } }
    if (fa) { try { await fa.ctx.close(); } catch (_) { } }
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
