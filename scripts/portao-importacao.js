// Portão da IMPORTAÇÃO DE PACIENTES — proposta (secretaria) → validação (oncologista).
// Fluxos reais em browser isolado (headless) + API. É o check que NÃO passa pelo agente.
//
// O desenho sob teste: duas alçadas, UM ponto de digitação. A secretaria importa o
// paciente inteiro e os dados clínicos ficam como PROPOSTA PENDENTE (envelope, não
// registro). O oncologista abre o paciente, vê a tabela pronta (campo, valor, trecho),
// corrige e VALIDA — o clique dele grava os primitivos, roda o semáforo NO SERVIDOR e só
// no verde (elegível + incorporado) cria a avaliação vigente com a nota de importação.
// Qualquer outra cor: nada selecionado, motivo devolvido, NUNCA exceção automática.
//
//  Fase 0 (API, admin): varredura de resíduo (pacientes `TESTE-PORTAO-IMP*` e usuárias
//    `portao.imp.*` de rodadas mortas) + conta de secretaria descartável.
//  Fase 1 (API): a secretaria cadastra e envia a proposta do próprio J.M.G.M. (massa do
//    piloto #80); ela NÃO lê o payload de volta (contraprova: o oncologista lê os mesmos
//    campos); nada clínico entrou no paciente; 403 para validar/descartar (secretaria) e
//    para ler/validar (revisor); 409 na segunda pendente; 400 em campo fora do
//    vocabulário, booleano como string e protocolo de outro tumor. Validação verde com
//    correção de campo → vigente com a nota + assinatura do validador, correção valendo,
//    booleano ausente ausente, retorno criado com as datas da meta; 409 ao revalidar.
//    Três propostas não-verdes (atenção por campo faltando, inelegível, não incorporado)
//    → sem vigente, sem exceção, motivo devolvido, primitivos gravados. Descarte exige
//    motivo. Trilha com a proposta como evento administrativo.
//  Fase 2 (UI, secretaria): "Cadastrar manualmente | Importar", formulário guiado com
//    tumor/protocolo/primitivos/trecho/meta digitados SEM re-render, "colar JSON",
//    envio → "proposta enviada, aguardando validação"; ficha e lista sem nada clínico.
//  Fase 3 (UI, oncologista): selo ⏳ na lista (contagem no filtro de coluna), painel de
//    validação na ficha (linhas editáveis, trecho, pré-visualização do semáforo da APP
//    igual ao veredito do SERVIDOR), Validar → painel some, ficha igual à do #80 (nota
//    ⚠️, snapshot, vigente); Descartar… com motivo pela tela.
//  LISTA DE PROBLEMAS (2026-09-16): comorbidades · medicações em uso · alergias.
//    API: PATCH /pacientes/:id/lista-problemas é 403 para secretaria e revisor (whitelist
//    literal), 200 para o oncologista; item manual nasce com origem "registro manual";
//    duplicata 409; remover o que não está 404; cada mudança deixa evento 'lista_problemas'
//    na trilha (+item / −item); a ficha e os eventos da SECRETARIA não trazem nada disso.
//    A proposta carrega as três listas (com trecho); a VALIDAÇÃO — inclusive com a lista
//    editada no painel — grava na ficha com origem "importação (evolução de 28/08/2026)"
//    assinada pelo validador, e deixa o evento na trilha. UI: formulário da secretaria
//    com as três listas (digitação sem re-render; JSON carrega); painel do oncologista com
//    "Lista de problemas proposta" (× tira, + acrescenta, 0 render); ficha com a faixa
//    (chips, tooltip com origem/data; vazio = "— nenhuma registrada —"; + e × só para
//    oncologista/admin, × pede confirmação; revisor só lê).
//  Limpeza: apaga pacientes (cascata leva propostas) e a usuária; relê a carteira.
//
// NÃO ENCADEIE com outro portão sem ~1 min de janela: login é 5/min por IP e este portão
// faz 6 logins (4 por API, 2 na tela). O helper espera no 429.
//
// Uso: node scripts/portao-importacao.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const { tokenApi, loginNaTela } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';

// Etiqueta única por rodada: resíduo de rodada morta nunca casa com o desta rodada.
const ETIQUETA = Date.now().toString(36);
const IDENT_PREFIXO = 'TESTE-PORTAO-IMP';
const LOGIN_PREFIXO = 'portao.imp.';
const LOGIN_S = `${LOGIN_PREFIXO}${ETIQUETA}`;
const NOME_S = `Portao Importacao Secretaria ${ETIQUETA}`;
const NOME = i => `Paciente Portao Importacao ${i} ${ETIQUETA}`;
const IDENT = i => `${IDENT_PREFIXO}-${i}-${ETIQUETA}`;
const TUMOR = 'prostata';
const RID_VERDE = 'prostata-mcspc-enzalutamida';          // regra: metastatico ∧ sensivel_castracao ∧ ¬convulsao_previa
const RID_MCRPC = 'prostata-mcrpc-1l-enzalutamida';       // exige quimio_naive → ausente = atenção
const RID_NI = 'prostata-mcrpc-1l-parp-nao-incorporado';  // elegível mas NÃO incorporado
const MEDICA = 'Dra. Assistente de Teste';

// Massa de teste: o próprio J.M.G.M. (piloto #80), como proposta. Só o INFORMADO entra em
// `campos`; quimio_naive fica de fora de propósito (booleano ausente não pode virar false).
const PROPOSTA_JMGM = {
  tumor: TUMOR, sistema: 'gu', subtipo: 'Metastático sensível à castração (mCSPC)',
  regimen_id: RID_VERDE, linha_tratamento: 1,
  campos: [
    { campo: 'metastatico', valor: true, trecho: 'doença metastática óssea' },
    { campo: 'sensivel_castracao', valor: true, trecho: 'mCSPC em ADT' },
    { campo: 'resistente_castracao', valor: false, trecho: 'sem critério de resistência' },
    { campo: 'gleason', valor: 9, trecho: 'Gleason 9 (4+5)' },
    { campo: 'estadio_t', valor: 'T3b', trecho: 'pT3b (prostatectomia 2020)' },
    { campo: 'metastase_distancia', valor: true, trecho: 'cintilografia: lesões ósseas' },
    { campo: 'psa', valor: 0.02, trecho: 'PSA 0,02 (28/08/2026)' },
    { campo: 'convulsao_previa', valor: false, trecho: 'nega convulsão' },
  ],
  meta: {
    data_inicio: '2026-01-16', data_evolucao: '2026-08-28', proximo_retorno: '2026-09-25',
    medico_assistente_texto: MEDICA,
    sem_campo: ['N0', 'hormonioterapia iniciada = sim', 'prostatectomia = sim', 'pT3b gravado como T3b (opções não distinguem c/p)'],
    historico: 'PSA ao diagnóstico 10,24 (pré-prostatectomia, 2020); PSA atual 0,02.',
    protocolo_texto: 'Enzalutamida 160 mg VO 1x/dia + ADT',
  },
  // Lista de problemas como o prontuário do J.M.G.M. traz (com o trecho de cada item).
  lista_problemas: {
    comorbidades: [
      { texto: 'HAS', trecho: 'Comorbidades : HAS' },
      { texto: 'DM (descompensação grave dez/25)', trecho: 'Descompensação grave de DM' },
      { texto: 'IAM antigo (parede inferior)', trecho: 'ECG com sinais de IAM antigo' },
    ],
    medicacoes_uso: [
      { texto: 'Anlodipino 5 mg 24/24h', trecho: 'Anlodipino - 5 mg - 24 em 24 horas' },
      { texto: 'Omeprazol 20 mg (2ª, 4ª e 6ª)', trecho: 'Omeprazol - 2ª, 4ª e 6ª - 20 mg' },
    ],
    alergias: [
      { texto: 'Nega alergias conhecidas', trecho: 'Nega ou Desconhece a existência de Alergias' },
    ],
  },
};
const ORIGEM_IMP = 'importação (evolução de 28/08/2026)';
const lpTextos = (lp, k) => ((lp && lp[k]) || []).map(i => i.texto);
const NOTA_INICIO = 'Importação retroativa — tratamento em curso desde 16/01/2026, decisão original da equipe assistente (evolução de 28/08/2026); registro criado na importação.';

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 200) + ']' : '')); };

// 429 = o teto de 60 req/min por IP fazendo o trabalho dele, não defeito do código sob
// teste: espera a janela e repete (até 3×). Sem isto, um portão que cresce vira vermelho
// por densidade de chamadas — e vermelho que não é do código ensina a ignorar portão.
async function req(metodo, rota, tk, body) {
  for (let i = 0; ; i++) {
    const r = await fetch(API + rota, {
      method: metodo,
      headers: Object.assign(tk ? { Authorization: 'Bearer ' + tk } : {}, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429 && i < 3) { console.log(`      (429 em ${metodo} ${rota} — esperando 20 s)`); await new Promise(x => setTimeout(x, 20000)); continue; }
    let j = null; try { j = await r.json(); } catch (_) { }
    return { status: r.status, body: j };
  }
}
const clone = o => JSON.parse(JSON.stringify(o));
const camposDe = pl => Object.fromEntries((pl.campos || []).map(c => [c.campo, c.valor]));

async function ctxLogin(browser, quem) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [], dialogs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  // prompt() do descarte responde com o motivo; alert/confirm aceitam.
  page.on('dialog', async d => { dialogs.push(d.type() + ':' + d.message().slice(0, 120)); await d.accept(d.type() === 'prompt' ? 'TESTE PORTAO IMP - descartado pela tela' : undefined); });
  await page.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);
  await page.goto(APP);
  await loginNaTela(page, quem);
  await page.waitForFunction(() => !!localStorage.getItem('oncoguia_token'), null, { timeout: 25000 });
  await page.waitForSelector('#nav a', { timeout: 25000 });
  const tk = await page.evaluate(() => localStorage.getItem('oncoguia_token'));
  return { ctx, page, errs, dialogs, tk };
}
const textoApp = page => page.evaluate(() => (document.getElementById('app') || {}).innerText || '');
const htmlApp = page => page.evaluate(() => (document.getElementById('app') || {}).innerHTML || '');
const armarContador = page => page.evaluate(() => { window.__rc = 0; const o = window.render; window.render = function () { window.__rc++; return o.apply(this, arguments); }; });
const lerContador = page => page.evaluate(() => window.__rc);
const PROIBIDO_NA_TELA = ['Semáforo', 'Protocolo', 'Elegível', 'Inelegível', 'Trilha', 'Seguimento', 'Reavaliar', 'R$', 'Enzalutamida', 'Próstata'];

