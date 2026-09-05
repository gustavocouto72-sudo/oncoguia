// Portão da GESTÃO DE RECURSOS — fluxos reais em browser isolado (headless) + API.
// É o check que NÃO passa pelo agente.
//
//  Fase 1 (API): a matriz do perfil GESTOR nas DUAS direções. Oncologista, revisor e
//    AUDITOR levam 403 em TODA rota de /recursos — leitura e escrita —, batendo direto na
//    URL. E o gestor leva 403 em tudo que é clínico: paciente, trilha, retorno, seleção,
//    Revisão, autorização, custo e usuários. Gestor lê recursos mas NÃO cadastra.
//  Fase 2 (API): a ARITMÉTICA, recalculada com regra PRÓPRIA a partir do JSON de origem
//    (backend/data/evidencia.json) + os preços cadastrados pelo próprio portão. Cobre as
//    três conversões que decidem dinheiro — mg/m² (superfície), mg/kg (peso) e AUC
//    (Calvert) —, o arredondamento de frascos para CIMA por aplicação, o desperdício e a
//    margem como diferença exata. Portão que importa a função sob teste não testa nada.
//  Fase 3 (API): as TRÊS origens exercitadas — insumo, protocolo-fallback e sem-dado — e
//    a regra de que faturamento ausente NUNCA herda o preço de compra.
//  Fase 4 (API): projeção por horizonte + PSEUDONIMIZAÇÃO, com teste AFIRMATIVO: a
//    resposta inteira para o token de gestor não contém o nome do paciente de teste.
//  Fase 5 (UI, gestor): a aba Recursos existe, Pacientes NÃO existe no DOM nem entrando
//    por go('lista'), a tela não imprime o nome do paciente, e o .xlsx exportado é aberto
//    e conferido contra os números da tela.
//  Fase 6 (UI, admin): digitar preço de insumo não re-renderiza a lista (contador = 0) e
//    o valor digitado sobrevive.
//  Limpeza: devolve o banco como encontrou — insumo/apresentação que o portão criou são
//    apagados, apresentação padrão que já existia é restaurada. RODE DUAS VEZES SEGUIDAS:
//    a segunda tem de dar o mesmo resultado da primeira.
//
// NÃO ENCADEIE este portão com outro sem uma janela de ~1 min: `POST /auth/login` é
// limitado a 5/min por IP e este portão usa 5 perfis. O helper espera no 429, mas dois
// portões seguidos gastam a janela inteira e o segundo dorme muito.
//
// Uso: node scripts/portao-recursos.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005).
const path = require('path');
const fs = require('fs');
const os = require('os');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const { tokenApi, loginNaTela } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';
const EVID = path.join(ROOT, 'backend/data/evidencia.json');

// ---- regimes de teste, escolhidos por CARACTERÍSTICA, não por gosto -----------------
// mg/m² (superfície), uso fixo, 1 aplicação por ciclo. É o caso do paciente do portão.
const RID_M2 = 'prostata-mcspc-docetaxel';
// mg/kg (peso) com D1,D8 — duas aplicações por ciclo, que é onde o arredondamento por
// APLICAÇÃO (e não por ciclo) muda o número de frascos.
const RID_KG = 'mama-met-tnbc-3l-sacituzumab-ascent';
// AUC (Calvert) + três fármacos no mesmo ciclo.
const RID_AUC = 'endometrio-met-pembrolizumabe-qt-nao-incluido';
// Composição indeterminada no corpus (temozolomida em faixa 150-200 mg/m²): é o caso do
// FALLBACK — sem mg por aplicação, mas com preço por protocolo cadastrado.
const RID_FALLBACK = 'gbm-stupp';

const NOME_TESTE = 'Paciente Portao Recursos';
const FONTE_CT = 'PORTAO RECURSOS - CMED teste';
const FONTE_CN = 'PORTAO RECURSOS - contrato compra teste';
const FONTE_FAT = 'PORTAO RECURSOS - contrato operadora teste';

// Preços de teste por fármaco: [conteudo_valor, unidade, compra_tabela, compra_negociado,
// faturamento|null]. O último NULL é de propósito: prova que faturamento ausente não vira
// margem zero.
const INSUMOS_TESTE = {
  'Docetaxel':                { conteudo: 'frasco 80 mg',   valor: 80,   un: 'mg', ct: 900.00,  cn: 700.00,  fat: 1250.00 },
  'Sacituzumabe govitecana':  { conteudo: 'frasco 180 mg',  valor: 180,  un: 'mg', ct: 6400.00, cn: 5100.00, fat: 8000.00 },
  'Pembrolizumabe':           { conteudo: 'frasco 100 mg',  valor: 100,  un: 'mg', ct: 12000.00, cn: 9800.00, fat: 15500.00 },
  'Carboplatina':             { conteudo: 'frasco 150 mg',  valor: 150,  un: 'mg', ct: 120.00,  cn: 85.00,   fat: 160.00 },
  // SEM faturamento: o protocolo do AUC fica com compra e sem receita — é o caso que
  // prova "sem cadastro, sem projeção de receita; nunca herdar da compra".
  'Paclitaxel':               { conteudo: 'frasco 100 mg',  valor: 100,  un: 'mg', ct: 260.00,  cn: 180.00,  fat: null },
};

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 190) + ']' : '')); };

async function req(metodo, rota, tk, body) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: Object.assign(tk ? { Authorization: 'Bearer ' + tk } : {}, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch (_) { }
  return { status: r.status, body: j };
}

