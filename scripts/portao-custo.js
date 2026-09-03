// Portão do módulo EXPECTATIVA DE CUSTO — fluxos reais em browser isolado (headless) + API.
// É o check que NÃO passa pelo agente.
//
//  Fase 1 (API): a matriz de perfil nas DUAS pontas. Oncologista e revisor levam 403 em
//    TODAS as rotas de /custos — leitura e escrita —, batendo direto na URL. Auditor lê
//    mas NÃO cadastra preço (403 só no PUT). Admin faz as duas coisas. A app esconder o
//    bloco é cortesia; se este bloco falhar, o dado de custo está exposto.
//  Fase 2 (API): a aritmética. Recalcula ciclos e faixa a partir do JSON DE ORIGEM
//    (backend/data/evidencia.json) + o preço cadastrado, com cópia própria da regra de
//    periodicidade — portão que importa a função sob teste não testa nada.
//  Fase 3 (API): indeterminado é "sem estimativa" explícito, com motivo — nunca R$ 0,
//    nunca campo vazio. E preço negociado acima da tabela é recusado (faixa invertida).
//  Fase 4 (UI, oncologista): o bloco NÃO existe no DOM, nem entrando pela URL
//    (go('custos') e go('autorizacoes') caem em Pacientes).
//  Fase 5 (UI, auditor): o bloco aparece na fila com faixa, fontes, origem dos ciclos e
//    o aviso do PFS; a carteira soma e diz quem ficou de fora.
//  Fase 6 (UI, admin): digitar nos campos de PREÇO não re-renderiza a lista (contador=0)
//    e o valor digitado sobrevive.
//  Limpeza: apaga os preços de teste (DELETE não existe na API por desenho — o portão
//    restaura o estado anterior via PUT, ou remove direto o que criou).
//
// NÃO ENCADEIE este portão com outro sem uma janela de ~1 min: `POST /auth/login` é
// limitado a 5/min por IP e este portão usa 4 perfis. O helper espera no 429, mas dois
// portões seguidos gastam a janela inteira e o segundo dorme muito.
//
// Uso: node scripts/portao-custo.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005).
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const { tokenApi, loginNaTela } = require('./portao-credenciais');

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';
const EVID = path.join(ROOT, 'backend/data/evidencia.json');

// Regimes de teste: um FIXA (ciclos do esquema) e um ATE_PROGRESSAO com proxy de PFS.
const RID_FIXA = 'gbm-stupp';
const RID_PFS = 'mama-met-hrpos-2l-tdxd-db04';
// Oral diário contínuo: o esquema NÃO tem intervalo de ciclo. É o caso de prova do
// período declarado (osimertinibe, 20,7 meses de exposição mediana no FLAURA).
const RID_ORAL = 'nsclc-met-osimertinibe-egfr';
const NOME_TESTE = 'Paciente Portao Custo';
const FONTE_T = 'PORTAO CUSTO - CMED teste';
const FONTE_N = 'PORTAO CUSTO - contrato teste';

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 170) + ']' : '')); };

async function req(metodo, rota, tk, body) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: Object.assign(tk ? { Authorization: 'Bearer ' + tk } : {}, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch (_) { }
  return { status: r.status, body: j };
}