(async () => {
  exigirBancoDeDev('importação de pacientes (proposta da secretaria → validação do oncologista)');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let tkAdm = null, tkSec = null, tkOnco = null, tkRev = null;
  let usuarioSId = null, senhaS = null;
  const pacientes = [];
  let ctxS = null, ctxO = null;

  try {
    // ═══ FASE 0 — varredura de resíduo + conta de secretaria descartável ═══
    tkAdm = await tokenApi(API, 'admin');
    {
      const todos = await req('GET', '/pacientes', tkAdm);
      const residuo = (todos.body || []).filter(p => String(p.identificador || '').startsWith(IDENT_PREFIXO));
      for (const p of residuo) {
        const del = await req('DELETE', `/pacientes/${p.id}`, tkAdm);
        console.log(`AVISO: resíduo de rodada anterior removido — id=${p.id} "${p.nome}" reg=${p.identificador} → ${del.status}`);
      }
      const usuarios = await req('GET', '/usuarios', tkAdm);
      const residuoU = (usuarios.body || []).filter(u => String(u.login || '').startsWith(LOGIN_PREFIXO));
      for (const u of residuoU) {
        const del = await req('DELETE', `/usuarios/${u.id}`, tkAdm);
        console.log(`AVISO: usuária de rodada anterior removida — id=${u.id} ${u.login} → ${del.status}`);
      }
      const sobra = ((await req('GET', '/pacientes', tkAdm)).body || []).filter(p => String(p.identificador || '').startsWith(IDENT_PREFIXO));
      const sobraU = ((await req('GET', '/usuarios', tkAdm)).body || []).filter(u => String(u.login || '').startsWith(LOGIN_PREFIXO));
      ok('Z0 varredura: nenhum paciente nem usuária deste portão sobrou de rodada anterior (ou foi removido agora)',
        sobra.length === 0 && sobraU.length === 0, (residuo.length || residuoU.length) ? `removidos=${residuo.length}+${residuoU.length}` : 'limpo');
    }
    const cu = await req('POST', '/usuarios', tkAdm, { nome: NOME_S, login: LOGIN_S, perfis: ['secretaria'] });
    usuarioSId = cu.body && cu.body.id; senhaS = cu.body && cu.body.senha_temporaria;
    ok('Z0 conta de secretaria descartável criada (perfis = [secretaria])', cu.status === 201 && !!usuarioSId && !!senhaS && cu.body.perfil === 'secretaria', String(cu.status));
    tkSec = (await req('POST', '/auth/login', null, { login: LOGIN_S, senha: senhaS })).body.access_token;
    tkOnco = await tokenApi(API, 'oncologista');
    tkRev = await tokenApi(API, 'revisor');
    const onco = (await req('GET', '/auth/perfil', tkOnco)).body || {};
    const NOME_ONCO = onco.nome;
    ok('Z0 tokens: secretaria, oncologista e revisor', !!tkSec && !!tkOnco && !!tkRev && !!NOME_ONCO, NOME_ONCO);

    // ═══ FASE 1 — API ═══
    const voc = await req('GET', '/importacao/vocabulario', tkSec);
    const vocPro = voc.body && voc.body.tumores.find(t => t.id === TUMOR);
    ok('A1 ★ GET /importacao/vocabulario (secretaria) = 200: tumores com campos primitivos e NOMES de protocolo — sem critério, referência nem custo',
      voc.status === 200 && !!vocPro && vocPro.campos.length >= 20 && vocPro.regimes.some(r => r.regimen_id === RID_VERDE)
      && !JSON.stringify(voc.body).match(/"regra"|"referencia"|"beneficio"|"custo"|"doi"/i), `campos=${vocPro && vocPro.campos.length} regimes=${vocPro && vocPro.regimes.length}`);
    ok('A1 revisor e gestor NÃO leem o vocabulário (403) — whitelist literal secretaria/admin',
      (await req('GET', '/importacao/vocabulario', tkRev)).status === 403);
    ok('A1 /evidencia continua 403 para a secretaria (o vocabulário não abriu o corpus)', (await req('GET', '/evidencia', tkSec)).status === 403);

    // --- P1: J.M.G.M. cadastrado e proposto pela secretaria ---
    const c1 = await req('POST', '/pacientes', tkSec, { nome: NOME(1), identificador: IDENT(1), sexo: 'M', nasc: '1958-02-08', operadora: 'Unimed', plano: 'Única', peso_kg: 110.5, altura_cm: 171 });
    const p1 = c1.body && c1.body.id; if (p1) pacientes.push(p1);
    ok('S1 secretaria cadastra o paciente pela rota normal (administrativo)', c1.status === 201 && !!p1, String(c1.status));
    // ── REGISTRO ÚNICO (2026-09-16): o mesmo nº de atendimento não cria outro paciente ──
    const dupSec = await req('POST', '/pacientes', tkSec, { nome: 'Copia ' + NOME(1), identificador: IDENT(1), sexo: 'M' });
    ok('R1 ★★ importação (secretaria): cadastrar de novo o registro de P1 = 409, mensagem NOMEIA o existente (nome e #id)',
      dupSec.status === 409 && new RegExp(`Registro ${IDENT(1)} já cadastrado: ${NOME(1)} \\(#${p1}\\)`).test(dupSec.body && dupSec.body.message || ''), `${dupSec.status} ${dupSec.body && dupSec.body.message}`);
    const dupOnco = await req('POST', '/pacientes', tkOnco, { nome: 'Copia manual', identificador: IDENT(1), sexo: 'M', tumor: TUMOR });
    ok('R1 ★ cadastro manual (oncologista) com o mesmo registro = 409 também', dupOnco.status === 409 && /já cadastrado/.test(dupOnco.body && dupOnco.body.message || ''), String(dupOnco.status));
    const dupEspaco = await req('POST', '/pacientes', tkSec, { nome: 'Copia com espaco', identificador: `  ${IDENT(1)}  `, sexo: 'M' });
    ok('R1 registro com espaços em volta é o mesmo registro (409)', dupEspaco.status === 409, String(dupEspaco.status));
    const n1 = await req('POST', '/pacientes', tkSec, { nome: NOME('N1'), sexo: 'M' });
    const n2 = await req('POST', '/pacientes', tkSec, { nome: NOME('N2'), identificador: null, sexo: 'M' });
    const n3 = await req('POST', '/pacientes', tkSec, { nome: NOME('N3'), identificador: '', sexo: 'M' });
    [n1, n2, n3].forEach(x => { if (x.body && x.body.id) pacientes.push(x.body.id); });
    ok('R2 ★ sem registro (ausente, null, vazio) continua permitido n vezes: 3 × 201', n1.status === 201 && n2.status === 201 && n3.status === 201, `${n1.status}/${n2.status}/${n3.status}`);
    ok('R2 os três nasceram sem registro (null), não com string vazia', [n1, n2, n3].every(x => x.body && (x.body.identificador === null || x.body.identificador === undefined)), JSON.stringify([n1, n2, n3].map(x => x.body && x.body.identificador)));
    const patchDup = await req('PATCH', `/pacientes/${n1.body.id}`, tkSec, { identificador: IDENT(1) });
    ok('R3 ★ corrigir o cadastro de outro paciente PARA um registro existente = 409', patchDup.status === 409 && /já cadastrado/.test(patchDup.body && patchDup.body.message || ''), String(patchDup.status));
    const patchOk = await req('PATCH', `/pacientes/${p1}`, tkSec, { identificador: IDENT(1) });
    ok('R3 corrigir o próprio paciente mantendo o mesmo registro = 200 (não conflita consigo)', patchOk.status === 200, String(patchOk.status));
    const patchNovo = await req('PATCH', `/pacientes/${n1.body.id}`, tkSec, { identificador: IDENT('N1') });
    ok('R3 dar um registro NOVO a quem não tinha = 200', patchNovo.status === 200 && patchNovo.body.identificador === IDENT('N1'), String(patchNovo.status));
    const pr1 = await req('POST', `/pacientes/${p1}/importacao-proposta`, tkSec, PROPOSTA_JMGM);
    const prop1Id = pr1.body && pr1.body.id;
    ok('S1 ★ POST importacao-proposta (secretaria) = 201, estado pendente, autora = secretaria', pr1.status === 201 && !!prop1Id && pr1.body.estado === 'pendente'
      && pr1.body.criada_por && pr1.body.criada_por.nome === NOME_S && pr1.body.criada_por.perfil === 'secretaria', `${pr1.status} ${JSON.stringify(pr1.body).slice(0, 120)}`);
    ok('S1 ★ a resposta dela NÃO traz o payload (o conteúdo clínico não é alçada dela, nem o que ela postou)', pr1.status === 201 && !('payload' in pr1.body) && !('resultado' in pr1.body));
    const gSec = await req('GET', `/pacientes/${p1}/importacao-proposta`, tkSec);
    ok('S2 ★ GET proposta (secretaria) = só {id, estado, criada_em, criada_por, decidida_em}', gSec.status === 200 && gSec.body.proposta && gSec.body.proposta.estado === 'pendente'
      && !('payload' in gSec.body.proposta) && !('resultado' in gSec.body.proposta), JSON.stringify(gSec.body && Object.keys(gSec.body.proposta || {})));
    const gOnco = await req('GET', `/pacientes/${p1}/importacao-proposta`, tkOnco);
    const plOnco = gOnco.body && gOnco.body.proposta && gOnco.body.proposta.payload;
    ok('S2 ★★ contraprova: o oncologista lê o payload com EXATAMENTE os campos, valores e trechos enviados',
      gOnco.status === 200 && !!plOnco && JSON.stringify(camposDe(plOnco)) === JSON.stringify(camposDe(PROPOSTA_JMGM))
      && plOnco.campos.every(c => (PROPOSTA_JMGM.campos.find(x => x.campo === c.campo) || {}).trecho === c.trecho)
      && plOnco.regimen_id === RID_VERDE && plOnco.meta.medico_assistente_texto === MEDICA && plOnco.meta.sem_campo.length === 4,
      JSON.stringify(plOnco && camposDe(plOnco)));
    ok('S2 ★ o payload carrega a LISTA DE PROBLEMAS proposta: 3 comorbidades, 2 medicações, 1 alergia, cada item com o trecho',
      !!plOnco && !!plOnco.lista_problemas && lpTextos(plOnco.lista_problemas, 'comorbidades').join('|') === 'HAS|DM (descompensação grave dez/25)|IAM antigo (parede inferior)'
      && lpTextos(plOnco.lista_problemas, 'medicacoes_uso').length === 2 && lpTextos(plOnco.lista_problemas, 'alergias').join() === 'Nega alergias conhecidas'
      && plOnco.lista_problemas.comorbidades[0].trecho === 'Comorbidades : HAS', JSON.stringify(plOnco && plOnco.lista_problemas).slice(0, 200));
    const fichaAntes = await req('GET', `/pacientes/${p1}`, tkOnco);
    const avAntes = await req('GET', `/pacientes/${p1}/avaliacoes`, tkOnco);
    ok('S3 ★ NADA clínico entrou no paciente pela proposta: tumor null, valores_estaveis vazios, 0 avaliações, sem retorno, listas de problemas vazias',
      fichaAntes.body.tumor === null && Object.keys(fichaAntes.body.valores_estaveis || {}).length === 0 && (avAntes.body || []).length === 0 && fichaAntes.body.retorno.proximo === null
      && Array.isArray(fichaAntes.body.comorbidades) && fichaAntes.body.comorbidades.length === 0 && fichaAntes.body.medicacoes_uso.length === 0 && fichaAntes.body.alergias.length === 0,
      JSON.stringify({ tumor: fichaAntes.body.tumor, ve: fichaAntes.body.valores_estaveis, av: (avAntes.body || []).length }));
    const listaO = await req('GET', '/pacientes', tkOnco);
    const listaS = await req('GET', '/pacientes', tkSec);
    ok('S3 lista do oncologista e da secretaria marcam importacao_pendente = true (e o payload da secretaria segue sem chaves clínicas)',
      (listaO.body || []).find(p => p.id === p1).importacao_pendente === true && (listaS.body || []).find(p => p.id === p1).importacao_pendente === true
      && !('tumor' in (listaS.body || []).find(p => p.id === p1)));
    ok('S4 ★ secretaria NÃO valida (403) nem descarta (403)',
      (await req('POST', `/importacao-propostas/${prop1Id}/validar`, tkSec, {})).status === 403
      && (await req('POST', `/importacao-propostas/${prop1Id}/descartar`, tkSec, { motivo: 'x' })).status === 403);
    ok('S4 revisor NÃO lê a proposta (403), não valida (403), não propõe (403); oncologista não propõe (403)',
      (await req('GET', `/pacientes/${p1}/importacao-proposta`, tkRev)).status === 403
      && (await req('POST', `/importacao-propostas/${prop1Id}/validar`, tkRev, {})).status === 403
      && (await req('POST', `/pacientes/${p1}/importacao-proposta`, tkRev, PROPOSTA_JMGM)).status === 403
      && (await req('POST', `/pacientes/${p1}/importacao-proposta`, tkOnco, PROPOSTA_JMGM)).status === 403);
    const dup = await req('POST', `/pacientes/${p1}/importacao-proposta`, tkSec, PROPOSTA_JMGM);
    ok('S5 ★ segunda proposta pendente para o mesmo paciente = 409', dup.status === 409 && /pendente/.test(dup.body.message || ''), `${dup.status} ${dup.body && dup.body.message}`);
    // --- LISTA DE PROBLEMAS: whitelist, adição/remoção manual, evento, secretaria às cegas ---
    const LP = `/pacientes/${p1}/lista-problemas`;
    ok('L1 ★★ PATCH lista-problemas: SECRETARIA = 403 e REVISOR = 403 (whitelist literal oncologista/admin — dado clínico)',
      (await req('PATCH', LP, tkSec, { lista: 'comorbidades', adicionar: ['HAS'] })).status === 403
      && (await req('PATCH', LP, tkRev, { lista: 'comorbidades', adicionar: ['HAS'] })).status === 403);
    const lpAdd = await req('PATCH', LP, tkOnco, { lista: 'medicacoes_uso', adicionar: ['AAS 100 mg'] });
    const itemAas = lpAdd.body && (lpAdd.body.medicacoes_uso || []).find(i => i.texto === 'AAS 100 mg');
    ok('L2 ★ oncologista adiciona "AAS 100 mg" em medicações = 200; item com origem "registro manual", autor = oncologista, data do servidor; as outras listas vêm vazias',
      lpAdd.status === 200 && !!itemAas && itemAas.origem === 'registro manual' && itemAas.registrado_por && itemAas.registrado_por.nome === NOME_ONCO && /^\d{4}-\d{2}-\d{2}T/.test(itemAas.em || '')
      && Array.isArray(lpAdd.body.comorbidades) && lpAdd.body.comorbidades.length === 0 && lpAdd.body.alergias.length === 0, JSON.stringify(lpAdd.body && lpAdd.body.medicacoes_uso));
    ok('L2 ★ o PATCH devolve o evento administrativo criado: tipo lista_problemas, nota "Lista de problemas atualizada por <oncologista>: medicações em uso +AAS 100 mg"',
      !!lpAdd.body.evento && lpAdd.body.evento.tipo === 'lista_problemas' && lpAdd.body.evento.nota === `Lista de problemas atualizada por ${NOME_ONCO}: medicações em uso +AAS 100 mg`, lpAdd.body.evento && lpAdd.body.evento.nota);
    ok('L3 duplicata (mesmo texto, outra caixa) = 409; lista inexistente = 400; remover o que não está = 404; item vazio = 400',
      (await req('PATCH', LP, tkOnco, { lista: 'medicacoes_uso', adicionar: ['aas 100 mg'] })).status === 409
      && (await req('PATCH', LP, tkOnco, { lista: 'exames', adicionar: ['x'] })).status === 400
      && (await req('PATCH', LP, tkOnco, { lista: 'alergias', remover: ['Dipirona'] })).status === 404
      && (await req('PATCH', LP, tkOnco, { lista: 'alergias', adicionar: ['  '] })).status === 400);
    const lpRem = await req('PATCH', LP, tkOnco, { lista: 'medicacoes_uso', remover: ['AAS 100 mg'] });
    ok('L4 ★ remover "AAS 100 mg" = 200, lista volta vazia, evento com "−AAS 100 mg"',
      lpRem.status === 200 && lpRem.body.medicacoes_uso.length === 0 && !!lpRem.body.evento && /medicações em uso −AAS 100 mg$/.test(lpRem.body.evento.nota), lpRem.body.evento && lpRem.body.evento.nota);
    const trLp = await req('GET', `/pacientes/${p1}/trilha`, tkOnco);
    const evsLp = (trLp.body.itens || []).filter(i => i.tipo === 'administrativo' && i.evento === 'lista_problemas');
    ok('L4 ★★ trilha: os DOIS eventos (adição e remoção) estão lá, append-only, assinados pelo oncologista — a lista mudou, o rastro ficou',
      evsLp.length === 2 && evsLp.some(e => /\+AAS 100 mg/.test(e.nota)) && evsLp.some(e => /−AAS 100 mg/.test(e.nota)) && evsLp.every(e => e.por && e.por.nome === NOME_ONCO), JSON.stringify(evsLp.map(e => e.nota)));
    const lpGenerico = await req('PATCH', `/pacientes/${p1}`, tkOnco, { comorbidades: [{ texto: 'HACK', origem: 'x' }] });
    const fichaGen = await req('GET', `/pacientes/${p1}`, tkOnco);
    ok('L5 o PATCH genérico do cadastro NÃO escreve nas listas (chave fora do DTO é descartada): comorbidades continua []',
      lpGenerico.status === 200 && Array.isArray(fichaGen.body.comorbidades) && fichaGen.body.comorbidades.length === 0, JSON.stringify(fichaGen.body.comorbidades));
    const fichaSecLp = await req('GET', `/pacientes/${p1}`, tkSec);
    ok('L6 ★★ SECRETARIA às cegas: a ficha dela NÃO traz comorbidades/medicacoes_uso/alergias nem os eventos de lista de problemas (só reagendamento/contato)',
      fichaSecLp.status === 200 && !('comorbidades' in fichaSecLp.body) && !('medicacoes_uso' in fichaSecLp.body) && !('alergias' in fichaSecLp.body)
      && (fichaSecLp.body.eventos_administrativos || []).every(e => e.tipo !== 'lista_problemas') && !JSON.stringify(fichaSecLp.body).includes('AAS 100 mg'),
      JSON.stringify(Object.keys(fichaSecLp.body)));

    // --- 400s: vocabulário e tipos ---
    const c2 = await req('POST', '/pacientes', tkSec, { nome: NOME(2), identificador: IDENT(2), sexo: 'M' });
    const p2 = c2.body && c2.body.id; if (p2) pacientes.push(p2);
    const ruim = k => { const x = clone(PROPOSTA_JMGM); x.campos = [{ campo: k, valor: true }]; return x; };
    const semNome = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, ruim('campo_inexistente'));
    const boolStr = clone(PROPOSTA_JMGM); boolStr.campos = [{ campo: 'metastatico', valor: 'sim' }];
    const boolRuim = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, boolStr);
    const outroTumor = clone(PROPOSTA_JMGM); outroTumor.regimen_id = 'mama-adj-her2neg-act';
    const regRuim = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, outroTumor);
    const enumRuim = clone(PROPOSTA_JMGM); enumRuim.campos = [{ campo: 'estadio_t', valor: 'T9' }];
    const enumR = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, enumRuim);
    const dataRuim = clone(PROPOSTA_JMGM); dataRuim.meta = { data_evolucao: '28/08/2026' };
    const dataR = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, dataRuim);
    const lpRuim = clone(PROPOSTA_JMGM); lpRuim.lista_problemas = { comorbidades: [{ texto: '' }] };
    const lpRuimR = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, lpRuim);
    const lpRep = clone(PROPOSTA_JMGM); lpRep.lista_problemas = { alergias: [{ texto: 'Dipirona' }, { texto: 'dipirona' }] };
    const lpRepR = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, lpRep);
    ok('S6 ★ lista de problemas na proposta: item sem texto = 400; repetido na mesma lista = 400', lpRuimR.status === 400 && lpRepR.status === 400, `${lpRuimR.status}/${lpRepR.status}`);
    ok('S6 ★ 400 em: campo fora do vocabulário · booleano como string · protocolo de outro tumor · enum fora das opções · data fora do ISO',
      semNome.status === 400 && /vocabulário/.test(semNome.body.message) && boolRuim.status === 400 && /booleano/.test(boolRuim.body.message)
      && regRuim.status === 400 && /mama/.test(regRuim.body.message) && enumR.status === 400 && dataR.status === 400,
      `${semNome.status}/${boolRuim.status}/${regRuim.status}/${enumR.status}/${dataR.status}`);

    // --- validação VERDE com correção (gleason 9 → 8) ---
    // Lista editada no painel: tira o IAM (o médico não confirmou) e acrescenta DLP (sem trecho).
    const LP_EDITADA = clone(PROPOSTA_JMGM.lista_problemas);
    LP_EDITADA.comorbidades = LP_EDITADA.comorbidades.filter(i => !/IAM/.test(i.texto)).concat([{ texto: 'DLP' }]);
    const val = await req('POST', `/importacao-propostas/${prop1Id}/validar`, tkOnco, { campos: { gleason: 8 }, lista_problemas: LP_EDITADA });
    const av = val.body && val.body.avaliacao;
    ok('V1 ★★ validar (oncologista) = 201, semáforo do SERVIDOR elegível, vigente = true, avaliação criada',
      val.status === 201 && val.body.vigente === true && val.body.semaforo && val.body.semaforo.semaforo === 'elegivel' && !!av && av.autorizacao_estado === 'nao_necessaria' && av.regimen_id === RID_VERDE,
      `${val.status} ${JSON.stringify(val.body && { vigente: val.body.vigente, motivo: val.body.motivo, sem: val.body.semaforo && val.body.semaforo.semaforo })}`);
    ok('V1 ★ assinatura = conta do VALIDADOR (oncologista), não da secretaria', !!av && av.avaliado_por && av.avaliado_por.nome === NOME_ONCO && av.avaliado_por.perfil === 'oncologista', JSON.stringify(av && av.avaliado_por));
    ok('V1 ★ nota de importação montada pelo servidor: início, evolução, médica assistente e sem_campo — em detalhe_semaforo.ressalva',
      !!av && typeof av.detalhe_semaforo.ressalva === 'string' && av.detalhe_semaforo.ressalva.startsWith(NOTA_INICIO)
      && av.detalhe_semaforo.ressalva.includes(`Médico(a) assistente: ${MEDICA}.`) && av.detalhe_semaforo.ressalva.includes('Sem campo no sistema: N0; hormonioterapia iniciada = sim; prostatectomia = sim;')
      && av.detalhe_semaforo.ressalva.includes('PSA ao diagnóstico 10,24'), av && av.detalhe_semaforo.ressalva);
    ok('V1 ★ correção de campo VALE: snapshot.gleason = 8 (proposto 9) e resultado.correcoes registra 9 → 8',
      !!av && av.snapshot_campos.gleason === 8 && Array.isArray(val.body.correcoes) && val.body.correcoes.some(c => c.campo === 'gleason' && c.de === 9 && c.para === 8), JSON.stringify(val.body && val.body.correcoes));
    ok('V1 ★★ booleano AUSENTE não vira false: quimio_naive não está no snapshot; os informados estão como enviados (psa 0.02 decimal, convulsao_previa false)',
      !!av && !('quimio_naive' in av.snapshot_campos) && !('candidato_docetaxel' in av.snapshot_campos) && av.snapshot_campos.convulsao_previa === false && av.snapshot_campos.psa === 0.02 && av.snapshot_campos.estadio_t === 'T3b',
      JSON.stringify(av && av.snapshot_campos));
    const ret = val.body && val.body.retorno;
    ok('V2 ★ retorno criado com as datas da meta: realizado 28/08/2026, próximo 25/09/2026 (específica), observações = nota, assinado pelo validador',
      !!ret && ret.data_realizada === '2026-08-28' && ret.proximo_retorno === '2026-09-25' && ret.proximo_intervalo === 'especifica' && ret.observacoes === av.detalhe_semaforo.ressalva
      && ret.avaliacao_id === av.id && ret.registrado_por && ret.registrado_por.nome === NOME_ONCO && /importação retroativa/.test(ret.fonte_dados), JSON.stringify(ret && { d: ret.data_realizada, p: ret.proximo_retorno, a: ret.avaliacao_id }));
    const ficha1 = await req('GET', `/pacientes/${p1}`, tkOnco);
    ok('V2 ★ ficha depois da validação = padrão do #80: tumor próstata, valores_estaveis com o gleason CORRIGIDO, vigente = Enzalutamida, agenda 25/09/2026, reestadiamento agendado',
      ficha1.body.tumor === TUMOR && ficha1.body.sistema === 'gu' && ficha1.body.valores_estaveis.gleason === 8 && ficha1.body.ultima_avaliacao && ficha1.body.ultima_avaliacao.id === av.id
      && ficha1.body.retorno.proximo === '2026-09-25' && !!ficha1.body.reestadiamento.proximo, JSON.stringify({ t: ficha1.body.tumor, ve: ficha1.body.valores_estaveis, ret: ficha1.body.retorno }));
    const lpF = { c: ficha1.body.comorbidades || [], m: ficha1.body.medicacoes_uso || [], a: ficha1.body.alergias || [] };
    ok('V2 ★★ LISTA DE PROBLEMAS gravada pela validação — a EDITADA (sem IAM, com DLP): comorbidades HAS · DM · DLP, medicações 2, alergias "Nega alergias conhecidas"',
      lpF.c.map(i => i.texto).join('|') === 'HAS|DM (descompensação grave dez/25)|DLP' && lpF.m.length === 2 && lpF.a.map(i => i.texto).join() === 'Nega alergias conhecidas',
      JSON.stringify({ c: lpF.c.map(i => i.texto), m: lpF.m.map(i => i.texto), a: lpF.a.map(i => i.texto) }));
    ok(`V2 ★★ cada item com origem "${ORIGEM_IMP}", assinado pelo VALIDADOR (oncologista), com data`,
      [...lpF.c, ...lpF.m, ...lpF.a].every(i => i.origem === ORIGEM_IMP && i.registrado_por && i.registrado_por.nome === NOME_ONCO && !!i.em), JSON.stringify(lpF.c[0]));
    ok('V2 ★ resultado da validação relata o que entrou nas listas (lista_problemas: origem + textos por lista)',
      !!val.body.lista_problemas && val.body.lista_problemas.origem === ORIGEM_IMP && (val.body.lista_problemas.comorbidades || []).includes('DLP') && (val.body.lista_problemas.medicacoes_uso || []).length === 2, JSON.stringify(val.body.lista_problemas));
    ok('V2 a nota de importação NÃO repete o que foi para as listas (sem_campo segue com o que a proposta mandou em sem_campo)', !/HAS|Anlodipino/.test(av.detalhe_semaforo.ressalva));
    const g2 = await req('GET', `/pacientes/${p1}/importacao-proposta`, tkOnco);
    ok('V3 proposta agora validada, com quem/quando e o resultado (vigente, avaliacao_id, retorno_id)',
      g2.body.proposta.estado === 'validada' && g2.body.proposta.validada_por && g2.body.proposta.validada_por.nome === NOME_ONCO && !!g2.body.proposta.decidida_em
      && g2.body.proposta.resultado.vigente === true && g2.body.proposta.resultado.avaliacao_id === av.id && g2.body.proposta.resultado.retorno_id === ret.id);
    ok('V3 lista: importacao_pendente volta a false e a linha mostra o protocolo vigente',
      ((await req('GET', '/pacientes', tkOnco)).body || []).find(p => p.id === p1).importacao_pendente === false && ((await req('GET', '/pacientes', tkOnco)).body || []).find(p => p.id === p1).ultimo_regimen_id === RID_VERDE);
    const tr1 = await req('GET', `/pacientes/${p1}/trilha`, tkOnco);
    const itProp = (tr1.body.itens || []).find(i => i.tipo === 'administrativo' && i.evento === 'proposta_importacao');
    ok('V4 ★ trilha: a proposta entra como evento ADMINISTRATIVO com a autora (secretaria), validada pelo oncologista, vigente; avaliação e retorno assinados pelo validador',
      !!itProp && itProp.estado === 'validada' && itProp.por && itProp.por.nome === NOME_S && itProp.por.perfil === 'secretaria' && itProp.decidida_por && itProp.decidida_por.nome === NOME_ONCO && itProp.resultado.vigente === true
      && (tr1.body.itens || []).some(i => i.tipo === 'avaliacao' && i.id === av.id && i.por.nome === NOME_ONCO) && (tr1.body.itens || []).some(i => i.tipo === 'retorno' && i.id === ret.id),
      JSON.stringify(tr1.body.itens.map(i => i.tipo + (i.evento ? '/' + i.evento : ''))));
    const evVal = (tr1.body.itens || []).find(i => i.evento === 'lista_problemas' && /\+DLP/.test(i.nota || ''));
    ok('V4 ★ trilha: a validação deixou UM evento lista_problemas com as três listas (+HAS … +DLP; medicações +Anlodipino …; alergias +Nega …), assinado pelo validador',
      !!evVal && /comorbidades \+HAS/.test(evVal.nota) && /medicações em uso \+Anlodipino/.test(evVal.nota) && /alergias \+Nega alergias/.test(evVal.nota) && evVal.por.nome === NOME_ONCO, evVal && evVal.nota);
    const reval = await req('POST', `/importacao-propostas/${prop1Id}/validar`, tkOnco, {});
    ok('V5 validar de novo = 409 (decisão única)', reval.status === 409, String(reval.status));

    // --- NÃO-VERDES em P2: atenção (campo faltando), inelegível, não incorporado ---
    const propAt = clone(PROPOSTA_JMGM); propAt.regimen_id = RID_MCRPC;
    propAt.campos = [{ campo: 'metastatico', valor: true }, { campo: 'resistente_castracao', valor: true }, { campo: 'convulsao_previa', valor: false }, { campo: 'gleason', valor: 7 }];
    propAt.meta = { data_evolucao: '2026-08-01', proximo_retorno: '2026-10-01', medico_assistente_texto: MEDICA, sem_campo: [] };
    const prAt = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, propAt);
    const valAt = await req('POST', `/importacao-propostas/${prAt.body.id}/validar`, tkOnco, { campos: {} });
    const av2 = await req('GET', `/pacientes/${p2}/avaliacoes`, tkOnco);
    const ficha2 = await req('GET', `/pacientes/${p2}`, tkOnco);
    ok('N1 ★★ proposta com booleano da regra AUSENTE (quimio_naive) → ATENÇÃO: sem vigente, sem exceção (0 avaliações), motivo nomeia o campo; primitivos GRAVADOS (tumor + estáveis)',
      valAt.status === 201 && valAt.body.vigente === false && valAt.body.semaforo.semaforo === 'atencao' && /quimio_naive/.test(valAt.body.motivo) && (av2.body || []).length === 0
      && ficha2.body.tumor === TUMOR && ficha2.body.valores_estaveis.gleason === 7 && ficha2.body.ultima_avaliacao === null, `${valAt.status} ${valAt.body && valAt.body.motivo}`);
    ok('N1 retorno da evolução criado mesmo sem vigente (avaliacao_id null) e a agenda aponta para o próximo retorno da meta',
      !!valAt.body.retorno && valAt.body.retorno.avaliacao_id === null && valAt.body.retorno.data_realizada === '2026-08-01' && ficha2.body.retorno.proximo === '2026-10-01');
    const propIn = clone(PROPOSTA_JMGM);
    propIn.campos = [{ campo: 'metastatico', valor: false }, { campo: 'sensivel_castracao', valor: true }, { campo: 'convulsao_previa', valor: false }];
    propIn.meta = {};
    const prIn = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, propIn);
    const valIn = await req('POST', `/importacao-propostas/${prIn.body.id}/validar`, tkOnco, {});
    ok('N2 ★★ proposta INELEGÍVEL (metastatico = false para mCSPC) → sem vigente, NENHUMA solicitação de exceção nasce (0 avaliações), motivo diz inelegível',
      valIn.status === 201 && valIn.body.vigente === false && valIn.body.semaforo.semaforo === 'inelegivel' && /INELEGÍVEL/.test(valIn.body.motivo)
      && ((await req('GET', `/pacientes/${p2}/avaliacoes`, tkOnco)).body || []).length === 0 && !valIn.body.retorno, `${valIn.status} ${valIn.body && valIn.body.motivo}`);
    const propNi = clone(PROPOSTA_JMGM); propNi.regimen_id = RID_NI; propNi.meta = {};
    propNi.campos = [{ campo: 'metastatico', valor: true }, { campo: 'resistente_castracao', valor: true }, { campo: 'mutacao_brca', valor: true }];
    const prNi = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, propNi);
    const valNi = await req('POST', `/importacao-propostas/${prNi.body.id}/validar`, tkOnco, {});
    ok('N3 ★★ proposta elegível mas NÃO INCORPORADA → sem vigente, sem exceção automática (0 avaliações), motivo diz não incorporado',
      valNi.status === 201 && valNi.body.vigente === false && valNi.body.semaforo.semaforo === 'elegivel' && valNi.body.semaforo.nao_incorporado === true && /NÃO INCORPORADO/.test(valNi.body.motivo)
      && ((await req('GET', `/pacientes/${p2}/avaliacoes`, tkOnco)).body || []).length === 0, `${valNi.status} ${valNi.body && valNi.body.motivo}`);
    // Validador PREENCHE o que faltava e o servidor fica verde (correção sobre proposta nova).
    const propOk = clone(propAt); propOk.meta = {};
    const prOk = await req('POST', `/pacientes/${p2}/importacao-proposta`, tkSec, propOk);
    const valOk = await req('POST', `/importacao-propostas/${prOk.body.id}/validar`, tkOnco, { campos: { quimio_naive: true } });
    ok('N4 ★ mesma proposta com o validador informando quimio_naive = true → verde, vigente (a correção destrava o semáforo)',
      valOk.status === 201 && valOk.body.vigente === true && valOk.body.avaliacao && valOk.body.avaliacao.snapshot_campos.quimio_naive === true && valOk.body.avaliacao.regimen_id === RID_MCRPC, `${valOk.status} ${valOk.body && valOk.body.motivo}`);
    // P2 recebeu 4 propostas com a MESMA lista de problemas (clone do J.M.G.M.): as listas
    // da ficha têm cada item UMA vez — revalidar não duplica, e não dá erro.
    const ficha2b = await req('GET', `/pacientes/${p2}`, tkOnco);
    ok('N5 ★ quatro validações com a mesma lista de problemas → cada item UMA vez na ficha (sem duplicata, sem erro); e as que já estavam lá não entram no relato da última',
      (ficha2b.body.comorbidades || []).map(i => i.texto).join('|') === 'HAS|DM (descompensação grave dez/25)|IAM antigo (parede inferior)' && (ficha2b.body.medicacoes_uso || []).length === 2 && (ficha2b.body.alergias || []).length === 1
      && (valOk.body.lista_problemas.comorbidades || []).length === 0, JSON.stringify((ficha2b.body.comorbidades || []).map(i => i.texto)));

    // --- descarte em P3 ---
    const c3 = await req('POST', '/pacientes', tkSec, { nome: NOME(3), identificador: IDENT(3), sexo: 'M' });
    const p3 = c3.body && c3.body.id; if (p3) pacientes.push(p3);
    const pr3 = await req('POST', `/pacientes/${p3}/importacao-proposta`, tkSec, PROPOSTA_JMGM);
    const semMotivo = await req('POST', `/importacao-propostas/${pr3.body.id}/descartar`, tkOnco, {});
    const vazio = await req('POST', `/importacao-propostas/${pr3.body.id}/descartar`, tkOnco, { motivo: '' });
    ok('D1 ★ descartar sem motivo = 400 (também com motivo vazio)', semMotivo.status === 400 && vazio.status === 400, `${semMotivo.status}/${vazio.status}`);
    const desc = await req('POST', `/importacao-propostas/${pr3.body.id}/descartar`, tkOnco, { motivo: 'TESTE PORTAO IMP - prontuario de outro paciente' });
    const ficha3 = await req('GET', `/pacientes/${p3}`, tkOnco);
    ok('D1 descartar com motivo = 201: estado descartada, quem/quando, motivo; paciente segue sem tumor; validar depois = 409',
      desc.status === 201 && desc.body.proposta.estado === 'descartada' && desc.body.proposta.motivo_descarte === 'TESTE PORTAO IMP - prontuario de outro paciente' && desc.body.proposta.validada_por.nome === NOME_ONCO
      && ficha3.body.tumor === null && (await req('POST', `/importacao-propostas/${pr3.body.id}/validar`, tkOnco, {})).status === 409, String(desc.status));
    const tr3 = await req('GET', `/pacientes/${p3}/trilha`, tkOnco);
    ok('D1 trilha de P3: proposta descartada com o motivo', (tr3.body.itens || []).some(i => i.evento === 'proposta_importacao' && i.estado === 'descartada' && /outro paciente/.test(i.motivo_descarte)));
    const depoisDesc = await req('POST', `/pacientes/${p3}/importacao-proposta`, tkSec, PROPOSTA_JMGM);
    ok('D2 depois do descarte a secretaria pode enviar outra proposta (só a PENDENTE é única)', depoisDesc.status === 201);

    // ═══ FASE 2 — TELA da secretaria: importar pelo formulário ═══
    ctxS = await ctxLogin(browser, { login: LOGIN_S, senha: senhaS });
    const ps = ctxS.page;
    await ps.waitForSelector('button:has-text("+ Novo paciente")', { timeout: 25000 });
    await ps.click('button:has-text("+ Novo paciente")');
    await ps.waitForSelector('#cad_modo_importar', { timeout: 10000 });
    ok('U1 ★ cadastro da secretaria oferece "Cadastrar manualmente | Importar"', !!(await ps.$('#cad_modo_manual')) && !!(await ps.$('#cad_modo_importar')));
    await ps.click('#cad_modo_importar');
    await ps.waitForSelector('#imp_tumor', { timeout: 15000 });
    ok('U1 modo Importar: formulário administrativo + seção "Dados clínicos para validação médica" com o seletor de tumor (vocabulário)',
      /dados clínicos para validação médica/i.test(await textoApp(ps)) && !!(await ps.$('#f_nome')) && !!(await ps.$('#imp_tumor')));
    ok('U1 ★ a sessão dela continua sem o corpus (EVIDENCIA nula) — o vocabulário é outra coisa', await ps.evaluate(() => EVIDENCIA === null && REGIMES.length === 0 && !!IMP_VOCAB));
    await armarContador(ps);
    await ps.type('#f_nome', NOME(4), { delay: 4 });
    await ps.fill('#f_ident', IDENT(4));
    await ps.fill('#f_nasc', '1958-02-08');
    await ps.selectOption('#f_sexo', 'M');
    await ps.selectOption('#imp_tumor', TUMOR);
    await ps.waitForSelector('#imp_regime', { timeout: 10000 });
    const rcTumor = await lerContador(ps);
    ok('U2 escolher o tumor reconstrói só o bloco clínico (0 render global) e o nome digitado continua íntegro', rcTumor === 0 && (await ps.inputValue('#f_nome')) === NOME(4), `renders=${rcTumor}`);
    const opsReg = await ps.evaluate(() => Array.from(document.querySelectorAll('#imp_regime option')).map(o => o.value).filter(Boolean));
    ok('U2 ★ o select de protocolo lista os regimes de próstata pelo NOME (inclui o Enzalutamida mCSPC)', opsReg.includes(RID_VERDE) && opsReg.length >= 10, `n=${opsReg.length}`);
    // Rótulo = "Nome — cenário/contexto": as três Enzalutamida (mCSPC, nmCRPC, mCRPC 1L) têm de
    // sair distinguíveis, e o rótulo de cada option único no select.
    const rotS = await ps.evaluate(() => Array.from(document.querySelectorAll('#imp_regime option')).filter(o => o.value).map(o => o.textContent.trim()));
    const enzS = rotS.filter(t => /^Enzalutamida\b/.test(t));
    ok('U2 ★ rótulo das options traz o cenário ("Enzalutamida — Metastático sensível à castração (mCSPC)"); as 3 Enzalutamida distintas; nenhum rótulo repetido',
      enzS.length === 3 && new Set(enzS).size === 3 && enzS.some(t => /mCSPC/.test(t)) && enzS.some(t => /nmCRPC/.test(t)) && enzS.some(t => /mCRPC\).*1ª linha/.test(t)) && new Set(rotS).size === rotS.length, enzS.join(' | '));
    await ps.selectOption('#imp_regime', RID_VERDE);
    await ps.fill('#imp_proto_txt', 'Enzalutamida 160 mg VO 1x/dia + ADT');
    const linhaDe = async lbl => ps.evaluate(l => { const tr = Array.from(document.querySelectorAll('#imp-clin .imp-tab tbody tr')).find(t => t.querySelector('td') && t.querySelector('td').textContent.trim().startsWith(l)); return tr ? true : false; }, lbl);
    ok('U2 a tabela de primitivos tem as linhas do vocabulário (Metastatico, Sensivel castracao, Convulsao previa, Gleason)',
      (await linhaDe('Metastatico')) && (await linhaDe('Sensivel castracao')) && (await linhaDe('Convulsao previa')) && (await linhaDe('Gleason')));
    const clicaSeg = async (lbl, txt) => ps.evaluate(a => { const tr = Array.from(document.querySelectorAll('#imp-clin .imp-tab tbody tr')).find(t => t.querySelector('td') && t.querySelector('td').textContent.trim().startsWith(a[0])); const b = Array.from(tr.querySelectorAll('button')).find(x => x.textContent.trim() === a[1]); b.click(); return b.classList.contains('on'); }, [lbl, txt]);
    ok('U3 botões tri-estado: Sim em Metastatico e Sensivel castracao, Não em Convulsao previa (destaque in place)',
      (await clicaSeg('Metastatico', 'Sim')) && (await clicaSeg('Sensivel castracao', 'Sim')) && (await clicaSeg('Convulsao previa', 'Não')) && (await clicaSeg('Resistente castracao', 'Não')));
    await ps.evaluate(() => { const tr = Array.from(document.querySelectorAll('#imp-clin .imp-tab tbody tr')).find(t => t.querySelector('td').textContent.trim().startsWith('Gleason')); const i = tr.querySelector('input[type=number]'); i.value = '9'; i.dispatchEvent(new Event('change')); });
    await ps.evaluate(() => { const tr = Array.from(document.querySelectorAll('#imp-clin .imp-tab tbody tr')).find(t => t.querySelector('td').textContent.trim().startsWith('Psa')); const i = tr.querySelector('input[type=number]'); i.value = '0.02'; i.dispatchEvent(new Event('change')); });
    const rc0 = await lerContador(ps);
    const trechoTxt = 'doença metastática óssea confirmada na cintilografia';
    await ps.evaluate(() => { const tr = Array.from(document.querySelectorAll('#imp-clin .imp-tab tbody tr')).find(t => t.querySelector('td').textContent.trim().startsWith('Metastatico')); tr.querySelector('input.imp-trecho').id = 'trecho_met'; });
    await ps.type('#trecho_met', trechoTxt, { delay: 4 });
    await ps.fill('#imp_data_inicio', '2026-01-16');
    await ps.evaluate(() => document.getElementById('imp_data_inicio').dispatchEvent(new Event('change')));
    await ps.fill('#imp_data_evolucao', '2026-08-28');
    await ps.evaluate(() => document.getElementById('imp_data_evolucao').dispatchEvent(new Event('change')));
    await ps.fill('#imp_prox_retorno', '2026-09-25');
    await ps.evaluate(() => document.getElementById('imp_prox_retorno').dispatchEvent(new Event('change')));
    await ps.type('#imp_medico', MEDICA, { delay: 3 });
    await ps.type('#imp_sem_campo', 'N0\nprostatectomia = sim', { delay: 3 });
    ok('U3 ★ formulário da secretaria tem as três listas de problemas (Comorbidades · Medicações em uso · Alergias)',
      !!(await ps.$('#imp_lp_comorbidades')) && !!(await ps.$('#imp_lp_medicacoes_uso')) && !!(await ps.$('#imp_lp_alergias')));
    await ps.type('#imp_lp_comorbidades', 'HAS\nDM2', { delay: 3 });
    const rcDig = await lerContador(ps);
    ok('U3 ★ digitar trecho, médica, sem_campo e comorbidades: 0 re-render e os textos íntegros', rcDig === rc0 && (await ps.inputValue('#trecho_met')) === trechoTxt && (await ps.inputValue('#imp_medico')) === MEDICA
      && (await ps.inputValue('#imp_lp_comorbidades')) === 'HAS\nDM2' && (await ps.evaluate(() => IMP.lp_txt.comorbidades === 'HAS\nDM2')), `renders=${rcDig - rc0}`);
    const estado = await ps.evaluate(() => JSON.stringify({ c: IMP.campos, t: IMP.trechos, r: IMP.regimen_id, m: IMP.meta }));
    ok('U3 o estado do rascunho reflete a tela (booleanos explícitos, números, trecho, meta)',
      /"metastatico":true/.test(estado) && /"convulsao_previa":false/.test(estado) && /"gleason":9/.test(estado) && /"psa":0.02/.test(estado) && estado.includes(trechoTxt) && estado.includes(RID_VERDE) && /"data_evolucao":"2026-08-28"/.test(estado), estado.slice(0, 200));
    // Colar JSON: preenche o formulário (o que vem no JSON substitui o digitado).
    await ps.evaluate(() => { document.querySelector('.imp-json').open = true; });
    const jsonProp = clone(PROPOSTA_JMGM);
    await ps.fill('#imp_json', JSON.stringify(jsonProp));
    await ps.click('button:has-text("Carregar JSON no formulário")');
    await ps.waitForFunction(() => IMP && IMP.campos && IMP.campos.estadio_t === 'T3b', null, { timeout: 5000 });
    ok('U4 ★ "colar JSON de proposta" carrega tumor, protocolo, campos e meta no formulário (estadio_t T3b, 8 campos, 4 sem_campo)',
      await ps.evaluate(a => IMP.tumor === 'prostata' && IMP.regimen_id === a && Object.keys(IMP.campos).length === 8 && IMP.trechos.gleason === 'Gleason 9 (4+5)' && IMP.meta.sem_campo.split('\n').length === 4 && document.getElementById('imp_regime').value === a, RID_VERDE));
    ok('U4 ★ … e a lista de problemas do JSON (3 comorbidades, 2 medicações, 1 alergia) — textareas preenchidas, trechos guardados por item',
      await ps.evaluate(() => document.getElementById('imp_lp_comorbidades').value.split('\n').length === 3 && document.getElementById('imp_lp_medicacoes_uso').value.split('\n').length === 2
        && document.getElementById('imp_lp_alergias').value === 'Nega alergias conhecidas' && IMP.lp_trechos.comorbidades['HAS'] === 'Comorbidades : HAS'));
    await ps.click('button:has-text("Cadastrar e enviar proposta")');
    await ps.waitForFunction(() => view === 'paciente' && current && IMP_PROP[current] && IMP_PROP[current].estado === 'pendente', null, { timeout: 25000 });
    const p4 = await ps.evaluate(() => current); if (p4) pacientes.push(p4);
    const txtF4 = await textoApp(ps);
    const htmlF4 = await htmlApp(ps);
    ok('U5 ★★ depois de enviar: ficha administrativa diz "Proposta de importação enviada … aguardando validação clínica"', txtF4.includes('Proposta de importação enviada') && txtF4.includes('aguardando validação clínica'));
    const proib4 = PROIBIDO_NA_TELA.filter(w => txtF4.includes(w));
    ok('U5 ★ e continua SEM nada clínico no DOM (nem o tumor, nem o protocolo que ela acabou de propor)', proib4.length === 0 && !htmlF4.includes(RID_VERDE) && !htmlF4.includes('pac-tabs'), proib4.join(',') || 'limpo');
    const gp4 = await req('GET', `/pacientes/${p4}/importacao-proposta`, tkOnco);
    const pl4 = gp4.body.proposta.payload;
    ok('U5 ★ o servidor recebeu o envelope do formulário: 8 campos com trecho, protocolo, meta e sem_campo',
      gp4.body.proposta.estado === 'pendente' && pl4.regimen_id === RID_VERDE && pl4.campos.length === 8 && pl4.campos.find(c => c.campo === 'gleason').trecho === 'Gleason 9 (4+5)' && pl4.meta.sem_campo.length === 4 && pl4.sistema === 'gu' && pl4.linha_tratamento === 1,
      JSON.stringify(camposDe(pl4)));
    ok('U5 ★ … com a lista de problemas do formulário (3/2/1) e o trecho de cada item preservado da carga do JSON',
      !!pl4.lista_problemas && lpTextos(pl4.lista_problemas, 'comorbidades').length === 3 && lpTextos(pl4.lista_problemas, 'medicacoes_uso').length === 2 && lpTextos(pl4.lista_problemas, 'alergias').length === 1
      && pl4.lista_problemas.medicacoes_uso[0].trecho === 'Anlodipino - 5 mg - 24 em 24 horas', JSON.stringify(pl4.lista_problemas).slice(0, 160));
    ok('U5 ★ ficha da secretaria NÃO tem a faixa de lista de problemas (dado clínico)', !htmlF4.includes('lp-faixa') && !htmlF4.includes('lp-chip'));
    await ps.evaluate(() => carregarPacientes().then(() => { view = 'lista'; render(); }));
    await ps.waitForSelector('tbody tr', { timeout: 25000 });
    const linha4 = await ps.evaluate(n => { const tr = Array.from(document.querySelectorAll('tbody tr')).find(x => x.textContent.includes(n)); return tr ? tr.textContent : ''; }, NOME(4));
    ok('U6 lista da secretaria: a linha do paciente traz "aguardando validação clínica" (e 4 colunas, nada clínico)', /aguardando validação clínica/.test(linha4) && !/Enzalutamida|Próstata/.test(linha4), linha4.slice(0, 120));
    ok('U7 console da secretaria sem erro', ctxS.errs.length === 0, JSON.stringify(ctxS.errs));

    // ═══ FASE 3 — TELA do oncologista: selo, painel, validar, descartar ═══
    ctxO = await ctxLogin(browser, 'oncologista');
    const po = ctxO.page;
    await po.waitForSelector('tbody tr', { timeout: 25000 });
    const linhaO4 = await po.evaluate(n => { const tr = Array.from(document.querySelectorAll('tbody tr')).find(x => x.textContent.includes(n)); return tr ? { txt: tr.textContent, tag: !!tr.querySelector('.tag-imp') } : null; }, NOME(4));
    ok('O1 ★ lista do oncologista: selo "⏳ aguardando validação clínica" na linha do paciente proposto', !!linhaO4 && linhaO4.tag && /aguardando validação clínica/.test(linhaO4.txt));
    const opImp = await po.evaluate(() => { const s = document.querySelector('thead select[data-col=proto]'); const o = Array.from(s.options).find(x => /aguardando validação/.test(x.textContent)); return o ? { v: o.value, t: o.textContent } : null; });
    const nPend = (((await req('GET', '/pacientes', tkOnco)).body) || []).filter(p => p.importacao_pendente).length;
    ok('O1 ★ filtro da coluna "Último protocolo" tem a opção "⏳ aguardando validação clínica (N)" com N = pendentes do payload', !!opImp && opImp.t.includes(`(${nPend})`), JSON.stringify(opImp) + ` payload=${nPend}`);
    await po.evaluate(v => setListaCol('proto', v), opImp && opImp.v);
    const soPend = await po.evaluate(() => Array.from(document.querySelectorAll('tbody tr')).map(t => t.textContent));
    ok('O1 aplicar o filtro deixa só quem espera validação', soPend.length === nPend && soPend.every(t => /aguardando validação clínica/.test(t)), `linhas=${soPend.length}`);
    await po.evaluate(() => limparListaFiltros());
    // ficha: painel de validação
    await po.evaluate(id => abrir(id), p4);
    await po.waitForSelector('#imp-painel', { timeout: 25000 });
    const txtP = await textoApp(po);
    ok('O2 ★★ ficha do oncologista: painel "Proposta de importação aguardando a sua validação" com autora, tabela campo | valor | trecho e os dois botões',
      txtP.includes('aguardando a sua validação') && txtP.includes(NOME_S) && txtP.includes('Gleason 9 (4+5)') && txtP.includes('doença metastática óssea') && !!(await po.$('#imp_validar')) && !!(await po.$('#imp_descartar')));
    const segMet = await po.evaluate(() => { const tr = Array.from(document.querySelectorAll('#imp-painel .imp-tab tbody tr')).find(t => t.querySelector('td').textContent.trim().startsWith('Metastatico')); return Array.from(tr.querySelectorAll('button')).filter(b => b.classList.contains('on')).map(b => b.textContent.trim()); });
    const segQn = await po.evaluate(() => { const tr = Array.from(document.querySelectorAll('#imp-painel .imp-tab tbody tr')).find(t => t.querySelector('td').textContent.trim().startsWith('Quimio naive')); return Array.from(tr.querySelectorAll('button')).filter(b => b.classList.contains('on')).map(b => b.textContent.trim()); });
    ok('O2 valores propostos marcados (Metastatico = Sim) e o não proposto marcado como "—" (não informado, não "Não")', segMet.join() === 'Sim' && segQn.join() === '—', `${segMet}/${segQn}`);
    // O select "Protocolo proposto" do painel: mesmo rótulo com cenário, proposta pré-selecionada.
    const rotO = await po.evaluate(() => Array.from(document.querySelectorAll('#impv_regime option')).filter(o => o.value).map(o => o.textContent.trim()));
    const enzO = rotO.filter(t => /^Enzalutamida\b/.test(t));
    const selO = await po.evaluate(() => { const s = document.getElementById('impv_regime'); return [s.value, s.options[s.selectedIndex].textContent.trim()]; });
    ok('O2 ★ "Protocolo proposto": options com cenário (3 Enzalutamida distintas, sem rótulo repetido) e a proposta já selecionada como "Enzalutamida — … (mCSPC)"',
      enzO.length === 3 && new Set(enzO).size === 3 && new Set(rotO).size === rotO.length && selO[0] === RID_VERDE && /^Enzalutamida — .*mCSPC/.test(selO[1]), selO[1]);
    const prev = await po.evaluate(() => document.getElementById('imp-preview').innerText);
    ok('O3 ★★ pré-visualização do semáforo da APP (só com o informado) = Elegível → "vira vigente" — mesmo veredito que o servidor deu em V1 para os mesmos dados', /🟢/.test(prev) && /vira vigente/.test(prev), prev.slice(0, 120));
    // Mexer num booleano recalcula a prévia (só #imp-preview): Metastatico = Não → Inelegível.
    await po.evaluate(() => { const tr = Array.from(document.querySelectorAll('#imp-painel .imp-tab tbody tr')).find(t => t.querySelector('td').textContent.trim().startsWith('Metastatico')); Array.from(tr.querySelectorAll('button')).find(b => b.textContent.trim() === 'Não').click(); });
    const prevNao = await po.evaluate(() => document.getElementById('imp-preview').innerText);
    await po.evaluate(() => { const tr = Array.from(document.querySelectorAll('#imp-painel .imp-tab tbody tr')).find(t => t.querySelector('td').textContent.trim().startsWith('Metastatico')); Array.from(tr.querySelectorAll('button')).find(b => b.textContent.trim() === 'Sim').click(); });
    ok('O3 corrigir Metastatico para Não repinta a prévia para Inelegível / "não será selecionado"; voltar a Sim restaura', /🔴/.test(prevNao) && /não será selecionado/.test(prevNao) && /🟢[\s\S]*vira vigente/.test(await po.evaluate(() => document.getElementById('imp-preview').innerText)), prevNao.slice(0, 120));
    await armarContador(po);
    await po.evaluate(() => { const tr = Array.from(document.querySelectorAll('#imp-painel .imp-tab tbody tr')).find(t => t.querySelector('td').textContent.trim().startsWith('Gleason')); const i = tr.querySelector('input[type=number]'); i.value = '8'; i.dispatchEvent(new Event('change')); });
    await po.fill('#impv_linha', '2');
    const rcO = await lerContador(po);
    ok('O4 corrigir gleason (9 → 8) e linha (1 → 2) no painel: 0 re-render, estado atualizado', rcO === 0 && (await po.evaluate(() => IMP_VAL.valores.gleason === 8 && String(IMP_VAL.linha) === '2')), `renders=${rcO}`);
    // Seção "Lista de problemas proposta": itens + trechos; × tira, + acrescenta — tudo sem render global.
    const txtLp = await po.evaluate(() => (document.getElementById('imp-lp') || {}).innerText || '');
    ok('O4 ★★ painel tem "Lista de problemas proposta" com os itens e os trechos (HAS “Comorbidades : HAS”, Anlodipino, Nega alergias)',
      /Lista de problemas proposta/i.test(txtLp) && /HAS/.test(txtLp) && /Comorbidades : HAS/.test(txtLp) && /Anlodipino 5 mg/.test(txtLp) && /Nega alergias conhecidas/.test(txtLp) && (await po.$$('#imp-lp .lp-chip')).length === 6, txtLp.slice(0, 120).replace(/\n/g, ' '));
    await po.evaluate(() => { const box = document.querySelector('#imp-lp .lp-box[data-lista=comorbidades]'); const chip = Array.from(box.querySelectorAll('.lp-chip')).find(c => /IAM/.test(c.textContent)); chip.querySelector('.lp-x').click(); });
    await po.evaluate(() => document.querySelector('#imp-lp .lp-box[data-lista=alergias] .lp-t button').click());
    await po.waitForSelector('#imp_lp_in', { timeout: 5000 });
    await po.type('#imp_lp_in', 'Dipirona', { delay: 4 });
    await po.press('#imp_lp_in', 'Enter');
    const rcLp = await lerContador(po);
    ok('O4 ★ × tira o IAM da proposta; + em alergias, digitar "Dipirona" e Enter acrescenta: 0 re-render, estado = comorbidades 2, alergias 2',
      rcLp === 0 && (await po.evaluate(() => IMP_VAL.lista_problemas.comorbidades.map(i => i.texto).join('|') === 'HAS|DM (descompensação grave dez/25)' && IMP_VAL.lista_problemas.alergias.map(i => i.texto).join('|') === 'Nega alergias conhecidas|Dipirona'))
      && (await po.$$('#imp-lp .lp-chip')).length === 6, `renders=${rcLp}`);
    await po.click('#imp_validar');
    await po.waitForFunction(id => view === 'paciente' && PAC_DETAIL[id] && PAC_DETAIL[id].ultima_avaliacao && !document.getElementById('imp-painel'), p4, { timeout: 30000 });
    const txtV = await textoApp(po);
    ok('O5 ★★ Validar: painel some; ficha igual à do #80 — Enzalutamida vigente, nota ⚠️ "Importação retroativa…" com a médica assistente, fotografia clínica com Gleason 8',
      !txtV.includes('aguardando a sua validação') && txtV.includes('Enzalutamida') && txtV.includes('⚠️ Importação retroativa — tratamento em curso desde 16/01/2026') && txtV.includes(MEDICA) && /Gleason[^\n]*8/.test(txtV) && txtV.includes('Elegível'),
      txtV.slice(0, 160).replace(/\n/g, ' '));
    const av4 = ((await req('GET', `/pacientes/${p4}/avaliacoes`, tkOnco)).body || [])[0];
    ok('O5 ★ o registro gravado pela tela: correções valeram (gleason 8, 2ª linha), quimio_naive AUSENTE, assinatura do oncologista logado',
      !!av4 && av4.snapshot_campos.gleason === 8 && av4.linha_tratamento === 2 && !('quimio_naive' in av4.snapshot_campos) && av4.avaliado_por.nome === NOME_ONCO && av4.autorizacao_estado === 'nao_necessaria', JSON.stringify(av4 && av4.snapshot_campos));
    ok('O5 agenda da ficha = 25/09/2026 (retorno da meta)', txtV.includes('25/09/2026'));
    const faixa = await po.evaluate(() => { const f = document.getElementById('lp-faixa'); if (!f) return null; const box = l => f.querySelector(`.lp-box[data-lista=${l}]`); const chips = l => Array.from(box(l).querySelectorAll('.lp-chip')).map(c => ({ t: c.firstChild.textContent, tip: c.getAttribute('title') })); return { c: chips('comorbidades'), m: chips('medicacoes_uso'), a: chips('alergias'), mais: f.querySelectorAll('.lp-t button').length, x: f.querySelectorAll('.lp-x').length }; });
    ok('O5 ★★ FAIXA sob o cabeçalho: Comorbidades HAS · DM (o IAM tirado NÃO entrou) · Medicações 2 · Alergias "Nega alergias conhecidas" + "Dipirona" (a acrescentada entrou)',
      !!faixa && faixa.c.map(i => i.t).join('|') === 'HAS|DM (descompensação grave dez/25)' && faixa.m.length === 2 && faixa.a.map(i => i.t).join('|') === 'Nega alergias conhecidas|Dipirona', JSON.stringify(faixa));
    ok(`O5 ★ tooltip de cada chip traz a origem "${ORIGEM_IMP}", a data e o validador; oncologista vê os botões + (3) e × (6)`,
      !!faixa && [...faixa.c, ...faixa.m, ...faixa.a].every(i => i.tip.includes(ORIGEM_IMP) && i.tip.includes(NOME_ONCO)) && faixa.mais === 3 && faixa.x === 6, faixa && faixa.c[0] && faixa.c[0].tip);
    const av4lp = await req('GET', `/pacientes/${p4}`, tkOnco);
    ok('O5 ★ o que a tela mostra é o que o servidor tem (ficha por API = mesmos textos)', (av4lp.body.comorbidades || []).map(i => i.texto).join('|') === 'HAS|DM (descompensação grave dez/25)' && (av4lp.body.alergias || []).map(i => i.texto).join('|') === 'Nega alergias conhecidas|Dipirona');
    // Revisor/auditor SÓ LEEM: mesma função de render, perfil trocado no estado da página (sem login extra — 5/min).
    const faixaRev = await po.evaluate(id => { const p0 = USUARIO.perfil; USUARIO.perfil = 'revisor'; const h = lpFaixaHtml(id); USUARIO.perfil = p0; return { chips: (h.match(/lp-chip/g) || []).length, mais: (h.match(/title="Adicionar"/g) || []).length, x: (h.match(/lp-x/g) || []).length }; }, p4);
    ok('O5 ★ perfil clínico sem alçada (revisor): a faixa desenha os chips, mas SEM + e SEM ×', faixaRev.chips === 6 && faixaRev.mais === 0 && faixaRev.x === 0, JSON.stringify(faixaRev));
    await po.evaluate(id => abrir(id, 'trilha'), p4);
    await po.waitForFunction(id => view === 'paciente' && pacTab === 'trilha' && TRILHA[id] && TRILHA[id].itens, p4, { timeout: 25000 });
    const txtT = await textoApp(po);
    ok('O6 ★ trilha: "Proposta de importação por <secretária>" como Administrativo, validada, + seleção de protocolo e retorno assinados pelo oncologista',
      txtT.includes('Proposta de importação por ' + NOME_S) && txtT.includes('Validada por ' + NOME_ONCO) && txtT.includes('registrado como vigente') && txtT.includes('Seleção de protocolo') && (await htmlApp(po)).includes('tl-tipo adm'));
    ok('O6 ★ trilha da tela: "📋 Lista de problemas atualizada" como Administrativo, com a nota (+HAS … +Dipirona)', /Lista de problemas atualizada/.test(txtT) && /\+HAS/.test(txtT) && /\+Dipirona/.test(txtT));
    // Ficha de quem NÃO tem nada (N1): três "— nenhuma registrada —"; + e × pela tela.
    const pN1 = n1.body.id;
    await po.evaluate(id => abrir(id), pN1);
    await po.waitForFunction(id => view === 'paciente' && PAC_DETAIL[id] && document.getElementById('lp-faixa') && document.getElementById('lp-faixa').querySelector('.lp-box'), pN1, { timeout: 25000 });
    const vazios = await po.evaluate(() => Array.from(document.querySelectorAll('#lp-faixa .lp-vazio')).map(e => e.textContent.trim()));
    ok('O9 ★ ficha SEM lista de problemas não quebra: as três caixas com "— nenhuma registrada —" (discreto), sem erro', vazios.length === 3 && vazios.every(v => v === '— nenhuma registrada —'), JSON.stringify(vazios));
    await armarContador(po);
    await po.evaluate(() => document.querySelector('#lp-faixa .lp-box[data-lista=comorbidades] .lp-t button').click());
    await po.waitForSelector('#lp_in_comorbidades', { timeout: 5000 });
    await po.type('#lp_in_comorbidades', 'DPOC', { delay: 4 });
    const rcLp1 = await lerContador(po);
    ok('O9 ★ + abre o campo na caixa; digitar "DPOC": 0 re-render, texto íntegro', rcLp1 === 0 && (await po.inputValue('#lp_in_comorbidades')) === 'DPOC' && (await po.evaluate(() => LP_FORM && LP_FORM.texto === 'DPOC')), `renders=${rcLp1}`);
    await po.press('#lp_in_comorbidades', 'Enter');
    await po.waitForFunction(() => !!document.querySelector('#lp-faixa .lp-box[data-lista=comorbidades] .lp-chip') && !document.getElementById('lp_in_comorbidades'), null, { timeout: 15000 });
    const chipN1 = await po.evaluate(() => { const c = document.querySelector('#lp-faixa .lp-box[data-lista=comorbidades] .lp-chip'); return { t: c.firstChild.textContent, tip: c.getAttribute('title') }; });
    const rcLp2 = await lerContador(po);
    ok('O9 ★★ Enter grava: chip "DPOC" na faixa (só #lp-faixa repintado, 0 render global), tooltip "registro manual · <data> · por <oncologista>"',
      chipN1.t === 'DPOC' && /^registro manual · .+ · por /.test(chipN1.tip) && chipN1.tip.includes(NOME_ONCO) && rcLp2 === 0, JSON.stringify(chipN1) + ` renders=${rcLp2}`);
    const nDialogs = ctxO.dialogs.length;
    await po.evaluate(() => document.querySelector('#lp-faixa .lp-box[data-lista=comorbidades] .lp-x').click());
    await po.waitForFunction(() => !document.querySelector('#lp-faixa .lp-box[data-lista=comorbidades] .lp-chip'), null, { timeout: 15000 });
    ok('O9 ★ × pede CONFIRMAÇÃO (confirm nomeando o item) e remove: caixa volta a "— nenhuma registrada —"',
      ctxO.dialogs.length === nDialogs + 1 && /^confirm:Remover "DPOC"/.test(ctxO.dialogs[nDialogs]) && (await po.evaluate(() => document.querySelector('#lp-faixa .lp-box[data-lista=comorbidades] .lp-vazio').textContent.trim() === '— nenhuma registrada —')), ctxO.dialogs[nDialogs]);
    const trN1 = await req('GET', `/pacientes/${pN1}/trilha`, tkOnco);
    const evsN1 = (trN1.body.itens || []).filter(i => i.evento === 'lista_problemas').map(i => i.nota);
    ok('O9 ★★ o rastro dos dois cliques está na trilha: "+DPOC" e "−DPOC", pelo oncologista logado', evsN1.length === 2 && evsN1.some(n => /\+DPOC/.test(n)) && evsN1.some(n => /−DPOC/.test(n)), JSON.stringify(evsN1));
    // Descartar pela tela (P3 recebeu outra proposta em D2).
    await po.evaluate(() => carregarPacientes());
    await po.evaluate(id => abrir(id), p3);
    await po.waitForSelector('#imp_descartar', { timeout: 25000 });
    await po.click('#imp_descartar');
    await po.waitForFunction(id => IMP_PROP[id] && IMP_PROP[id].estado === 'descartada' && !document.getElementById('imp-painel'), p3, { timeout: 25000 });
    const gp3 = await req('GET', `/pacientes/${p3}/importacao-proposta`, tkOnco);
    ok('O7 ★ Descartar… pela tela pede o motivo (prompt), grava e o painel some', ctxO.dialogs.some(d => d.startsWith('prompt:')) && gp3.body.proposta.estado === 'descartada' && /descartado pela tela/.test(gp3.body.proposta.motivo_descarte));
    ok('O8 console do oncologista sem erro', ctxO.errs.length === 0, JSON.stringify(ctxO.errs));
  } catch (e) {
    ok('EXCEÇÃO no portão', false, e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e.message);
  } finally {
    if (ctxS) { try { await ctxS.ctx.close(); } catch (_) { } }
    if (ctxO) { try { await ctxO.ctx.close(); } catch (_) { } }
    const tk = tkAdm || await tokenApi(API, 'admin').catch(() => null);
    for (const pid of pacientes) {
      try {
        let del = await req('DELETE', `/pacientes/${pid}`, tk);
        // Uma segunda tentativa num 5xx: o driver do Neon (WebSocket) derruba conexão de
        // vez em quando e o DELETE volta 500 sem nada errado no código — aconteceu na
        // primeira suíte (2026-09-15). Um resíduo por isso seria falso vermelho; e se for
        // erro de verdade, a segunda tentativa também falha e o check fica vermelho.
        if (del.status >= 500) { await new Promise(r => setTimeout(r, 2000)); del = await req('DELETE', `/pacientes/${pid}`, tk); }
        ok(`Z limpeza: paciente ${pid} removido`, del.status === 200 || del.status === 204, String(del.status));
      } catch (e) { ok(`Z limpeza: paciente ${pid} removido`, false, e.message); }
    }
    if (usuarioSId) {
      try {
        const del = await req('DELETE', `/usuarios/${usuarioSId}`, tk);
        ok('Z limpeza: usuária de teste removida', del.status === 200 || del.status === 204, String(del.status));
      } catch (e) { ok('Z limpeza: usuária de teste removida', false, e.message); }
    }
    // Prova relendo a carteira: nada com o prefixo deste portão sobrou.
    try {
      const sobra = ((await req('GET', '/pacientes', tk)).body || []).filter(p => String(p.identificador || '').startsWith(IDENT_PREFIXO));
      ok('Z limpeza provada: carteira sem paciente deste portão', sobra.length === 0, `sobra=${sobra.length}`);
    } catch (e) { ok('Z limpeza provada: carteira sem paciente deste portão', false, e.message); }
    await Promise.race([browser.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
    const falhas = R.filter(r => !r[0]).length;
    console.log(`\n${R.length - falhas}/${R.length} checks passaram` + (falhas ? ` — ${falhas} FALHA(S)` : ' — portão OK'));
    process.exit(falhas ? 1 : 0);
  }
})();