// ---- ARITMÉTICA PRÓPRIA do portão (independente do servidor) -------------------------
// Reimplementada do zero a partir da especificação, não importada de backend/src: é a
// conta que decide quantos frascos o hospital compra e quanto cobra da operadora, e um
// portão que chama a mesma função concorda com ela por construção.
function mgPorAplicacaoPortao(valor, unidade, corpo) {
  if (unidade === 'mg_m2') return valor * corpo.sc;
  if (unidade === 'mg_kg') return valor * corpo.peso;
  if (unidade === 'mg') return valor;
  if (unidade === 'g') return valor * 1000;
  if (unidade === 'g_m2') return valor * 1000 * corpo.sc;
  if (unidade === 'mcg') return valor / 1000;
  if (unidade === 'mcg_kg') return valor * corpo.peso / 1000;
  if (unidade === 'AUC') return valor * (corpo.clearance + 25);  // Calvert
  if (unidade === 'UI' || unidade === 'GBq') return valor;
  return null;
}
// Superfície de Mosteller: raiz de (altura_cm x peso_kg / 3600).
function scPortao(peso, altura) { return Math.sqrt((altura * peso) / 3600); }
// Frascos: para CIMA por APLICAÇÃO (cada administração abre frascos novos), depois vezes
// o nº de aplicações do ciclo.
function frascosPortao(mgAplicacao, conteudoMg, aplicacoes) {
  const porAplicacao = Math.ceil(mgAplicacao / conteudoMg);
  return { porAplicacao, porCiclo: porAplicacao * aplicacoes };
}
const perto = (a, b, tol) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= (tol === undefined ? 0.005 : tol);

// Ciclo do regime, recalculado do zero: composição do corpus + preços de teste.
function cicloEsperadoPortao(regime, corpo) {
  const c = regime.composicao;
  if (!c || !c.completa) return null;
  let min = 0, max = 0, fat = 0, fatCompleto = true;
  const itens = [];
  for (const it of c.itens) {
    const p = INSUMOS_TESTE[it.farmaco];
    if (!p) return null;
    const aplicacoes = (it.dias_do_ciclo && it.dias_do_ciclo.length) || 1;
    const mg = mgPorAplicacaoPortao(it.dose_valor, it.dose_unidade, corpo);
    const f = frascosPortao(mg, p.valor, aplicacoes);
    min += Math.round(p.cn * 100) * f.porCiclo;
    max += Math.round(p.ct * 100) * f.porCiclo;
    if (p.fat === null) fatCompleto = false; else fat += Math.round(p.fat * 100) * f.porCiclo;
    itens.push({ farmaco: it.farmaco, mg, aplicacoes, frascos: f.porCiclo, conteudo: p.valor });
  }
  return {
    itens,
    compra_min: min / 100, compra_max: max / 100,
    faturamento: fatCompleto ? fat / 100 : null,
    // Margem = diferença EXATA. A pior margem usa a compra no TETO da faixa.
    margem_min: fatCompleto ? (fat - max) / 100 : null,
    margem_max: fatCompleto ? (fat - min) / 100 : null,
  };
}

// ---- leitor de ZIP "stored" (o .xlsx que a app escreve) ------------------------------
// Só entradas sem compressão, que é o que o escritor da app produz. Escrito aqui em vez
// de reusar o da app pelo mesmo motivo da aritmética.
function lerZipStored(buf) {
  const arquivos = {};
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const metodo = buf.readUInt16LE(i + 8);
    const tam = buf.readUInt32LE(i + 18);
    const nLen = buf.readUInt16LE(i + 26);
    const eLen = buf.readUInt16LE(i + 28);
    const nome = buf.slice(i + 30, i + 30 + nLen).toString('utf8');
    const ini = i + 30 + nLen + eLen;
    if (metodo !== 0) throw new Error('entrada comprimida no .xlsx: ' + nome);
    arquivos[nome] = buf.slice(ini, ini + tam).toString('utf8');
    i = ini + tam;
  }
  return arquivos;
}
// Células de uma sheet, na ordem em que aparecem: número vira Number, inlineStr vira
// string. Suficiente para conferir contra a tela.
function celulasDaSheet(xml) {
  const out = [];
  const re = /<c r="([A-Z]+\d+)"(?: t="inlineStr")?>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)<\/c>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[2] !== undefined ? Number(m[2])
      : String(m[3]).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  }
  return out;
}