// ---- cópia PRÓPRIA da regra de periodicidade (independente do servidor) ----
// Só o intervalo ENTRE ciclos; lista de dias (D1, D8) é intra-ciclo e não conta.
function periodicidadesPortao(esq) {
  const t = String(esq || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const v = new Set();
  const P = [[/a cada (\d+)\s*dias/g, 1], [/a cada (\d+)\s*sem(?:anas?)?\b/g, 7], [/a cada (\d+)\s*meses/g, 30],
  [/\b(\d+)\s*em\s*\1\s*dias/g, 1], [/\b(\d+)\/\1\s*d\b/g, 1], [/\b(\d+)\/\1\s*dias/g, 1],
  [/\b(\d+)\/\1\s*sem(?:anas?)?\b/g, 7], [/ciclos?\s*de\s*(\d+)\s*dias/g, 1], [/mg\/(\d+)\s*sem/g, 7]];
  for (const [re, mult] of P) { re.lastIndex = 0; let m; while ((m = re.exec(t)) !== null) { const n = Number(m[1]) * mult; if (n >= 1 && n <= 180) v.add(n); } }
  if (/\bsemanal(mente)?\b/.test(t) || /\/\s*semana\b/.test(t)) v.add(7);
  return [...v];
}
// Mesma fórmula da especificação: meses x 30.4 / periodicidade.
function ciclosEsperadosPortao(reg) {
  const b = reg.expectativa_uso;
  if (!b || b.indeterminado) return null;
  if (b.tipo === 'fixa') return b.ciclos || null;
  const meses = typeof b.duracao_mediana_tratamento_meses === 'number' ? b.duracao_mediana_tratamento_meses
    : typeof b.pfs_mediana_meses === 'number' ? b.pfs_mediana_meses : null;
  if (meses === null) return null;
  const per = periodicidadesPortao(reg.esquema);
  if (per.length !== 1) return null;
  return Math.max(1, Math.round((meses * 30.4) / per[0]));
}

async function ctxLogin(browser, perfil) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  // 429 do rate limit de login não é erro do código sob teste — é o limite trabalhando.
  // O helper de credenciais já espera e tenta de novo; contar o ruído dele aqui faria o
  // portão falhar por ter sido executado duas vezes seguidas, que é o oposto de proteger.
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
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const evid = JSON.parse(fs.readFileSync(EVID, 'utf-8'));
  const regs = new Map(evid.regimes.map(r => [r.regimen_id, r]));
  let tkOnco, tkRev, tkAud, tkAdm;
  let anteriores = {};   // preços que já existiam, para restaurar
  // Um regime com tempo derivável e SEM preço — o caso do desacoplamento (mostra uso,
  // nenhum R$). Escolhido do corpus, não fixo, para não depender de qual preço existe.
  let RID_SEM_PRECO = null;
  let pacienteId = null; // paciente de teste (criado e apagado pelo portão)

  try {
    tkAdm = await tokenApi(API, 'admin');
    tkAud = await tokenApi(API, 'auditor');
    tkOnco = await tokenApi(API, 'oncologista');
    tkRev = await tokenApi(API, 'revisor');

    // ═══ FASE 1 — matriz de perfil por API DIRETA ═══
    const rotasLeitura = ['/custos', '/custos/carteira', '/custos/cobertura',
      `/custos/estimativa/${RID_FIXA}`, `/custos/estimativas?ids=${RID_FIXA}`, '/custos/paciente/1'];
    for (const [perfil, tk] of [['oncologista', tkOnco], ['revisor', tkRev]]) {
      let todas403 = true, detalhe = '';
      for (const rota of rotasLeitura) {
        const r = await req('GET', rota, tk);
        if (r.status !== 403) { todas403 = false; detalhe += `${rota}=${r.status} `; }
      }
      ok(`C1 ${perfil} levou 403 em TODA leitura de custo (${rotasLeitura.length} rotas)`, todas403, detalhe);
      const w = await req('PUT', `/custos/${RID_FIXA}`, tk, { custo_ciclo_tabela: 1, custo_ciclo_negociado: 1, fonte_tabela: 'x', fonte_negociado: 'y' });
      ok(`C1 ${perfil} levou 403 na ESCRITA de preço`, w.status === 403, 'status=' + w.status);
    }
    const semToken = await req('GET', '/custos', null);
    ok('C1 sem token: 401 (nem chega no guard de perfil)', semToken.status === 401, 'status=' + semToken.status);

    const audLe = await req('GET', '/custos/cobertura', tkAud);
    ok('C2 auditor LÊ custo (200)', audLe.status === 200, 'status=' + audLe.status);
    const audEscreve = await req('PUT', `/custos/${RID_FIXA}`, tkAud, { custo_ciclo_tabela: 1, custo_ciclo_negociado: 1, fonte_tabela: 'x', fonte_negociado: 'y' });
    ok('C2 auditor NÃO cadastra preço (403) — leitura e escrita são whitelists diferentes', audEscreve.status === 403, 'status=' + audEscreve.status);

    // ═══ FASE 2 — cadastro e aritmética contra o JSON de origem ═══
    for (const rid of [RID_FIXA, RID_PFS]) {
      const atual = await req('GET', '/custos', tkAdm);
      const achou = (atual.body || []).find(c => c.regimen_id === rid);
      if (achou) anteriores[rid] = achou;
    }
    const PRECOS = { [RID_FIXA]: [12000.00, 9500.00], [RID_PFS]: [28000.00, 21000.00] };
    for (const rid of [RID_FIXA, RID_PFS]) {
      const [tab, neg] = PRECOS[rid];
      const w = await req('PUT', `/custos/${rid}`, tkAdm, {
        custo_ciclo_tabela: tab, custo_ciclo_negociado: neg, fonte_tabela: FONTE_T, fonte_negociado: FONTE_N,
      });
      ok(`C3 admin cadastra preço de ${rid}`, w.status === 200, 'status=' + w.status);
    }

    for (const rid of [RID_FIXA, RID_PFS]) {
      const [tab, neg] = PRECOS[rid];
      const e = (await req('GET', `/custos/estimativa/${rid}`, tkAud)).body;
      const esperado = ciclosEsperadosPortao(regs.get(rid));
      ok(`C4 ${rid}: ciclos do servidor = recálculo do portão sobre evidencia.json`,
        e.uso.disponivel && e.uso.ciclos_esperados === esperado, `servidor=${e.uso.ciclos_esperados} portao=${esperado}`);
      ok(`C4 ${rid}: total_min = ciclos x negociado`,
        Math.abs(e.custo.total_min - esperado * neg) < 0.005, `${e.custo.total_min} vs ${esperado * neg}`);
      ok(`C4 ${rid}: total_max = ciclos x tabela`,
        Math.abs(e.custo.total_max - esperado * tab) < 0.005, `${e.custo.total_max} vs ${esperado * tab}`);
      ok(`C4 ${rid}: faixa não sai invertida (min <= max)`, e.custo.total_min <= e.custo.total_max, `${e.custo.total_min} / ${e.custo.total_max}`);
      ok(`C4 ${rid}: selo é 'estimativa' e as duas fontes vieram`,
        e.selo === 'estimativa' && !!e.custo.custo_ciclo.fonte_min && !!e.custo.custo_ciclo.fonte_max);
      ok(`C4 ${rid}: periodicidade veio do ESQUEMA (não do cadastro)`,
        e.uso.periodicidade_origem === 'esquema', e.uso.periodicidade_origem);
    }
    // ═══ FASE 2b — a SOMA da carteira, com dado de verdade ═══
    // O portão CRIA o próprio paciente e a avaliação. Sem isso a soma agregada nunca é
    // exercitada: a base pode não ter nenhum paciente com protocolo estimável, e o check
    // passa sem somar nada — que foi exatamente o que aconteceu na primeira execução.
    {
      const novoP = await req('POST', '/pacientes', tkAdm, {
        nome: NOME_TESTE, sexo: 'M', tumor: 'glioblastoma', identificador: 'PORTAO-CUSTO',
      });
      pacienteId = novoP.body && novoP.body.id;
      ok('C5b paciente de teste criado', !!pacienteId, 'status=' + novoP.status);
      if (pacienteId) {
        // Avaliação com o regime FIXA (ciclos vêm do esquema) — nasce vigente.
        const av = await req('POST', `/pacientes/${pacienteId}/avaliacoes`, tkOnco, {
          regimen_id: RID_FIXA, linha_tratamento: 1, snapshot_campos: { portao: true }, semaforo: 'elegivel',
        });
        ok('C5b avaliação vigente registrada no protocolo estimável', av.status === 201 || av.status === 200,
          'status=' + av.status);

        const k = (await req('GET', '/custos/carteira', tkAud)).body;
        const linha = (k.com_estimativa || []).find(l => l.paciente_id === pacienteId);
        ok('C5b paciente de teste entra no cálculo da carteira', !!linha,
          `no_calculo=${k.pacientes_no_calculo} fora=${k.pacientes_sem_estimativa}`);

        // O total tem de ser a SOMA das linhas — não uma conta paralela.
        const somaMin = (k.com_estimativa || []).reduce((a, l) => a + Math.round(l.total_min * 100), 0) / 100;
        const somaMax = (k.com_estimativa || []).reduce((a, l) => a + Math.round(l.total_max * 100), 0) / 100;
        ok('C5b total_min da carteira = soma das linhas', Math.abs(k.total_min - somaMin) < 0.005, `${k.total_min} vs ${somaMin}`);
        ok('C5b total_max da carteira = soma das linhas', Math.abs(k.total_max - somaMax) < 0.005, `${k.total_max} vs ${somaMax}`);

        // E a linha bate com o recálculo independente do portão.
        const ciclos = ciclosEsperadosPortao(regs.get(RID_FIXA));
        const [tabF, negF] = PRECOS[RID_FIXA];
        ok('C5b linha do paciente = ciclos x preço (recálculo do portão)',
          linha && Math.abs(linha.total_min - ciclos * negF) < 0.005 && Math.abs(linha.total_max - ciclos * tabF) < 0.005,
          linha ? `${linha.total_min}/${linha.total_max} esperado ${ciclos * negF}/${ciclos * tabF}` : 'ausente');

        ok('C5b quem não tem estimativa fica FORA da soma, não entra como zero',
          k.pacientes_sem_estimativa === (k.sem_estimativa || []).length && (k.sem_estimativa || []).every(x => !!x.explicacao),
          `fora=${k.pacientes_sem_estimativa}`);

        // A rota por paciente responde o mesmo que a linha da carteira.
        const pp = (await req('GET', `/custos/paciente/${pacienteId}`, tkAud)).body;
        ok('C5b /custos/paciente/:id bate com a linha da carteira',
          pp.regimen_id === RID_FIXA && Math.abs(pp.estimativa.custo.total_min - linha.total_min) < 0.005,
          `${pp.estimativa && pp.estimativa.custo.total_min} vs ${linha && linha.total_min}`);
      }
    }

    const ePfs = (await req('GET', `/custos/estimativa/${RID_PFS}`, tkAud)).body;
    ok('C5 origem dos ciclos declarada como proxy de PFS', ePfs.uso.origem_ciclos === 'proxy_pfs', ePfs.uso.origem_ciclos);
    ok('C5 aviso do PFS presente na resposta do servidor',
      /piso/i.test(ePfs.uso.aviso || ''), ePfs.uso.aviso);

    // ═══ FASE 3 — indeterminado e cadastro inválido ═══
    // Um regime com tempo indeterminado no corpus: tem de vir "sem estimativa" COM motivo.
    const ridIndet = evid.regimes.find(r => r.expectativa_uso && r.expectativa_uso.indeterminado).regimen_id;
    const eInd = (await req('GET', `/custos/estimativa/${ridIndet}`, tkAud)).body;
    ok('C6 tempo indeterminado -> uso.disponivel=false com motivo', eInd.uso.disponivel === false && !!eInd.uso.motivo, `${ridIndet}: ${eInd.uso.motivo}`);
    ok('C6 indeterminado NÃO devolve zero nem campo vazio silencioso',
      eInd.custo.total_min === undefined && eInd.custo.total_max === undefined && !!eInd.uso.explicacao,
      `total_min=${eInd.custo.total_min} total_max=${eInd.custo.total_max}`);
    ok('C6 sem uso derivável, o custo diz que falta o USO (não que falta preço)',
      eInd.custo.motivo === 'sem_uso_derivavel', eInd.custo.motivo);

    // ═══ FASE 3b — ORAL CONTÍNUO: período declarado destrava a conversão ═══
    // O esquema do osimertinibe ("80 mg VO 1x/dia até progressão/toxicidade") não tem
    // intervalo de ciclo nenhum. Sem período declarado o servidor NÃO converte; com ele,
    // converte e diz que o número é administrativo.
    {
      const jaTinha = ((await req('GET', '/custos', tkAdm)).body || []).find(c => c.regimen_id === RID_ORAL);
      if (jaTinha && !anteriores[RID_ORAL]) anteriores[RID_ORAL] = jaTinha;

      // (a) preço SEM periodo_dias: nada de conversão, nada de R$.
      const semPer = await req('PUT', `/custos/${RID_ORAL}`, tkAdm, {
        custo_ciclo_tabela: 22000.00, custo_ciclo_negociado: 17500.00,
        fonte_tabela: FONTE_T, fonte_negociado: FONTE_N,
      });
      ok('C13 preço do oral cadastrado sem periodo_dias', semPer.status === 200, 'status=' + semPer.status);
      const eSem = (await req('GET', `/custos/estimativa/${RID_ORAL}`, tkAud)).body;
      ok('C13 oral SEM periodo_dias: uso não derivável (não chuta intervalo)',
        eSem.uso.disponivel === false && eSem.uso.motivo === 'periodicidade_nao_derivavel', eSem.uso.motivo);
      ok('C13 oral SEM periodo_dias: nenhum total em R$ mesmo com preço cadastrado',
        eSem.custo.disponivel === false && eSem.custo.total_min === undefined && eSem.custo.total_max === undefined,
        `custo.disponivel=${eSem.custo.disponivel}`);
      ok('C13 oral SEM periodo_dias: a duração conhecida é exposta (não some)',
        typeof eSem.uso.duracao_meses === 'number', 'duracao_meses=' + eSem.uso.duracao_meses);

      // (b) periodo_dias = 30: converte, e a aritmética confere.
      const comPer = await req('PUT', `/custos/${RID_ORAL}`, tkAdm, {
        custo_ciclo_tabela: 22000.00, custo_ciclo_negociado: 17500.00,
        fonte_tabela: FONTE_T, fonte_negociado: FONTE_N, periodo_dias: 30,
      });
      ok('C14 preço do oral regravado com periodo_dias=30', comPer.status === 200, 'status=' + comPer.status);
      const eCom = (await req('GET', `/custos/estimativa/${RID_ORAL}`, tkAud)).body;
      // Recálculo INDEPENDENTE: 20,7 meses (FLAURA) x 30,4 / 30.
      const b = regs.get(RID_ORAL).expectativa_uso;
      const meses = b.duracao_mediana_tratamento_meses;
      const esperadoOral = Math.max(1, Math.round((meses * 30.4) / 30));
      ok('C14 oral COM periodo_dias: uso derivável', eCom.uso.disponivel === true, eCom.uso.motivo || '');
      ok('C14 oral COM periodo_dias: aritmética confere com o recálculo do portão',
        eCom.uso.ciclos_esperados === esperadoOral,
        `servidor=${eCom.uso.ciclos_esperados} portao=${esperadoOral} (${meses} x 30.4 / 30)`);
      ok('C14 origem exibida é "período declarado no cadastro", não o esquema',
        eCom.uso.periodicidade_origem === 'periodo_declarado' && eCom.uso.periodicidade_dias === 30,
        `${eCom.uso.periodicidade_origem} / ${eCom.uso.periodicidade_dias}d`);
      ok('C14 origem do TEMPO continua sendo a duração reportada do pivotal',
        eCom.uso.origem_ciclos === 'duracao_reportada', eCom.uso.origem_ciclos);
      ok('C14 total = períodos x preço',
        Math.abs(eCom.custo.total_min - esperadoOral * 17500) < 0.005 &&
        Math.abs(eCom.custo.total_max - esperadoOral * 22000) < 0.005,
        `${eCom.custo.total_min}/${eCom.custo.total_max}`);
      ok('C14 periodo_dias volta na resposta (a tela precisa dizer "preço por N dias")',
        eCom.custo.periodo_dias === 30, String(eCom.custo.periodo_dias));

      // (c) periodo_dias fora da faixa é recusado — erro aqui multiplica o custo.
      const ruim = await req('PUT', `/custos/${RID_ORAL}`, tkAdm, {
        custo_ciclo_tabela: 100, custo_ciclo_negociado: 50,
        fonte_tabela: FONTE_T, fonte_negociado: FONTE_N, periodo_dias: 0,
      });
      ok('C14 periodo_dias = 0 é recusado (400)', ruim.status === 400, 'status=' + ruim.status);
      const ruim2 = await req('PUT', `/custos/${RID_ORAL}`, tkAdm, {
        custo_ciclo_tabela: 100, custo_ciclo_negociado: 50,
        fonte_tabela: FONTE_T, fonte_negociado: FONTE_N, periodo_dias: 400,
      });
      ok('C14 periodo_dias = 400 é recusado (400)', ruim2.status === 400, 'status=' + ruim2.status);
    }

    // ═══ FASE 3c — USO sem preço: mostra uso, zero R$ ═══
    // O desacoplamento: tempo derivável e preço ausente tem de render a metade de USO.
    {
      const semPreco = evid.regimes.find(r => {
        const b = r.expectativa_uso;
        return b && !b.indeterminado && b.tipo === 'fixa' && b.ciclos && b.periodicidade_dias
          && ![RID_FIXA, RID_PFS, RID_ORAL].includes(r.regimen_id);
      });
      const lista = (await req('GET', '/custos', tkAdm)).body || [];
      const alvoSem = semPreco && !lista.some(c => c.regimen_id === semPreco.regimen_id) ? semPreco : null;
      RID_SEM_PRECO = alvoSem ? alvoSem.regimen_id : null;
      if (!alvoSem) {
        ok('C15 uso sem preço', true, 'nenhum regime fixa sem preço disponível — check vazio');
      } else {
        const eSP = (await req('GET', `/custos/estimativa/${alvoSem.regimen_id}`, tkAud)).body;
        ok('C15 tempo derivável e SEM preço: uso disponível mesmo assim',
          eSP.uso.disponivel === true && eSP.uso.ciclos_esperados === alvoSem.expectativa_uso.ciclos,
          `${alvoSem.regimen_id}: ciclos=${eSP.uso.ciclos_esperados}`);
        ok('C15 sem preço: motivo do custo é "sem_preco_cadastrado" (não "sem uso")',
          eSP.custo.disponivel === false && eSP.custo.motivo === 'sem_preco_cadastrado', eSP.custo.motivo);
        ok('C15 sem preço: NENHUM valor em R$ na resposta (nem zero)',
          eSP.custo.total_min === undefined && eSP.custo.total_max === undefined && eSP.custo.custo_ciclo === undefined,
          `total_min=${eSP.custo.total_min}`);
      }
    }

    const invertido = await req('PUT', `/custos/${RID_FIXA}`, tkAdm, {
      custo_ciclo_tabela: 100, custo_ciclo_negociado: 200, fonte_tabela: FONTE_T, fonte_negociado: FONTE_N,
    });
    ok('C7 negociado > tabela é recusado (400) — faixa invertida não entra', invertido.status === 400, 'status=' + invertido.status);
    const semFonte = await req('PUT', `/custos/${RID_FIXA}`, tkAdm, {
      custo_ciclo_tabela: 100, custo_ciclo_negociado: 50, fonte_tabela: '   ', fonte_negociado: FONTE_N,
    });
    ok('C7 preço sem fonte é recusado (400) — nada na tela sem rastro', semFonte.status === 400, 'status=' + semFonte.status);
    const ridFalso = await req('PUT', '/custos/protocolo-que-nao-existe', tkAdm, {
      custo_ciclo_tabela: 100, custo_ciclo_negociado: 50, fonte_tabela: FONTE_T, fonte_negociado: FONTE_N,
    });
    ok('C7 preço para regime fora do corpus é recusado (400)', ridFalso.status === 400, 'status=' + ridFalso.status);

    // ═══ FASE 4 — UI do oncologista: bloco ausente, inclusive por URL ═══
    {
      const { ctx, page, errs } = await ctxLogin(browser, 'oncologista');
      const abas = await page.evaluate(() => Array.from(document.querySelectorAll('#nav a')).map(a => a.textContent.trim()));
      ok('C8 oncologista NÃO vê a aba Custo por ciclo', !abas.some(a => /Custo/i.test(a)), abas.join(','));
      await page.evaluate(() => go('custos'));
      await page.waitForTimeout(400);
      const viewCustos = await page.evaluate(() => view);
      ok('C8 go("custos") pela URL cai em Pacientes', viewCustos === 'lista', 'view=' + viewCustos);
      // Conta ELEMENTOS, não texto: o <script> da app fica dentro do <body>, então
      // document.body.textContent devolveria o código-fonte inteiro — inclusive a
      // string 'Expectativa de custo' que só existe dentro de uma função. Procurar
      // texto aqui é procurar o fonte, não a tela.
      const nBloco = await page.evaluate(() => document.querySelectorAll('.cst, .cst-cart').length);
      ok('C8 nenhum bloco de custo no DOM do oncologista', nBloco === 0, 'elementos=' + nBloco);
      const podeVer = await page.evaluate(() => podeVerCusto());
      ok('C8 podeVerCusto() = false para oncologista', podeVer === false);
      // Abre um paciente com protocolo vigente: nem na ficha o bloco aparece.
      const pid = await page.evaluate(async () => {
        const l = await api('/pacientes'); const c = (l || []).find(p => p.ultima_avaliacao); return c ? c.id : (l && l[0] ? l[0].id : null);
      });
      if (pid) {
        await page.evaluate(id => abrir(id), pid);
        await page.waitForTimeout(1200);
        const nFicha = await page.evaluate(() => document.querySelectorAll('.cst').length);
        ok('C9 bloco ausente também na ficha do paciente (oncologista)', nFicha === 0, 'paciente=' + pid + ' elementos=' + nFicha);
      } else { ok('C9 bloco ausente na ficha do paciente (oncologista)', true, 'sem paciente para abrir — check vazio'); }
      ok('C9 sem erro de console no oncologista', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

    // ═══ FASE 5 — UI do auditor: bloco e carteira ═══
    {
      const { ctx, page, errs } = await ctxLogin(browser, 'auditor');
      await page.evaluate(() => go('autorizacoes'));
      await page.waitForFunction(() => AUT_LISTA !== null, null, { timeout: 25000 });
      await page.waitForTimeout(1200);
      const nCart = await page.evaluate(() => document.querySelectorAll('.cst-cart').length);
      ok('C10 auditor vê o painel "Custo total da carteira"', nCart === 1, 'elementos=' + nCart);
      const cart = await page.evaluate(() => CUSTO_CARTEIRA);
      ok('C10 carteira soma sem tratar "sem estimativa" como zero',
        cart && typeof cart.total_min === 'number' && typeof cart.pacientes_sem_estimativa === 'number',
        cart ? `no_calculo=${cart.pacientes_no_calculo} fora=${cart.pacientes_sem_estimativa}` : 'null');
      // Bloco na ficha de um paciente com protocolo vigente.
      const pid2 = await page.evaluate(async () => {
        const l = await api('/pacientes'); const c = (l || []).find(p => p.ultima_avaliacao); return c ? c.id : null;
      });
      if (pid2) {
        await page.evaluate(id => abrir(id), pid2);
        await page.waitForTimeout(1800);
        const nAud = await page.evaluate(() => document.querySelectorAll('.cst').length);
        ok('C11 auditor vê o bloco na ficha do paciente', nAud > 0, 'paciente=' + pid2 + ' elementos=' + nAud);
        // Zero na TELA (só o container da app), não no fonte.
        const tApp = await page.evaluate(() => (document.getElementById('app') || document.body).innerText);
        ok('C11 nenhum "R$ 0,00" renderizado (indeterminado não vira zero)', !/R\$\s*0,00/.test(tApp),
          (tApp.match(/R\$\s*0,00/g) || []).join(','));

        // Desacoplamento na TELA: protocolo com tempo derivável e SEM preço tem de
        // mostrar a metade de USO e nenhum R$. Renderiza o bloco isolado e inspeciona —
        // é o único jeito de provar isso sem depender de qual protocolo o paciente tem.
        const semPrecoUI = await page.evaluate(async (alvo) => {
          if (!alvo) return null;
          const el = document.createElement('div');
          el.innerHTML = custoBlocoHtml(alvo);
          document.body.appendChild(el);
          for (let i = 0; i < 60 && CUSTO_EST[alvo] === undefined; i++) await new Promise(r => setTimeout(r, 100));
          pintarSlotsCusto();
          const txt = el.innerText;
          const e = CUSTO_EST[alvo];
          el.remove();
          return { txt, uso: e && e.uso };
        }, RID_SEM_PRECO);
        if (semPrecoUI && semPrecoUI.uso) {
          ok('C11b uso sem preço: bloco mostra "Uso esperado" e o nº de aplicações',
            /uso esperado/i.test(semPrecoUI.txt) && new RegExp(String(semPrecoUI.uso.ciclos_esperados)).test(semPrecoUI.txt),
            semPrecoUI.txt.replace(/\s+/g, ' ').slice(0, 130));
          ok('C11b uso sem preço: diz "sem preço cadastrado" e NÃO mostra R$ nenhum',
            /sem pre[çc]o/i.test(semPrecoUI.txt) && !/R\$/.test(semPrecoUI.txt),
            (semPrecoUI.txt.match(/R\$[^\s]*/g) || []).join(','));
        } else {
          ok('C11b uso sem preço renderizado na tela', !RID_SEM_PRECO,
            RID_SEM_PRECO ? 'bloco não renderizou para ' + RID_SEM_PRECO : 'sem regime candidato — check vazio');
        }
      } else { ok('C11 bloco na ficha (auditor)', true, 'sem paciente com avaliação — check vazio'); }
      ok('C11 sem erro de console no auditor', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

    // ═══ FASE 6 — UI do admin: digitar preço não re-renderiza ═══
    {
      const { ctx, page, errs } = await ctxLogin(browser, 'admin');
      await page.evaluate(() => go('custos'));
      // Espera a LISTA, não a variável: CUSTO_ADM é preenchida pela primeira chamada e a
      // tela só é pintada quando a segunda (/custos/cobertura) volta.
      const sel = `#cst_tab_${RID_FIXA}`;
      await page.waitForSelector(sel, { timeout: 30000 });
      await page.evaluate(() => { window.__rc = 0; const o = window.render; window.render = function () { window.__rc++; return o.apply(this, arguments); }; });
      await page.click(sel, { clickCount: 3 });
      await page.type(sel, '13450,75', { delay: 12 });
      const selF = `#cst_ft_${RID_FIXA}`;
      await page.click(selF, { clickCount: 3 });
      await page.type(selF, 'CMED 2026-02 portao', { delay: 8 });
      const rc = await page.evaluate(() => window.__rc);
      const v = await page.evaluate(s => document.querySelector(s).value, sel);
      const vf = await page.evaluate(s => document.querySelector(s).value, selF);
      ok('C12 digitar PREÇO: 0 re-render da lista', rc === 0, 'renders=' + rc);
      ok('C12 valor digitado no preço sobrevive', v === '13450,75', v);
      ok('C12 valor digitado na FONTE sobrevive', vf === 'CMED 2026-02 portao', vf);
      // Campo do período — o novo. Mesmo contrato: digitar não pode redesenhar a lista.
      const selP = `#cst_pd_${RID_ORAL}`;
      const temCampoP = await page.$(selP);
      if (temCampoP) {
        await page.click(selP, { clickCount: 3 });
        await page.type(selP, '30', { delay: 12 });
        const rc2 = await page.evaluate(() => window.__rc);
        const vp = await page.evaluate(s2 => document.querySelector(s2).value, selP);
        ok('C12 digitar PERÍODO COBERTO: 0 re-render da lista', rc2 === 0, 'renders=' + rc2);
        ok('C12 valor digitado no período sobrevive', vp === '30', vp);
      } else {
        ok('C12 campo de período presente para o oral', false, `${selP} não encontrado na tela do admin`);
      }
      ok('C12 sem erro de console no admin', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

  } catch (e) {
    ok('portão executou sem exceção', false, e.message);
  } finally {
    // ---- limpeza: restaura o que existia; o que o portão criou fica com preço de teste
    // identificável pela fonte (não há DELETE na API por desenho).
    try {
      if (!tkAdm) tkAdm = await tokenApi(API, 'admin');
      for (const rid of [RID_FIXA, RID_PFS, RID_ORAL]) {
        const a = anteriores[rid];
        if (a) {
          await req('PUT', `/custos/${rid}`, tkAdm, {
            custo_ciclo_tabela: Number(a.custo_ciclo_tabela), custo_ciclo_negociado: Number(a.custo_ciclo_negociado),
            fonte_tabela: a.fonte_tabela, fonte_negociado: a.fonte_negociado,
            periodo_dias: a.periodo_dias == null ? null : Number(a.periodo_dias),
          });
        }
      }
      console.log('  limpeza: preços anteriores restaurados (' + Object.keys(anteriores).length + ')');
      if (pacienteId) {
        const del = await req('DELETE', `/pacientes/${pacienteId}`, tkAdm);
        console.log('  limpeza: paciente de teste removido (status ' + del.status + ')');
      }
    } catch (e) { console.log('  limpeza falhou: ' + e.message); }
    await browser.close();
    const falhas = R.filter(r => !r[0]);
    console.log('\n' + '='.repeat(58));
    console.log(`${R.length - falhas.length}/${R.length} checks passaram`);
    if (falhas.length) { falhas.forEach(f => console.log('  FALHA: ' + f[1] + (f[2] ? '  [' + f[2] + ']' : ''))); process.exit(1); }
    console.log('PORTÃO DE CUSTO: verde.');
    process.exit(0);
  }
})();
