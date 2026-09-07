// Portão do SIMULADOR — leitura pura do corpus, agora também para o oncologista.
// Fluxos reais em browser isolado (headless) + API. É o check que NÃO passa pelo agente.
//
//  Fase 1 (UI, oncologista): a aba Simulador EXISTE, abre, simula de verdade (escolher
//    tumor → mudar característica → protocolos recalculam ao vivo) — e o oncologista
//    continua SEM Revisão clínica, Autorizações, Recursos e Admin, inclusive forçando a
//    view por código (guard de tela).
//  Fase 2 (UI): a INVARIANTE de somente-leitura, provada por rede, não por leitura de
//    código: nenhum POST/PUT/PATCH/DELETE sai do browser enquanto o Simulador está
//    aberto, e o botão "Selecionar protocolo" não existe na tela.
//  Fase 3 (UI): a tela do Simulador não diz "R$" nem "ESTIMATIVA" — para oncologista E
//    admin, porque a asserção é sobre a TELA, não sobre o perfil.
//  Fase 4 (API): as DUAS pontas. As rotas que alimentam o Simulador respondem 200 para o
//    oncologista; as que ele não pode ver continuam 403 (Revisão, Autorizações, custo,
//    recursos, usuários). Esconder a aba é cortesia; o controle é o guard.
//  Fase 5 (UI, contraprova): revisor e admin continuam vendo o Simulador, e o GESTOR não
//    o vê — se ele visse, a aba teria virado "qualquer autenticado", que é exatamente a
//    regressão que este portão existe para pegar.
//
// Não cria nem apaga nada: o Simulador não grava, então não há o que limpar. Se este
// portão precisar de limpeza algum dia, a invariante quebrou.
//
// NÃO ENCADEIE com outro portão sem uma janela de ~1 min: `POST /auth/login` é limitado a
// 5/min por IP. Este portão faz 4 logins (oncologista, admin, revisor, gestor na tela) e
// 1 por API — ver o backoff em portao-credenciais.js.
//
// Uso: node scripts/portao-simulador.js   (exige app e API no ar; portas por
// PORTAO_APP/PORTAO_API, default 5173/3005).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const { tokenApi, loginNaTela } = require('./portao-credenciais');
const { exigirBancoDeDev } = require('./portao-banco');

const APP = process.env.PORTAO_APP || 'http://localhost:5173/index.html';
const API = process.env.PORTAO_API || 'http://localhost:3005/api';

// Tumor com elegibilidade computável no corpus (campos_primitivos + regra). 'mama' é o
// mais denso (60 regimes) e é o mesmo que os outros portões usam.
const TUMOR = 'mama';

const R = [];
const ok = (n, c, x) => { R.push([c, n, x]); console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  [' + String(x).slice(0, 160) + ']' : '')); };

async function req(metodo, rota, tk, body) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: Object.assign(tk ? { Authorization: 'Bearer ' + tk } : {}, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status };
}

// Contexto isolado que GRAVA TODA ESCRITA que sair do browser em direção à API.
// Esta lista é a invariante da Fase 2: ela tem de terminar vazia. Ler o código e não
// achar `api(...)` no bloco do Simulador prova o hoje; a rede prova o que rodou.
async function ctxLogin(browser, perfil) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  const escritas = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
  page.on('request', r => {
    const m = r.method();
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') escritas.push(m + ' ' + r.url());
  });
  page.on('dialog', d => d.accept());
  await page.addInitScript(a => { window.ONCOGUIA_API_BASE = a; }, API);
  await page.goto(APP);
  await loginNaTela(page, perfil);
  await page.waitForFunction(() => !!localStorage.getItem('oncoguia_token'), null, { timeout: 25000 });
  await page.waitForSelector('#nav a', { timeout: 25000 });
  const tk = await page.evaluate(() => localStorage.getItem('oncoguia_token'));
  // O próprio login é um POST /auth/login, e acontece ANTES de o Simulador existir.
  // A invariante que interessa é "a SIMULAÇÃO não grava", então a janela de observação
  // começa aqui — com a sessão já estabelecida. Zerar (e não filtrar por rota) mantém a
  // asserção cega ao endereço: qualquer escrita nova, para qualquer lugar, aparece.
  escritas.length = 0;
  return { ctx, page, errs, escritas, tk };
}

