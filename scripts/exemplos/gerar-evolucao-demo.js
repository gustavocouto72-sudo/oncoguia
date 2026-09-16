// Gera scripts/exemplos/evolucao-demo.pdf — evolução SINTÉTICA no layout do Orizonti
// ("Evolução - Oncologia": cabeçalho tabular repetido por página, blocos HISTÓRIA
// CLÍNICA / Tumor de próstata / INFORMAÇÕES ATUAIS / EXAME FÍSICO / Conduta / assinatura).
// Paciente FICTÍCIO, dados inventados e verossímeis: é com este PDF que a demo importa ao
// vivo, sem tocar em dado real. Reproduzível: `node scripts/exemplos/gerar-evolucao-demo.js`.
//
// Tumor: próstata, mCSPC em enzalutamida — o caminho feliz (verde) da importação. O texto
// declara explicitamente o que a regra do corpus pede (metastático, sensível à castração,
// nega convulsão) e traz Gleason, estadiamento, PSA, ECOG, peso/altura, retorno previsto
// e a médica assistente — tudo com frase própria para a extração citar literalmente.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));

const CAB = `
<table class="cab">
  <tr><td class="k">Paciente</td><td class="v">Antonio Carlos Ferreira Lima</td><td class="k">Atendimento</td><td class="v">1.234.567</td></tr>
  <tr><td class="k">Data Nascto.</td><td class="v">12/03/1957 &nbsp;&nbsp; 69 Anos</td><td class="k">Prontuário</td><td class="v">45.678</td></tr>
  <tr><td class="k">Sexo</td><td class="v">Masculino</td><td class="k">Dt. Entrada</td><td class="v">10/09/2026 09:12:40</td></tr>
  <tr><td class="k">Telefone</td><td class="v">(31) 99876-5432</td><td class="k">Convênio</td><td class="v">Unimed Pleno</td></tr>
  <tr><td class="k"></td><td class="v"></td><td class="k">Leito/Unidade</td><td class="v">204 AMB 2B<br>Oncologia - Ambulatório</td></tr>
</table>`;

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 14mm 12mm; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #111; }
  h1 { text-align: center; font-size: 12pt; margin: 0; }
  h2 { text-align: center; font-size: 10pt; margin: 2px 0 8px; font-weight: normal; }
  table.cab { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.cab td { padding: 1px 4px; vertical-align: top; }
  table.cab td.k { width: 14%; font-weight: bold; }
  table.cab td.v { width: 36%; }
  table.ev { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 8px; }
  table.ev th, table.ev td { text-align: left; padding: 1px 4px; }
  .sec { font-weight: bold; margin-top: 8px; }
  p { margin: 2px 0; }
  .assin { text-align: center; margin-top: 28px; }
  .pg { text-align: right; font-size: 8pt; margin-top: 16px; }
</style></head><body>
<h1>Evolução - Oncologia</h1>
<h2>Evolução Clínica - Oncologia</h2>
${CAB}
<table class="ev">
  <tr><th>Data evolução</th><th>Liberação</th><th>Função</th><th>Tipo evolução</th><th>Especialidade</th><th>Usuário</th><th>Código prof</th></tr>
  <tr><td>10/09/2026 09:25</td><td>10/09 09:40</td><td>Médico</td><td>Evolução</td><td>Oncologia</td><td>Helena Duarte Ribeiro</td><td>CRM 12345</td></tr>
</table>
<p><b>Evolução Clínica - Oncologia</b></p>

<p class="sec">HISTÓRIA CLÍNICA</p>
<p>CID oncológico primário (Loco Regional) : C61 - NEOPLASIA MALIGNA DA PROSTATA</p>
<p>Diagnóstico de câncer : Sim</p>
<p>Tipo de tumor : Próstata</p>
<p>Finalidade do tratamento : Paliativo</p>
<p>Data diagnóstico : 20/11/2025</p>
<p>Estadio Inicial : IV</p>
<p>Estadio Atual : IV</p>
<p>Houve ocorrência de recidiva? : Não</p>
<p>Evoluções Anteriores : # Adenocarcinoma acinar de próstata, Gleason 4+4=8 (ISUP 4), diagnosticado por biópsia transretal em 20/11/2025 após PSA de 48,0 ng/mL.
Estadiamento clínico cT3a N1 M1b: cintilografia óssea (02/12/2025) com lesões secundárias em coluna lombar (L2, L4) e bacia; TC de tórax e abdome (03/12/2025) com linfonodomegalia pélvica à esquerda de 1,8 cm, sem metástase visceral.
# Doença metastática hormônio-sensível (mCSPC), sem tratamento prévio para câncer de próstata. Sem prostatectomia, sem radioterapia.
# Iniciada terapia de deprivação androgênica com goserelina 10,8 mg em 15/12/2025 e enzalutamida 160 mg VO 1x/dia em 05/02/2026, após discussão em reunião multidisciplinar.
# Paciente nega história de convulsão ou epilepsia. Nega quimioterapia prévia.
- PSA 02/09/2026: 0,08 ng/mL; PSA 03/06/2026: 0,42; PSA 05/02/2026: 12,6; PSA 20/11/2025: 48,0.
- Laboratório 02/09/2026: Hb 13,1 Leuc 6200 Plaq 240000 Cr 0,98 TGO 22 TGP 25 FA 98 Testosterona 15 ng/dL.</p>
<p>Sitios de Metastase : ossos (coluna lombar e bacia), linfonodos pélvicos</p>
<p>Comorbidades : HAS, dislipidemia</p>
<p>Plano de TTO : # TDA (goserelina) iniciada em 15/12/2025<br># Enzalutamida iniciada em 05/02/2026</p>
<p>Alergias : Nega ou Desconhece a existência de Alergias.</p>
<p>Medicamentos em Uso : Losartana - 50 mg - 12 em 12 horas<br>Rosuvastatina - 10 mg - 24 em 24 horas<br>Enzalutamida - 160 mg - 24 em 24 horas</p>
<div class="pg">Página: 1/2</div>

<div style="page-break-before: always"></div>
<h1>Evolução - Oncologia</h1>
<h2>Evolução Clínica - Oncologia</h2>
${CAB}
<p class="sec">Tumor de próstata</p>
<p>PSA diagnóstico : Maior que 20</p>
<p>Gleason : 8</p>
<p>Estadiamento T : T3a</p>
<p>Estadiamento N : N1</p>
<p>Estadiamento M : M1</p>
<p>Risco : Alto risco</p>
<p>Cirurgia de prostatectomia : Não</p>
<p>Cirurgia de orquiectomia : Não</p>
<p>Iniciou hormonioterapia : Sim</p>
<p>Radioterapia : Não</p>
<p class="sec">INFORMAÇÕES ATUAIS</p>
<p>Evolução : Retorna em uso de enzalutamida e goserelina, doença metastática sensível à castração em resposta bioquímica (PSA 0,08). Refere fadiga leve, sem dor óssea. Boa tolerância.</p>
<p class="sec">EVENTOS ADVERSOS</p>
<p>Apresentou reações adversas? : Sim</p>
<p>Outros eventos adversos (descrever órgão alvo e grau) : Fadiga grau 1.</p>
<p>Exames de Imagem : # Cintilografia óssea (02/12/2025): lesões secundárias em L2, L4 e bacia.<br># TC de tórax e abdome (03/12/2025): linfonodomegalia pélvica à esquerda 1,8 cm; sem lesões viscerais.</p>
<p class="sec">EXAME FÍSICO</p>
<p>Peso : 82,4 kg</p>
<p>Altura : 175 cm</p>
<p>SC : 1,98 m²</p>
<p>IMC : 26,9 kg/m²</p>
<p>PAS : 128 mmHg</p>
<p>PAD : 82 mmHg</p>
<p>FC : 74 bpm</p>
<p>Paciente com dor? : Não</p>
<p>ECOG : 1- Realiza atividades fisicamente extenuantes com restrições; porém deambulante e capaz de realizar tarefas leves.</p>
<p>Exame Físico: : BEG, corado, hidratado. ACV: RCR 2T BNF sem sopros. AR: MVF sem RA. Abdome: livre, indolor.</p>
<p>Sinais e sintomas de TEV? : Não</p>
<p>Conduta : Mantenho enzalutamida 160 mg/dia e goserelina. Solicito PSA e função hepática para o próximo retorno.</p>
<p>Linha de cuidado : Tratamento</p>
<p>Programação de periodicidade do acompanhamento ambulatorial : Semanas</p>
<p>Semanas - Meses : 4</p>
<p>Data provável do retorno : 08/10/2026</p>
<p>Paciente concluiu este protocolo de tratamento? : Não</p>
<div class="assin">Helena Duarte Ribeiro<br>Conselho: CRM - 12345</div>
<div class="pg">Página: 2/2</div>
</body></html>`;

(async () => {
  const out = path.join(__dirname, 'evolucao-demo.pdf');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.setContent(HTML, { waitUntil: 'load' });
  await page.pdf({ path: out, format: 'A4', printBackground: false });
  await browser.close();
  console.log('gerado:', out, fs.statSync(out).size, 'bytes');
})();