async function ctxLogin(browser, perfil, extra) {
  const ctx = await browser.newContext(extra || {});
  const page = await ctx.newPage();
  const errs = [];
  const ruido = t => /429|Too Many Requests/i.test(t);
  page.on('console', m => { if (m.type() === 'error' && !ruido(m.text())) errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  page.on('dialog', async d => { await d.accept(); });
  await page.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);
  await page.goto(APP);
  await loginNaTela(page, perfil);
  await page.waitForFunction(() => !!localStorage.getItem('oncoguia_token'), null, { timeout: 25000 });
  return { ctx, page, errs };
}

(async () => {
  // Primeira linha: sobre QUE BANCO este resultado vale. Aborta se não for o de dev.
  exigirBancoDeDev('recursos (insumos, compra, faturamento e margem)');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const evid = JSON.parse(fs.readFileSync(EVID, 'utf-8'));
  const regs = new Map(evid.regimes.map(r => [r.regimen_id, r]));
  let tkOnco, tkRev, tkAud, tkAdm, tkGes;
  let pacienteId = null;
  // Estado anterior, para devolver o banco como encontrado. Por fármaco:
  //   insumoCriado    — o portão criou o insumo (apaga no fim, com as apresentações);
  //   apresCriadaId   — a apresentação que o portão criou (apaga);
  //   padraoAnterior  — a apresentação que ERA padrão antes (restaura a marcação).
  const anteriores = {};
  let precoFallbackAnterior = null, criouPrecoFallback = false;
  let premAnterior = null;
  const baixados = fs.mkdtempSync(path.join(os.tmpdir(), 'portao-recursos-'));

  try {
    tkAdm = await tokenApi(API, 'admin');
    tkGes = await tokenApi(API, 'gestor');
    tkAud = await tokenApi(API, 'auditor');
    tkOnco = await tokenApi(API, 'oncologista');
    tkRev = await tokenApi(API, 'revisor');

    // ═══ FASE 1 — matriz de perfil por API DIRETA, nas DUAS direções ═══
    const rotasRecursosLeitura = ['/recursos/premissas', '/recursos/insumos', '/recursos/insumos/corpus',
      '/recursos/cobertura', '/recursos/projecao?horizonte=6', `/recursos/regime/${RID_M2}`];
    for (const [perfil, tk] of [['oncologista', tkOnco], ['revisor', tkRev], ['auditor', tkAud]]) {
      let todas403 = true, detalhe = '';
      for (const rota of rotasRecursosLeitura) {
        const r = await req('GET', rota, tk);
        if (r.status !== 403) { todas403 = false; detalhe += `${rota}=${r.status} `; }
      }
      ok(`G1 ${perfil} levou 403 em TODA leitura de recursos (${rotasRecursosLeitura.length} rotas)`, todas403, detalhe);
      const w = await req('POST', '/recursos/insumos', tk, { farmaco: 'X' });
      ok(`G1 ${perfil} levou 403 na ESCRITA de insumo`, w.status === 403, 'status=' + w.status);
    }
    // O AUDITOR continua vendo CUSTO (é o dado da decisão de exceção) — o 403 acima é só
    // de recursos. Se este check cair, a correção quebrou o módulo anterior.
    const audCusto = await req('GET', '/custos/carteira', tkAud);
    ok('G1 auditor CONTINUA vendo custo no fluxo de autorização', audCusto.status === 200, 'status=' + audCusto.status);

    // Direção inversa: o gestor não entra em nada clínico.
    const rotasClinicas = ['/pacientes', '/pacientes/1', '/pacientes/1/avaliacoes', '/pacientes/1/selecoes',
      '/pacientes/1/trilha', '/pacientes/1/retornos', '/revisoes', '/revisoes/resumo',
      '/custos', '/custos/carteira', `/custos/estimativa/${RID_M2}`, '/autorizacoes', '/usuarios'];
    {
      let todas403 = true, detalhe = '';
      for (const rota of rotasClinicas) {
        const r = await req('GET', rota, tkGes);
        if (r.status !== 403) { todas403 = false; detalhe += `${rota}=${r.status} `; }
      }
      ok(`G1 gestor levou 403 em TODA rota clínica (${rotasClinicas.length} rotas: paciente, Revisão, autorização, custo, usuários)`,
        todas403, detalhe);
      const av = await req('POST', '/pacientes/1/avaliacoes', tkGes, { regimen_id: RID_M2, snapshot_campos: {}, semaforo: 'elegivel' });
      ok('G1 gestor levou 403 ao tentar REGISTRAR avaliação', av.status === 403, 'status=' + av.status);
      const dec = await req('POST', '/autorizacoes/1/decidir', tkGes, { decisao: 'aprovada', parecer: 'x' });
      ok('G1 gestor levou 403 ao tentar DECIDIR autorização', dec.status === 403, 'status=' + dec.status);
      const rev = await req('POST', '/revisoes', tkGes, { regimen_id: RID_M2, content_hash: 'x', decisao: 'aprovado' });
      ok('G1 gestor levou 403 ao tentar gravar PARECER de revisão', rev.status === 403, 'status=' + rev.status);
    }
    // Gestor LÊ recursos, mas não CADASTRA.
    const gLe = await req('GET', '/recursos/projecao?horizonte=6', tkGes);
    ok('G1 gestor LÊ a projeção de recursos', gLe.status === 200, 'status=' + gLe.status);
    for (const [m, rota, body] of [['POST', '/recursos/insumos', { farmaco: 'X' }],
                                   ['PUT', '/recursos/premissas', { sc_m2: 2, peso_kg: 80, clearance_ml_min: 90 }],
                                   ['DELETE', '/recursos/insumos/999999', null]]) {
      const r = await req(m, rota, tkGes, body);
      ok(`G1 gestor levou 403 em ${m} ${rota}`, r.status === 403, 'status=' + r.status);
    }

    // ═══ FASE 2 — aritmética: insumo → frascos → custo/receita → margem ═══
    // Premissas conhecidas: o portão FIXA o paciente-padrão para a conta ser determinística,
    // e restaura o valor anterior na limpeza.
    premAnterior = (await req('GET', '/recursos/premissas', tkAdm)).body;
    const PREM = { sc_m2: 1.75, peso_kg: 70, clearance_ml_min: 100 };
    const pPut = await req('PUT', '/recursos/premissas', tkAdm, PREM);
    ok('G2 premissas do paciente-padrão gravadas (admin)', pPut.status === 200, 'status=' + pPut.status);
    const CORPO_PADRAO = { sc: PREM.sc_m2, peso: PREM.peso_kg, clearance: PREM.clearance_ml_min };

    // Cadastra os insumos de teste (guardando o estado anterior de cada um).
    const insumosAtuais = (await req('GET', '/recursos/insumos', tkAdm)).body || [];
    for (const [farmaco, p] of Object.entries(INSUMOS_TESTE)) {
      let ins = insumosAtuais.find(i => i.farmaco === farmaco);
      const criado = !ins;
      if (!ins) ins = (await req('POST', '/recursos/insumos', tkAdm, { farmaco })).body;
      const padraoAnterior = ((ins.apresentacoes || []).find(a => a.padrao) || {}).id || null;
      const ap = await req('POST', '/recursos/apresentacoes', tkAdm, {
        insumo_id: ins.id, conteudo: p.conteudo, conteudo_valor: p.valor, conteudo_unidade: p.un, padrao: true,
        preco_compra_tabela: p.ct, preco_compra_negociado: p.cn,
        preco_faturamento: p.fat, fonte_compra_tabela: FONTE_CT, fonte_compra_negociado: FONTE_CN,
        fonte_faturamento: p.fat === null ? null : FONTE_FAT,
      });
      anteriores[farmaco] = { insumoId: ins.id, insumoCriado: criado, apresCriadaId: ap.body && ap.body.id, padraoAnterior };
      ok(`G2 apresentação de ${farmaco} cadastrada (${p.conteudo})`, ap.status === 201 || ap.status === 200, 'status=' + ap.status);
    }

    // Preço de faturamento SEM fonte tem de ser recusado nos dois sentidos.
    {
      const semFonte = await req('POST', '/recursos/apresentacoes', tkAdm, {
        insumo_id: anteriores['Docetaxel'].insumoId, conteudo: 'x', conteudo_valor: 10, conteudo_unidade: 'mg',
        preco_compra_tabela: 10, preco_compra_negociado: 5, preco_faturamento: 20,
        fonte_compra_tabela: 'a', fonte_compra_negociado: 'b',
      });
      ok('G2 preço de faturamento SEM fonte é recusado (400)', semFonte.status === 400, 'status=' + semFonte.status);
      const invertida = await req('POST', '/recursos/apresentacoes', tkAdm, {
        insumo_id: anteriores['Docetaxel'].insumoId, conteudo: 'x', conteudo_valor: 10, conteudo_unidade: 'mg',
        preco_compra_tabela: 5, preco_compra_negociado: 10, fonte_compra_tabela: 'a', fonte_compra_negociado: 'b',
      });
      ok('G2 negociado acima da tabela é recusado (faixa invertida)', invertida.status === 400, 'status=' + invertida.status);
    }

    // (a) mg/m² — Docetaxel 75 mg/m², 1 aplicação por ciclo.
    // (b) mg/kg com D1,D8 — o arredondamento por APLICAÇÃO é o ponto.
    // (c) AUC (Calvert) + três fármacos, um deles sem faturamento.
    for (const rid of [RID_M2, RID_KG, RID_AUC]) {
      const esperado = cicloEsperadoPortao(regs.get(rid), CORPO_PADRAO);
      const c = (await req('GET', `/recursos/regime/${rid}`, tkGes)).body;
      ok(`G2 ${rid}: origem é 'insumo' (composição fecha e há preço)`, c.origem === 'insumo',
        `${c.origem}${c.motivo ? ' / ' + c.motivo : ''}`);
      if (c.origem !== 'insumo' || !esperado) continue;
      ok(`G2 ${rid}: compra por ciclo = recálculo do portão`,
        perto(c.compra_min_ciclo, esperado.compra_min) && perto(c.compra_max_ciclo, esperado.compra_max),
        `${c.compra_min_ciclo}/${c.compra_max_ciclo} esperado ${esperado.compra_min}/${esperado.compra_max}`);
      ok(`G2 ${rid}: faturamento por ciclo = recálculo do portão`,
        (esperado.faturamento === null ? c.faturamento_ciclo === null : perto(c.faturamento_ciclo, esperado.faturamento)),
        `${c.faturamento_ciclo} esperado ${esperado.faturamento}`);
      ok(`G2 ${rid}: margem = diferença EXATA (mínimo usa a compra no teto)`,
        (esperado.margem_min === null
          ? c.margem_min_ciclo === null && c.margem_max_ciclo === null
          : perto(c.margem_min_ciclo, esperado.margem_min) && perto(c.margem_max_ciclo, esperado.margem_max)
            && perto(c.margem_min_ciclo, c.faturamento_ciclo - c.compra_max_ciclo)
            && perto(c.margem_max_ciclo, c.faturamento_ciclo - c.compra_min_ciclo)),
        `${c.margem_min_ciclo}/${c.margem_max_ciclo} esperado ${esperado.margem_min}/${esperado.margem_max}`);
      // Frascos, mg por aplicação e desperdício, item a item.
      let itensOk = true, det = '';
      for (const e of esperado.itens) {
        const i = c.itens.find(x => x.farmaco === e.farmaco);
        if (!i) { itensOk = false; det += `${e.farmaco} ausente; `; continue; }
        const desp = i.frascos.frascos_por_ciclo * e.conteudo - e.mg * e.aplicacoes;
        if (!perto(i.frascos.quantidade_por_aplicacao, e.mg, 0.01) ||
            i.frascos.frascos_por_ciclo !== e.frascos ||
            i.frascos.aplicacoes_por_ciclo !== e.aplicacoes ||
            !perto(i.frascos.desperdicio_por_ciclo, desp, 0.01)) {
          itensOk = false;
          det += `${e.farmaco}: mg=${i.frascos.quantidade_por_aplicacao}/${e.mg.toFixed(2)} frascos=${i.frascos.frascos_por_ciclo}/${e.frascos} apl=${i.frascos.aplicacoes_por_ciclo}/${e.aplicacoes} desp=${i.frascos.desperdicio_por_ciclo}/${desp.toFixed(2)}; `;
        }
      }
      ok(`G2 ${rid}: mg por aplicação, frascos (arredondados p/ CIMA) e desperdício conferem`, itensOk, det);
      ok(`G2 ${rid}: premissas do cálculo vieram na resposta`,
        c.premissas && perto(c.premissas.sc_m2, PREM.sc_m2) && c.premissas.origem_sc === 'padrao_declarado',
        JSON.stringify(c.premissas));
    }

    // O caso do AUC merece uma conta escrita à mão, não só a comparação em laço:
    // carboplatina AUC 5 com clearance declarado de 100 -> 5 x 125 = 625 mg -> 5 frascos
    // de 150 mg (750 mg comprados, 125 mg de desperdício).
    {
      const c = (await req('GET', `/recursos/regime/${RID_AUC}`, tkGes)).body;
      const carbo = (c.itens || []).find(i => i.farmaco === 'Carboplatina');
      ok('G2 Calvert: AUC 5 x (clearance 100 + 25) = 625 mg -> 5 frascos de 150 mg',
        carbo && perto(carbo.frascos.quantidade_por_aplicacao, 625, 0.01) && carbo.frascos.frascos_por_ciclo === 5,
        carbo ? `${carbo.frascos.quantidade_por_aplicacao} mg / ${carbo.frascos.frascos_por_ciclo} frascos` : 'item ausente');
      ok('G2 faturamento AUSENTE em um item deixa o protocolo SEM receita (não herda a compra)',
        c.faturamento_ciclo === null && c.margem_min_ciclo === null && c.compra_min_ciclo > 0,
        `fat=${c.faturamento_ciclo} margem=${c.margem_min_ciclo} compra=${c.compra_min_ciclo}`);
    }

    // ═══ FASE 3 — as TRÊS origens ═══
    // (a) 'insumo' já provado acima. (b) 'protocolo-fallback': composição indeterminada
    // no corpus + preço por protocolo cadastrado. (c) 'sem-dado': nem um nem outro.
    {
      const comp = (regs.get(RID_FALLBACK).composicao || {});
      ok('G3 regime do fallback tem composição INDETERMINADA no corpus (pré-condição)',
        comp.completa === false, `completa=${comp.completa}`);
      precoFallbackAnterior = (await req('GET', '/custos', tkAdm)).body.find(c => c.regimen_id === RID_FALLBACK) || null;
      criouPrecoFallback = !precoFallbackAnterior;
      const put = await req('PUT', `/custos/${RID_FALLBACK}`, tkAdm, {
        custo_ciclo_tabela: 3200.00, custo_ciclo_negociado: 2400.00,
        fonte_tabela: FONTE_CT, fonte_negociado: FONTE_CN, periodo_dias: null,
      });
      ok('G3 preço por protocolo cadastrado para o caso de fallback', put.status === 200, 'status=' + put.status);
      const c = (await req('GET', `/recursos/regime/${RID_FALLBACK}`, tkGes)).body;
      ok('G3 origem = protocolo-fallback, com motivo explícito', c.origem === 'protocolo-fallback' && !!c.explicacao,
        `${c.origem} / ${c.motivo}`);
      ok('G3 fallback dá COMPRA (a faixa do protocolo) e NENHUMA receita',
        perto(c.compra_min_ciclo, 2400) && perto(c.compra_max_ciclo, 3200)
        && c.faturamento_ciclo === null && c.margem_min_ciclo === null,
        `${c.compra_min_ciclo}/${c.compra_max_ciclo} fat=${c.faturamento_ciclo}`);
      ok('G3 fallback não inventa itens de insumo', (c.itens || []).length === 0, `itens=${(c.itens || []).length}`);

      // 'sem-dado': um regime sem preço por protocolo e sem composição utilizável.
      const comPreco = new Set(((await req('GET', '/custos', tkAdm)).body || []).map(x => x.regimen_id));
      const ridSemDado = evid.regimes.find(r => !comPreco.has(r.regimen_id) && !(r.composicao || {}).completa).regimen_id;
      const s = (await req('GET', `/recursos/regime/${ridSemDado}`, tkGes)).body;
      ok('G3 origem = sem-dado, com motivo e SEM zeros silenciosos',
        s.origem === 'sem-dado' && !!s.explicacao
        && s.compra_min_ciclo === null && s.compra_max_ciclo === null && s.faturamento_ciclo === null,
        `${ridSemDado}: ${s.motivo} compra=${s.compra_min_ciclo}`);
    }

    // ═══ FASE 4 — projeção, medidas reais do paciente e PSEUDONIMIZAÇÃO ═══
    {
      const novoP = await req('POST', '/pacientes', tkAdm, {
        nome: NOME_TESTE, sexo: 'M', tumor: 'prostata', identificador: 'PORTAO-RECURSOS',
        peso_kg: 82.5, altura_cm: 178,
      });
      pacienteId = novoP.body && novoP.body.id;
      ok('G4 paciente de teste criado com peso e altura', !!pacienteId && novoP.body.peso_kg == 82.5, 'status=' + novoP.status);

      const av = await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkOnco, {
        regimen_id: RID_M2, linha_tratamento: 1, snapshot_campos: { portao: true }, semaforo: 'elegivel',
      });
      ok('G4 avaliação vigente registrada no protocolo de teste', av.status === 201 || av.status === 200, 'status=' + av.status);

      // A ficha (auditor) usa as medidas REAIS: SC de Mosteller com 82,5 kg e 178 cm.
      const scReal = scPortao(82.5, 178);
      const ficha = (await req('GET', `/custos/paciente/${pacienteId}`, tkAud)).body;
      ok('G4 ficha do paciente traz a decomposição por insumo (auditor)',
        ficha.recursos && ficha.recursos.origem === 'insumo', ficha.recursos && ficha.recursos.origem);
      ok('G4 ficha usa a SUPERFÍCIE REAL do paciente (Mosteller), rotulada como tal',
        ficha.recursos && perto(ficha.recursos.premissas.sc_m2, Math.round(scReal * 100) / 100, 0.005)
        && ficha.recursos.premissas.origem_sc === 'paciente' && ficha.recursos.premissas.origem_peso === 'paciente',
        ficha.recursos ? `sc=${ficha.recursos.premissas.sc_m2} esperado ${(Math.round(scReal * 100) / 100)} origem=${ficha.recursos.premissas.origem_sc}` : '');
      const esperadoReal = cicloEsperadoPortao(regs.get(RID_M2), { sc: Math.round(scReal * 100) / 100, peso: 82.5, clearance: 100 });
      ok('G4 ficha: compra do ciclo com a SC real = recálculo do portão',
        ficha.recursos && perto(ficha.recursos.compra_min_ciclo, esperadoReal.compra_min)
        && perto(ficha.recursos.compra_max_ciclo, esperadoReal.compra_max),
        ficha.recursos ? `${ficha.recursos.compra_min_ciclo}/${ficha.recursos.compra_max_ciclo} esperado ${esperadoReal.compra_min}/${esperadoReal.compra_max}` : '');

      // Projeção: 6 meses, protocolo de 6 ciclos a cada 21 dias, recém-iniciado.
      const proj = (await req('GET', '/recursos/projecao?horizonte=6', tkAdm)).body;
      const linha = (proj.carteira || []).find(l => l.paciente_id === pacienteId);
      ok('G4 paciente de teste entra na projeção', !!linha,
        `no_calculo=${proj.pacientes_no_calculo} fora=${proj.pacientes_fora}`);
      if (linha) {
        // ciclos no horizonte = min(restantes, floor(horizonte_dias / periodicidade)).
        const cabem = Math.floor((6 * 30.4) / 21);
        const esperadoCiclos = Math.min(6, cabem);
        ok('G4 ciclos no horizonte = min(restantes, horizonte ÷ periodicidade)',
          linha.ciclos_no_horizonte === esperadoCiclos && linha.ciclos_esperados === 6 && linha.periodicidade_dias === 21,
          `${linha.ciclos_no_horizonte} esperado ${esperadoCiclos} (restantes=${linha.ciclos_restantes})`);
        const cicloReal = cicloEsperadoPortao(regs.get(RID_M2), CORPO_PADRAO);
        ok('G4 linha da carteira = ciclo × nº de ciclos (recálculo do portão)',
          perto(linha.compra_min, cicloReal.compra_min * linha.ciclos_no_horizonte)
          && perto(linha.faturamento, cicloReal.faturamento * linha.ciclos_no_horizonte),
          `${linha.compra_min}/${linha.faturamento} esperado ${cicloReal.compra_min * linha.ciclos_no_horizonte}/${cicloReal.faturamento * linha.ciclos_no_horizonte}`);
        ok('G4 margem da linha = faturamento − compra, exata',
          perto(linha.margem_min, linha.faturamento - linha.compra_max)
          && perto(linha.margem_max, linha.faturamento - linha.compra_min),
          `${linha.margem_min}/${linha.margem_max}`);
      }
      // A demanda de compra (frascos por insumo) tem de somar o mesmo que as linhas de
      // carteira de origem INSUMO — e só essas. Comparar com o total geral seria errado
      // sempre que a base tiver algum paciente no fallback por protocolo: ali há R$ sem
      // frasco nenhum, e o check acusaria uma divergência que não existe.
      const somaDemandaMin = (proj.demanda_compra || []).reduce((a, d) => a + Math.round(d.min * 100), 0);
      const somaLinhasInsumo = (proj.carteira || [])
        .filter(l => l.origem === 'insumo')
        .reduce((a, l) => a + Math.round(l.compra_min * 100), 0);
      ok('G4 demanda de compra por insumo = soma das linhas de origem insumo',
        somaDemandaMin === somaLinhasInsumo, `${somaDemandaMin / 100} vs ${somaLinhasInsumo / 100}`);
      // E o total geral é a soma de TODAS as linhas (insumo + fallback), sem nada solto.
      const somaTodas = (proj.carteira || []).reduce((a, l) => a + Math.round(l.compra_min * 100), 0);
      ok('G4 total de compra = soma de todas as linhas da carteira (nada somado por fora)',
        somaTodas === Math.round(proj.compra_min * 100), `${somaTodas / 100} vs ${proj.compra_min}`);
      ok('G4 quem fica de fora não entra como zero — sai listado com motivo',
        proj.pacientes_fora === (proj.fora || []).length && (proj.fora || []).every(x => !!(x.explicacao || x.motivo)),
        `fora=${proj.pacientes_fora}`);

      // ---- PSEUDONIMIZAÇÃO: teste AFIRMATIVO sobre a resposta inteira ----
      const projGes = await fetch(API + '/recursos/projecao?horizonte=6', { headers: { Authorization: 'Bearer ' + tkGes } });
      const bruto = await projGes.text();
      ok('G4 resposta do GESTOR não contém o NOME do paciente de teste (busca no JSON inteiro)',
        !bruto.includes(NOME_TESTE), bruto.includes(NOME_TESTE) ? 'nome ENCONTRADO na resposta' : 'ausente');
      const jg = JSON.parse(bruto);
      const lg = (jg.carteira || []).find(l => l.paciente_id === pacienteId);
      ok('G4 gestor recebe rótulo pseudonimizado no lugar do nome',
        jg.pseudonimizado === true && lg && lg.paciente === undefined && /^Paciente #\d+/.test(lg.rotulo || ''),
        lg ? `rotulo="${lg.rotulo}" paciente=${JSON.stringify(lg.paciente)}` : 'linha ausente');
      // O ADMIN, por contraste, recebe o nome: a pseudonimização é do PERFIL, não da rota.
      const la = (proj.carteira || []).find(l => l.paciente_id === pacienteId);
      ok('G4 admin recebe o nome (a pseudonimização é do perfil, não da rota)',
        proj.pseudonimizado === false && la && la.paciente === NOME_TESTE, la && la.paciente);
      // E o identificador do hospital também não vaza.
      ok('G4 resposta do gestor também não contém o identificador do hospital',
        !bruto.includes('PORTAO-RECURSOS'), 'identificador');

      // Horizonte inválido é recusado, não assumido.
      const hz = await req('GET', '/recursos/projecao?horizonte=7', tkGes);
      ok('G4 horizonte fora de 3/6/12 é recusado (400), não arredondado em silêncio', hz.status === 400, 'status=' + hz.status);
    }

    // ═══ FASE 5 — UI do GESTOR: abas, ausência de nome e export .xlsx ═══
    {
      const { ctx, page, errs } = await ctxLogin(browser, 'gestor', { acceptDownloads: true });
      await page.waitForSelector('.rec-tot', { timeout: 25000 });
      const abas = await page.$$eval('nav.tabs a', els => els.map(e => e.textContent.trim()));
      ok('G5 gestor vê a aba Recursos', abas.includes('Recursos'), JSON.stringify(abas));
      ok('G5 gestor NÃO vê Pacientes, Fluxograma, Revisão nem Autorizações',
        !abas.some(a => /Paciente|Fluxograma|Revis|Autoriza|Admin|Custo/i.test(a)), JSON.stringify(abas));
      // Entrando pela URL/go(): continua em Recursos, não cai numa tela vazia.
      await page.evaluate(() => go('lista'));
      await page.waitForTimeout(400);
      const h2 = await page.$$eval('h2', els => els.map(e => e.textContent.trim()));
      ok('G5 go("lista") no gestor cai em Recursos (não em tela de paciente)',
        h2.some(t => /Recursos/.test(t)) && !h2.some(t => /^Pacientes$/.test(t)), JSON.stringify(h2));

      await page.evaluate(() => setRecAba('carteira'));
      await page.waitForTimeout(400);
      const corpo = await page.evaluate(() => document.body.innerText);
      ok('G5 a TELA do gestor não imprime o nome do paciente em lugar nenhum',
        !corpo.includes(NOME_TESTE), corpo.includes(NOME_TESTE) ? 'nome na tela' : 'ausente');
      ok('G5 a tela do gestor mostra o rótulo pseudonimizado', /Paciente #\d+/.test(corpo), 'rótulo');
      ok('G5 a tela avisa que a carteira está pseudonimizada', /pseudonimizada/i.test(corpo), '');

      // Números da tela x export .xlsx.
      const naTela = await page.evaluate(() => ({
        compra_min: REC_PROJ.compra_min, compra_max: REC_PROJ.compra_max,
        faturamento: REC_PROJ.faturamento, faturamento_completo: REC_PROJ.faturamento_completo,
        margem_min: REC_PROJ.margem_min, margem_max: REC_PROJ.margem_max,
        demanda: REC_PROJ.demanda_compra, protocolos: REC_PROJ.faturamento_por_protocolo,
      }));
      const dl = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page.click('button:has-text("Exportar .xlsx")'),
      ]).then(a => a[0]);
      const arq = path.join(baixados, dl.suggestedFilename());
      await dl.saveAs(arq);
      const zip = lerZipStored(fs.readFileSync(arq));
      ok('G5 .xlsx abre como pacote OOXML válido (workbook + 2 planilhas)',
        !!zip['xl/workbook.xml'] && !!zip['xl/worksheets/sheet1.xml'] && !!zip['xl/worksheets/sheet2.xml'],
        Object.keys(zip).join(', '));
      ok('G5 .xlsx tem COMPRA e FATURAMENTO em abas separadas',
        /name="Compra"/.test(zip['xl/workbook.xml'] || '') && /name="Faturamento"/.test(zip['xl/workbook.xml'] || ''),
        (zip['xl/workbook.xml'] || '').slice(0, 200));
      const cCompra = celulasDaSheet(zip['xl/worksheets/sheet1.xml']);
      const cFat = celulasDaSheet(zip['xl/worksheets/sheet2.xml']);
      // Cada linha de demanda da tela tem de estar na aba Compra, com o mesmo nº de frascos.
      let demandaOk = true, detD = '';
      for (const d of naTela.demanda) {
        const i = cCompra.indexOf(d.farmaco);
        if (i < 0 || cCompra[i + 1] !== d.conteudo || cCompra[i + 2] !== d.frascos
            || !perto(cCompra[i + 3], d.min) || !perto(cCompra[i + 4], d.max)) {
          demandaOk = false;
          detD += `${d.farmaco}: xlsx=${JSON.stringify(cCompra.slice(i, i + 5))} tela=${JSON.stringify([d.farmaco, d.conteudo, d.frascos, d.min, d.max])}; `;
        }
      }
      ok('G5 aba Compra do .xlsx = demanda da tela, linha a linha (frascos e R$)', demandaOk, detD);
      const iTotal = cCompra.lastIndexOf('TOTAL');
      ok('G5 total da aba Compra = total da tela',
        iTotal > 0 && perto(cCompra[iTotal + 3], naTela.compra_min) && perto(cCompra[iTotal + 4], naTela.compra_max),
        `xlsx=${JSON.stringify(cCompra.slice(iTotal, iTotal + 5))} tela=${naTela.compra_min}/${naTela.compra_max}`);
      let protoOk = true, detP = '';
      for (const p of naTela.protocolos) {
        const i = cFat.indexOf(p.regimen_id);
        if (i < 0 || !perto(cFat[i + 4], p.compra_min) || !perto(cFat[i + 5], p.compra_max)) {
          protoOk = false; detP += `${p.regimen_id}: ${JSON.stringify(cFat.slice(i, i + 8))}; `;
        }
        // "sem dado" no .xlsx onde a tela não tem faturamento — nunca um zero.
        if (i >= 0 && !p.faturamento_completo && cFat[i + 6] !== 'sem dado') {
          protoOk = false; detP += `${p.regimen_id}: faturamento ausente virou ${JSON.stringify(cFat[i + 6])} no xlsx; `;
        }
      }
      ok('G5 aba Faturamento do .xlsx = protocolos da tela, e ausência sai "sem dado" (não zero)', protoOk, detP);
      ok('G5 .xlsx carrega as premissas do cálculo no cabeçalho',
        cCompra.some(c => typeof c === 'string' && /SC .* m²/.test(c)) && cCompra.includes('ESTIMATIVA'),
        cCompra.slice(0, 6).join(' | '));
      ok('G5 .xlsx do gestor não contém o nome do paciente',
        !JSON.stringify(zip).includes(NOME_TESTE), '');
      ok('G5 sem erro de console na tela do gestor', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

    // ═══ FASE 6 — UI do ADMIN: digitar preço não re-renderiza a lista ═══
    {
      const { ctx, page, errs } = await ctxLogin(browser, 'admin');
      await page.evaluate(() => go('insumos'));
      await page.waitForSelector('.rec-apf', { timeout: 25000 });
      // Conta re-renders da tela envolvendo render(): digitar num campo de dinheiro não
      // pode redesenhar a lista (perde foco, perde cursor, perde dígito).
      await page.evaluate(() => { window.__rc = 0; const o = window.render; window.render = function () { window.__rc++; return o.apply(this, arguments); }; });
      const inputs = await page.$$('.rec-apf input');
      ok('G6 formulário de apresentação presente na tela do admin', inputs.length > 0, 'inputs=' + inputs.length);
      // `focus()` + `type()`, nunca `click({clickCount:3})`: a tela de insumos tem dezenas
      // de formulários, e o clique triplo depende de rolar até o elemento e de ele ficar
      // parado — na segunda execução isso estourou 30s de timeout num campo que estava
      // visível e habilitado. O que este check precisa provar é a DIGITAÇÃO (tecla a
      // tecla, com os eventos de input reais), e para isso o foco basta.
      const digitar = async (seletor, texto, rotulo) => {
        const el = await page.$(seletor);
        if (!el) { ok(`G6 campo ${rotulo} presente`, false, seletor); return; }
        await el.scrollIntoViewIfNeeded();
        await el.fill('');                       // limpa sem clique
        await page.evaluate(() => { window.__rc = 0; });
        await el.focus();
        await el.type(texto, { delay: 12 });
        const rc = await page.evaluate(() => window.__rc);
        ok(`G6 digitar ${rotulo}: 0 re-render da lista`, rc === 0, 'renders=' + rc);
        ok(`G6 valor digitado em ${rotulo} sobrevive`, (await el.inputValue()) === texto, await el.inputValue());
      };
      if (inputs.length) {
        await digitar('.rec-apf input[placeholder="2400,00"]', '1234,56', 'PREÇO DE COMPRA');
        await digitar('.rec-apf input[placeholder^="Contrato Operadora"]', 'Contrato teste 2026', 'FONTE DO CONTRATO (texto livre)');
      }
      const corpo = await page.evaluate(() => document.body.innerText);
      ok('G6 tela de insumos avisa que faturamento ausente não vira margem zero',
        /nunca.*herda o preço de compra|margem zero/i.test(corpo), '');
      ok('G6 sem erro de console na tela do admin', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

    // ═══ FASE 7 — UI: as MEDIDAS do paciente sobrevivem a uma edição cadastral ═══
    // Este bloco existe por causa de um risco criado ao acrescentar peso e altura: a tela
    // de edição envia PATCH com o que ela conhece, e um campo que ela NÃO mostra vira
    // null no caminho. Sem os campos na tela de edição, "corrigir o nome" apagaria as
    // medidas do paciente em silêncio — e o custo dele voltaria ao paciente-padrão sem
    // ninguém pedir.
    if (pacienteId) {
      const { ctx, page, errs } = await ctxLogin(browser, 'admin');
      await page.waitForSelector('nav.tabs', { timeout: 25000 });
      await page.evaluate(async (pid) => { await carregarDetalhe(pid); }, pacienteId);
      await page.waitForTimeout(800);
      await page.evaluate((pid) => editarCadastro(pid), pacienteId);
      await page.waitForSelector('#f_peso', { timeout: 10000 });
      const pre = await page.evaluate(() => ({
        peso: document.querySelector('#f_peso').value,
        altura: document.querySelector('#f_altura').value,
      }));
      ok('G7 tela de EDIÇÃO cadastral mostra peso e altura já preenchidos',
        pre.peso === '82,5' && pre.altura === '178', JSON.stringify(pre));
      // Corrige só o NOME e salva: as medidas não podem sumir no caminho.
      await page.fill('#f_nome', NOME_TESTE + ' II');
      await page.click('button.btn.primary:has-text("Salvar correções")');
      await page.waitForTimeout(1500);
      const depois = (await req('GET', `/pacientes/${pacienteId}`, tkAdm)).body;
      ok('G7 corrigir o nome NÃO apaga peso e altura',
        Number(depois.peso_kg) === 82.5 && Number(depois.altura_cm) === 178,
        `peso=${depois.peso_kg} altura=${depois.altura_cm}`);
      ok('G7 a ficha continua calculando com a superfície REAL depois da edição',
        ((await req('GET', `/custos/paciente/${pacienteId}`, tkAud)).body.recursos || {}).premissas?.origem_sc === 'paciente', '');
      ok('G7 sem erro de console na edição cadastral', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

  } catch (e) {
    ok('portão executou sem exceção', false, e.message + ' | ' + String(e.stack || '').split('\n')[1]);
  } finally {
    // ---- limpeza: devolve o banco como encontrou ----
    // Duas metades, como no portão de custo: o que JÁ EXISTIA volta ao estado original, o
    // que o PORTÃO CRIOU é apagado. Sem isso cada rodada deixa insumo e preço de teste
    // para trás — e a segunda execução mede um banco diferente da primeira, que é
    // exatamente o que "rodar duas vezes seguidas" existe para pegar.
    try {
      if (!tkAdm) tkAdm = await tokenApi(API, 'admin');
      let apagados = 0, restaurados = 0;
      for (const [farmaco, a] of Object.entries(anteriores)) {
        if (a.insumoCriado) {
          const d = await req('DELETE', `/recursos/insumos/${a.insumoId}`, tkAdm);
          if (d.status === 200) apagados++;
          continue;
        }
        if (a.apresCriadaId) { await req('DELETE', `/recursos/apresentacoes/${a.apresCriadaId}`, tkAdm); apagados++; }
        if (a.padraoAnterior) {
          // Restaura a marcação de padrão que existia antes (o cadastro do portão a tirou).
          const ins = ((await req('GET', '/recursos/insumos', tkAdm)).body || []).find(i => i.id === a.insumoId);
          const ap = ins && (ins.apresentacoes || []).find(x => x.id === a.padraoAnterior);
          if (ap) {
            await req('PUT', `/recursos/apresentacoes/${ap.id}`, tkAdm, {
              insumo_id: ap.insumo_id, conteudo: ap.conteudo, conteudo_valor: Number(ap.conteudo_valor),
              conteudo_unidade: ap.conteudo_unidade, padrao: true,
              preco_compra_tabela: Number(ap.preco_compra_tabela), preco_compra_negociado: Number(ap.preco_compra_negociado),
              preco_faturamento: ap.preco_faturamento == null ? null : Number(ap.preco_faturamento),
              fonte_compra_tabela: ap.fonte_compra_tabela, fonte_compra_negociado: ap.fonte_compra_negociado,
              fonte_faturamento: ap.fonte_faturamento || null,
            });
            restaurados++;
          }
        }
      }
      if (precoFallbackAnterior) {
        await req('PUT', `/custos/${RID_FALLBACK}`, tkAdm, {
          custo_ciclo_tabela: Number(precoFallbackAnterior.custo_ciclo_tabela),
          custo_ciclo_negociado: Number(precoFallbackAnterior.custo_ciclo_negociado),
          fonte_tabela: precoFallbackAnterior.fonte_tabela, fonte_negociado: precoFallbackAnterior.fonte_negociado,
          periodo_dias: precoFallbackAnterior.periodo_dias == null ? null : Number(precoFallbackAnterior.periodo_dias),
        });
        restaurados++;
      } else if (criouPrecoFallback) {
        // A API não expõe remoção de preço (desenho: preço se corrige, não se apaga) —
        // mesmo caminho que o portão de custo usa.
        const { neon } = require(path.join(ROOT, 'backend/node_modules/@neondatabase/serverless'));
        const sql = neon(process.env.DATABASE_URL);
        await sql.query('DELETE FROM custos_regime WHERE regimen_id = $1', [RID_FALLBACK]);
        apagados++;
      }
      if (premAnterior) {
        await req('PUT', '/recursos/premissas', tkAdm, {
          sc_m2: Number(premAnterior.sc_m2), peso_kg: Number(premAnterior.peso_kg),
          clearance_ml_min: Number(premAnterior.clearance_ml_min),
        });
        restaurados++;
      }
      console.log(`  limpeza: apagados=${apagados} restaurados=${restaurados}`);
      if (pacienteId) {
        const del = await req('DELETE', `/pacientes/${pacienteId}`, tkAdm);
        console.log('  limpeza: paciente de teste removido (status ' + del.status + ')');
      }
      fs.rmSync(baixados, { recursive: true, force: true });
    } catch (e) { console.log('  limpeza falhou: ' + e.message); }
    await browser.close();
    const falhas = R.filter(r => !r[0]);
    console.log('\n' + '='.repeat(58));
    console.log(`${R.length - falhas.length}/${R.length} checks passaram`);
    if (falhas.length) { falhas.forEach(f => console.log('  FALHA: ' + f[1] + (f[2] ? '  [' + f[2] + ']' : ''))); process.exit(1); }
    console.log('PORTÃO DE RECURSOS: verde.');
    process.exit(0);
  }
})();