const abasDe = page => page.evaluate(() => Array.from(document.querySelectorAll('#nav a')).map(a => a.textContent.trim()));

// Abre o Simulador e escolhe o tumor pelo MESMO caminho do usuário (as funções que os
// cliques chamam), não por atribuição direta a SIM — assim o guard de tela é exercitado.
async function abrirSimulador(page, tumor) {
  await page.evaluate(() => go('simulador'));
  await page.waitForSelector('.sys-nav', { timeout: 15000 });
  await page.evaluate(t => {
    const g = agruparTumores(TUMORES).find(g => g.items.some(i => i.id === t));
    toggleSysSim(g.id); setSimTumor(t);
  }, tumor);
  await page.waitForSelector('#sim-protos-live .proto', { timeout: 15000 });
}

// Texto lido de #app, nunca de document.body: o <script> da app mora dentro do <body>,
// então body.textContent devolveria o CÓDIGO-FONTE — que tem "ESTIMATIVA" em comentário.
// (Lição herdada dos checks D1 de portao-autorizacao.js.)
// Uma nota sobre o CASE, que é a diferença entre um check e um falso positivo:
// procura-se "ESTIMATIVA" em CAIXA ALTA — o banner da camada de dinheiro ("Custo total da
// carteira — ESTIMATIVA"), mesma convenção dos checks D1 de portao-autorizacao.js. O
// corpus tem a palavra em MINÚSCULA num sentido que não é dinheiro: a procedência do eixo
// NCCN Affordability vem como "... / estimativa qualitativa" em
// `verificacao.nccn_affordability.fonte`, isto é, "este valor foi estimado
// qualitativamente, sem fonte direta". Isso é procedência de EVIDÊNCIA e aparece no
// apêndice — inclusive na tela do paciente, muito antes desta mudança. Casar minúscula
// aqui reprovaria o corpus, não a tela.
async function telaSemDinheiro(page, perfil) {
  // O apêndice e as referências são <details> fechados: innerText não lê o que está
  // recolhido, e um bloco de custo escondido lá dentro passaria. Abre tudo antes de ler.
  await page.evaluate(() => document.querySelectorAll('#app details').forEach(d => { d.open = true; }));
  const t = await page.evaluate(() => (document.getElementById('app') || document.body).innerText);
  ok(`S6 ★ Simulador NÃO diz "R$" (${perfil})`, !/R\$/.test(t),
    (t.match(/.{0,45}R\$.{0,45}/) || [''])[0]);
  ok(`S6 ★ Simulador NÃO diz "ESTIMATIVA" (${perfil})`, !/ESTIMATIVA/.test(t),
    (t.match(/.{0,45}ESTIMATIVA.{0,45}/) || [''])[0]);
  // Nenhuma cifra em outra redação: o banner pode mudar de palavra sem mudar de natureza.
  //
  // A LINHA que este check persegue não é "a palavra dinheiro apareceu" — é "a camada de
  // dinheiro do HOSPITAL (aba Recursos / /custos) foi fiada aqui". Ela renderiza por
  // fmtBRL(), que sempre produz "R$"; por isso "R$" + as classes no DOM são as sentinelas
  // fortes, e a lista abaixo é reforço.
  //
  // Três exclusões DELIBERADAS, porque check que dispara em vocabulário de oncologia é
  // check que se aprende a ignorar — e, pior, que convida a apagar EVIDÊNCIA para ficar
  // verde:
  //   · "custo" sozinho — o card traz "Custo N/5", o eixo NCCN Affordability do CORPUS
  //     (acessibilidade da evidência, escala 1–5). Já está na tela do paciente. Aqui
  //     procura-se "custo por ciclo", que é vocabulário da aba Recursos.
  //   · "margem" — "margem cirúrgica" é termo clínico legítimo. Margem FINANCEIRA só
  //     existe em Recursos, guardada pelo GestorOuAdminGuard.
  //   · "preço" — a JUSTIFICATIVA do eixo NCCN Affordability cita economia da literatura
  //     quando é isso que explica a não incorporação. Ex. real no corpus
  //     (mama-met-hrpos-2l-capivasertibe-nao-incorporado): "a justificativa do protocolo é
  //     explicitamente econômica — 'ao preço atual, a adição de capivasertibe ao
  //     fulvestranto não é custo-efetiva como 2ª linha'". Isso é a razão de o protocolo
  //     estar em "Avaliados — não incorporados", exatamente o que aquela seção existe para
  //     mostrar. Reprovar aqui pediria para apagar a transparência.
  //     (E sem \b, `pre[çc]o` ainda casaria "progressão precoce" — clínica pura.)
  ok(`S6 ★ Simulador NÃO diz "custo por ciclo"/"reais"/"faturamento" (${perfil})`,
    !/custo por ciclo|custo\/ciclo|\breais\b|faturamento/i.test(t),
    (t.match(/.{0,45}(custo por ciclo|custo\/ciclo|\breais\b|faturamento).{0,45}/i) || [''])[0]);
  // DOM, não só texto: um bloco em "⏳ calculando…" não tem R$ e passaria no teste de
  // texto — mas seria o bloco de dinheiro de volta.
  ok(`S6 ★ nenhum bloco de custo/carteira no DOM do Simulador (${perfil})`,
    await page.evaluate(() => document.querySelectorAll('#app .cst, #app .cst-cart, #app .cst-slot, #app [data-cst-rid]').length) === 0, '');
}

