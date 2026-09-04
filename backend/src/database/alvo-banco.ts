// QUAL BANCO ESTE PROCESSO VAI USAR — e a trava que impede o dev de usar o de produção.
//
// O problema real: dev e produção compartilhavam o mesmo banco Neon. Todo teste local
// escrevia em produção. Os portões limpam o que criam, mas cadastro feito à mão fora
// deles não é limpo por ninguém — foi assim que três preços com fonte "TESTE" foram
// parar na base que o auditor enxerga.
//
// A trava é ALLOWLIST, não denylist: em dev o processo só sobe se o endpoint conectado
// for EXATAMENTE o declarado em ONCOGUIA_DB_DEV_ENDPOINT. Motivos de ser assim:
//   • uma denylist ("recuse se for o endpoint de produção") exigiria guardar o endpoint
//     de produção em arquivo local — justamente o que se quer evitar;
//   • allowlist recusa também o que ninguém previu: staging, o banco de outro projeto,
//     um branch antigo que já foi apagado e recriado com outro id.
// Esquecer de configurar não "libera": sem a variável, o processo recusa subir.
//
// Produção (Vercel) NÃO passa por aqui: a Vercel entra por api/index.ts, e esta função
// só é chamada em src/main.ts. O guarda de NODE_ENV abaixo é a segunda tranca, para o
// caso de alguém apontar o entrypoint local para produção um dia.

export interface AlvoBanco {
  host: string;
  /** Identificador do endpoint Neon, sem o sufixo -pooler. É o que distingue branches. */
  endpoint: string;
  banco: string;
  usuario: string;
  ehNeon: boolean;
}

/** Lê a URL sem NUNCA expor a senha — o retorno é seguro para log e para portão. */
export function descreveAlvo(databaseUrl: string): AlvoBanco | null {
  if (!databaseUrl) return null;
  let u: URL;
  try {
    u = new URL(databaseUrl);
  } catch {
    return null;
  }
  const host = u.hostname;
  // Neon: "ep-restless-resonance-avumx2jd-pooler.c-11.us-east-1.aws.neon.tech".
  // O branch é identificado pelo endpoint; o "-pooler" é só o modo de conexão e não
  // muda de branch, então some da normalização — senão a mesma base daria dois ids.
  const primeiro = host.split('.')[0] || host;
  const endpoint = primeiro.replace(/-pooler$/, '');
  return {
    host,
    endpoint,
    banco: decodeURIComponent(u.pathname.replace(/^\//, '')) || '(sem nome)',
    usuario: decodeURIComponent(u.username || ''),
    ehNeon: /\.neon\.tech$/i.test(host),
  };
}

/** Uma linha legível para cabeçalho de log e de portão. Sem credencial. */
export function resumoAlvo(alvo: AlvoBanco | null): string {
  if (!alvo) return 'DATABASE_URL ausente ou ilegível';
  return `${alvo.endpoint} (${alvo.host}) · db=${alvo.banco}`;
}

export class BancoErrado extends Error {}

/**
 * Trava de boot do DEV. Lança BancoErrado — com instrução — se:
 *   • ONCOGUIA_DB_DEV_ENDPOINT não estiver configurado; ou
 *   • o endpoint conectado for outro (produção inclusive).
 * Em NODE_ENV=production não faz nada.
 */
export function exigirBancoDeDev(
  databaseUrl: string | undefined,
  endpointDevEsperado: string | undefined,
  nodeEnv: string | undefined,
): AlvoBanco | null {
  if ((nodeEnv || '').toLowerCase() === 'production') return null;

  const alvo = descreveAlvo(databaseUrl || '');
  if (!alvo) {
    throw new BancoErrado(
      'DATABASE_URL ausente ou ilegível — o backend não sobe sem saber a que banco se conecta.',
    );
  }
  const esperado = (endpointDevEsperado || '').trim().replace(/-pooler$/, '');
  if (!esperado) {
    throw new BancoErrado(
      [
        'ONCOGUIA_DB_DEV_ENDPOINT não configurado — recusando subir.',
        '',
        `  Este processo se conectaria a: ${resumoAlvo(alvo)}`,
        '',
        '  Em desenvolvimento o backend só aceita o branch de DEV do banco, declarado',
        '  explicitamente. Sem a declaração não há como saber se este endpoint é o de',
        '  dev ou o de produção — e adivinhar é exatamente o acidente que esta trava',
        '  existe para impedir.',
        '',
        '  Em backend/.env, declare o endpoint do branch DEV — copiado do console do',
        '  Neon, do branch de desenvolvimento:',
        '    ONCOGUIA_DB_DEV_ENDPOINT=ep-...',
        '',
        '  Note que NÃO oferecemos aqui o endpoint acima para colar: se você está lendo',
        '  esta mensagem, ele pode muito bem ser o de PRODUÇÃO, e declará-lo como dev',
        '  desligaria a trava exatamente no caso que ela existe para pegar.',
      ].join('\n'),
    );
  }
  if (alvo.endpoint !== esperado) {
    throw new BancoErrado(
      [
        'BANCO ERRADO — recusando subir.',
        '',
        `  DATABASE_URL aponta para : ${alvo.endpoint}`,
        `  dev declarado é          : ${esperado}`,
        `  host completo            : ${alvo.host}`,
        '',
        '  Em desenvolvimento o backend só conversa com o branch de dev. Se o endpoint',
        '  acima for o principal, a DATABASE_URL de PRODUÇÃO vazou para um arquivo',
        '  local — a string de produção deve viver apenas nas env vars do Vercel.',
        '',
        '  Conserto: troque DATABASE_URL em backend/.env pela string do branch dev.',
        '  Ver PORTAO-VERIFICACAO.md, seção "Banco de desenvolvimento separado".',
      ].join('\n'),
    );
  }
  return alvo;
}
