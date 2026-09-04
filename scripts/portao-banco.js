// A QUE BANCO ESTE PORTÃO VAI ESCREVER — cabeçalho obrigatório e trava.
//
// Portão escreve: cria paciente, avaliação, parecer, preço. Um portão apontado para
// produção não é um teste, é um incidente. E, pior, um portão VERDE apontado para o
// banco errado é um resultado que não vale nada sobre o ambiente que se queria testar —
// mesmo problema do "!!! ATENÇÃO" do portão de dados quando o corpus não é o do
// RUN_ATIVO. Por isso a primeira linha de todo portão diz o alvo.
//
// A regra é a mesma da trava de boot do backend (backend/src/database/alvo-banco.ts):
// ALLOWLIST — só passa o endpoint declarado em ONCOGUIA_DB_DEV_ENDPOINT. Sem declaração,
// aborta; endpoint diferente, aborta. Esquecer de configurar não libera.
//
// Uma cópia da regra em JS aqui, ao lado da de TypeScript: portão que importa a
// implementação sob teste não testa nada — e esta é pequena o bastante para a duplicação
// custar menos que o acoplamento.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'backend/node_modules/dotenv'))
  .config({ path: path.join(ROOT, 'backend/.env'), quiet: true });

function descreveAlvo(databaseUrl) {
  if (!databaseUrl) return null;
  let u;
  try { u = new URL(databaseUrl); } catch { return null; }
  const host = u.hostname;
  const endpoint = (host.split('.')[0] || host).replace(/-pooler$/, '');
  return {
    host,
    endpoint,
    banco: decodeURIComponent(u.pathname.replace(/^\//, '')) || '(sem nome)',
    ehNeon: /\.neon\.tech$/i.test(host),
  };
}

// Imprime o cabeçalho e ABORTA (exit 1) se o alvo não for o branch de dev declarado.
// `nome` é só para o cabeçalho ficar legível.
function exigirBancoDeDev(nome) {
  const alvo = descreveAlvo(process.env.DATABASE_URL || '');
  const esperado = (process.env.ONCOGUIA_DB_DEV_ENDPOINT || '').trim().replace(/-pooler$/, '');

  const linha = alvo ? `${alvo.endpoint} (${alvo.host}) · db=${alvo.banco}` : 'DATABASE_URL ausente ou ilegível';
  console.log('='.repeat(72));
  console.log(`= Portão: ${nome}`);
  console.log(`= Banco alvo: ${linha}`);
  console.log('='.repeat(72));

  if (!alvo) {
    console.error('\nABORTADO: DATABASE_URL ausente ou ilegível em backend/.env.\n');
    process.exit(1);
  }
  if (!esperado) {
    console.error([
      '',
      'ABORTADO: ONCOGUIA_DB_DEV_ENDPOINT não configurado.',
      '',
      '  Sem a declaração não dá para saber se o endpoint acima é o de dev ou o de',
      '  produção. Portão escreve no banco — não roda no escuro.',
      '',
      '  Em backend/.env, declare o endpoint do branch DEV, copiado do console do Neon:',
      '    ONCOGUIA_DB_DEV_ENDPOINT=ep-...',
      '',
      '  Não colamos aqui o endpoint acima de propósito: se você está lendo isto, ele',
      '  pode ser o de produção — e declará-lo como dev desligaria a trava.',
      '',
    ].join('\n'));
    process.exit(1);
  }
  if (alvo.endpoint !== esperado) {
    console.error([
      '',
      'ABORTADO: este portão escreveria no BANCO ERRADO.',
      '',
      `  DATABASE_URL aponta para : ${alvo.endpoint}`,
      `  dev declarado é          : ${esperado}`,
      '',
      '  Se o endpoint acima for o principal, o portão criaria paciente, parecer e',
      '  preço de teste dentro da base que o auditor enxerga. Troque DATABASE_URL em',
      '  backend/.env pela string do branch dev.',
      '',
      '  Ver PORTAO-VERIFICACAO.md, seção "Banco de desenvolvimento separado".',
      '',
    ].join('\n'));
    process.exit(1);
  }
  return alvo;
}

module.exports = { descreveAlvo, exigirBancoDeDev };