(async () => {
  // Primeira linha: sobre QUE BANCO este resultado vale. Aborta se não for o de dev.
  exigirBancoDeDev('Simulador de elegibilidade');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  try {
    // ═══ FASE 1 — o oncologista vê, abre e usa o Simulador ═══
    const f1 = await ctxLogin(browser, 'oncologista');
    const page = f1.page;

    const abas = await abasDe(page);
    ok('S1 ★ oncologista VÊ a aba Simulador', abas.some(a => /Simulador/.test(a)), abas.join(','));
    // Contraprova de presença: o resto da matriz dele não mudou junto. Se a aba nova
    // tivesse vindo de um afrouxamento geral, estes quatro cairiam no mesmo commit.
    ok('S2 oncologista segue SEM a aba Revisão clínica', !abas.some(a => /Revis/.test(a)), abas.join(','));
    ok('S2 oncologista segue SEM a aba Autorizações', !abas.some(a => /Autoriza/.test(a)), abas.join(','));
    ok('S2 oncologista segue SEM a aba Recursos', !abas.some(a => /Recursos/.test(a)), abas.join(','));
    ok('S2 oncologista segue SEM a aba Admin', !abas.some(a => /Admin/.test(a)), abas.join(','));

    // Guard de tela: entrar por código nas views que não são dele continua caindo em lista.
    for (const v of ['revclin', 'autorizacoes', 'recursos', 'admin']) {
      const caiu = await page.evaluate(x => { view = x; render(); return view; }, v);
      ok(`S2 forçar view=${v} cai em lista (guard de tela)`, caiu === 'lista', 'view=' + caiu);
    }

    // O Simulador abre de verdade e simula: tumor escolhido → cards; característica
    // mudada → cards recalculados. Sem isso, "a aba aparece" seria uma aba vazia verde.
    await abrirSimulador(page, TUMOR);
    ok('S3 ★ oncologista ABRE o Simulador (view=simulador)',
      await page.evaluate(() => view) === 'simulador');
    const nCards = await page.evaluate(() => document.querySelectorAll('#sim-protos-live .proto').length);
    ok('S3 ★ Simulador renderiza protocolos do corpus', nCards > 0, 'cards=' + nCards);
    ok('S3 painel de valores calculados presente',
      await page.evaluate(() => !!document.querySelector('#sim-calc-live .calc-panel, #sim-calc-live .hint')), '');

    // Recálculo ao vivo: muda o primeiro primitivo booleano/segmentado e confere que a
    // assinatura dos semáforos mudou OU que o painel foi reconstruído sem erro.
    const antes = await page.evaluate(() => Array.from(document.querySelectorAll('#sim-protos-live .semaphore')).map(e => e.className).join('|'));
    const mudou = await page.evaluate(() => {
      const specs = (primFieldsFor(SIM.tumor) || []).filter(s => s.campo !== 'sexo' && s.campo !== 'idade');
      // Vira TODOS os primitivos para o oposto/primeira opção: garante que alguma regra reage.
      specs.forEach(s => {
        const cur = SIM.clin[s.campo];
        if (s.tipo === 'boolean') SIM.clin[s.campo] = !(cur === true);
        else if (s.tipo === 'number' || s.tipo === 'score') SIM.clin[s.campo] = (cur == null ? 1 : cur + 1);
        else if ((s.opcoes || []).length) SIM.clin[s.campo] = s.opcoes.find(o => String(o) !== String(cur)) ?? s.opcoes[0];
      });
      recalcSim();
      return true;
    });
    const depois = await page.evaluate(() => Array.from(document.querySelectorAll('#sim-protos-live .semaphore')).map(e => e.className).join('|'));
    ok('S4 ★ mudar característica recalcula os protocolos ao vivo',
      mudou && depois.length > 0 && depois !== antes, antes === depois ? 'assinatura idêntica' : '');

    // ═══ FASE 2 — a invariante: simulação NÃO GRAVA ═══
    ok('S5 ★ nenhum botão "Selecionar protocolo" no sandbox',
      await page.evaluate(() => document.querySelectorAll('#app .sel-btn').length) === 0, '');
    ok('S5 ★ nenhuma ESCRITA saiu do browser durante a simulação (0 POST/PUT/PATCH/DELETE)',
      f1.escritas.length === 0, f1.escritas.join(' | '));

    // ═══ FASE 3 — a tela do Simulador não tem dinheiro (oncologista) ═══
    await telaSemDinheiro(page, 'oncologista');
    ok('S7 console limpo na tela do Simulador (oncologista)', f1.errs.length === 0, f1.errs.join(' | '));

    // ═══ FASE 4 — as DUAS pontas: API direta com o token do oncologista ═══
    const tkOnco = f1.tk;
    // Alimentam o Simulador: têm de responder 200. Se alguma virar 403, a aba fica na
    // tela e a simulação sai vazia — falha silenciosa, a pior espécie.
    for (const rota of ['/evidencia', '/revisoes/resumo', '/revisoes/fontes']) {
      const r = await req('GET', rota, tkOnco);
      ok(`S8 ★ oncologista LÊ ${rota} (200)`, r.status === 200, 'status=' + r.status);
    }
    // Continuam fora do alcance dele. A aba nova não abriu porta nenhuma no servidor.
    const negadas = [
      ['GET', '/revisoes'], ['GET', '/autorizacoes'], ['GET', '/autorizacoes/contagem'],
      ['GET', '/custos'], ['GET', '/custos/carteira'], ['GET', '/recursos/projecao'],
      ['GET', '/recursos/insumos'], ['GET', '/usuarios'],
    ];
    for (const [m, rota] of negadas) {
      const r = await req(m, rota, tkOnco);
      ok(`S9 ★ oncologista NÃO lê ${rota} (403)`, r.status === 403, 'status=' + r.status);
    }
    // Escrita de revisão continua sendo do revisor: o Simulador lê o mesmo corpus, não
    // dá voz a quem não a tinha.
    const rPost = await req('POST', '/revisoes', tkOnco, { regimen_id: 'x', decisao: 'aprovado' });
    ok('S9 ★ oncologista NÃO grava parecer de revisão (403)', rPost.status === 403, 'status=' + rPost.status);

    await f1.ctx.close();

    // ═══ FASE 5 — contraprova: quem via continua vendo; o gestor não passa a ver ═══
    for (const perfil of ['revisor', 'admin']) {
      const f = await ctxLogin(browser, perfil);
      const a = await abasDe(f.page);
      ok(`S10 ${perfil} continua vendo a aba Simulador`, a.some(x => /Simulador/.test(x)), a.join(','));
      await abrirSimulador(f.page, TUMOR);
      ok(`S10 ${perfil} abre o Simulador`, await f.page.evaluate(() => view) === 'simulador');
      if (perfil === 'admin') {
        // A asserção de "sem dinheiro" é sobre a TELA, não sobre o perfil: o admin é o
        // único que poderia ver o número sem nenhum guard reclamar.
        await telaSemDinheiro(f.page, 'admin');
        // ...e o dinheiro não sumiu do produto: a aba Recursos do admin ainda mostra R$.
        // Espera o DADO chegar: renderRecursos() devolve "⏳ Projetando…" e busca a
        // projeção em seguida. Um sleep fixo aqui reprovava por lentidão, não por
        // regressão — e um portão que falha por timing ensina a ignorar portão.
        await f.page.evaluate(() => go('recursos'));
        let temDinheiro = false;
        try {
          await f.page.waitForFunction(
            () => /R\$/.test((document.getElementById('app') || document.body).innerText),
            null, { timeout: 30000 });
          temDinheiro = true;
        } catch (_) { temDinheiro = false; }
        ok('S11 ★ o dinheiro não sumiu do produto: aba Recursos do admin mostra R$', temDinheiro,
          temDinheiro ? '' : await f.page.evaluate(() => (document.getElementById('app') || document.body).innerText.slice(0, 140)));
      }
      ok(`S10 ★ ${perfil}: 0 escritas durante a simulação`, f.escritas.length === 0, f.escritas.join(' | '));
      await f.ctx.close();
    }

    // O gestor não é clínico e não entra no Simulador. Se este check virar PASS-invertido,
    // a whitelist virou "qualquer autenticado" — a regressão que o portão persegue.
    const fg = await ctxLogin(browser, 'gestor');
    const ag = await abasDe(fg.page);
    ok('S12 ★ gestor NÃO vê a aba Simulador', !ag.some(x => /Simulador/.test(x)), ag.join(','));
    const vg = await fg.page.evaluate(() => { view = 'simulador'; render(); return view; });
    ok('S12 ★ gestor forçando view=simulador cai em recursos (guard de tela)', vg === 'recursos', 'view=' + vg);
    await fg.ctx.close();

    // O gestor também não lê o corpus por engano em nenhuma rota clínica do Simulador.
    const tkGestor = await tokenApi(API, 'gestor');
    for (const rota of ['/revisoes/resumo', '/revisoes/fontes']) {
      const r = await req('GET', rota, tkGestor);
      ok(`S12 ★ gestor NÃO lê ${rota} (403)`, r.status === 403, 'status=' + r.status);
    }
  } finally {
    await browser.close();
    const fail = R.filter(r => !r[0]);
    console.log(`\n${R.length - fail.length}/${R.length} checks OK`);
    if (fail.length) { console.log('\nFALHAS:'); fail.forEach(f => console.log('  ' + f[1] + (f[2] ? '  [' + f[2] + ']' : ''))); }
    process.exit(fail.length ? 1 : 0);
  }
})();
