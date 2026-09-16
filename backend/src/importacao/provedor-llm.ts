import Anthropic from '@anthropic-ai/sdk';

// ADAPTADOR DE PROVEDOR — a extração de prontuário fala com "um modelo" por esta
// interface, nunca com um SDK direto. Trocar de fornecedor é escrever outra classe aqui
// e apontar `IMPORTACAO_PROVEDOR`; o serviço de extração não muda uma linha.
//
// Contrato: recebe instruções (system), o texto RASPADO (user) e o JSON Schema da saída;
// devolve o JSON já como objeto. Não guarda nada: o texto entra, a resposta sai, e o
// adaptador não tem estado nem log — o prontuário não fica em lugar nenhum do servidor.
export interface PedidoExtracao {
  system: string;
  texto: string;
  schema: Record<string, unknown>;
}
export interface RespostaExtracao {
  json: any;
  modelo: string;
  uso: { entrada: number; saida: number } | null;
}
export interface ProvedorExtracao {
  readonly nome: string;
  readonly modelo: string;
  extrair(pedido: PedidoExtracao): Promise<RespostaExtracao>;
}

// Chave ausente é um ESTADO, não um erro de programação: quem chama devolve 503 com
// instrução, e o resto da importação (formulário, JSON colado, validação) segue de pé.
export class ProvedorNaoConfigurado extends Error {
  constructor(msg: string) { super(msg); this.name = 'ProvedorNaoConfigurado'; }
}

// Anthropic (Claude) — SDK oficial. Modelo por env (`IMPORTACAO_MODELO`), padrão um
// Sonnet atual: extração de campos com vocabulário fechado é tarefa de leitura
// cuidadosa, não de raciocínio longo. Saída ESTRITA via `output_config.format`
// (structured outputs): o modelo só consegue devolver JSON que valida contra o schema —
// a validação semântica (valor no vocabulário, trecho literal no texto) é do serviço.
export class ProvedorAnthropic implements ProvedorExtracao {
  readonly nome = 'anthropic';
  readonly modelo: string;
  private client: Anthropic;

  constructor(apiKey: string, modelo?: string) {
    this.modelo = modelo || 'claude-sonnet-5';
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async extrair(pedido: PedidoExtracao): Promise<RespostaExtracao> {
    const resposta = await this.client.messages.create({
      model: this.modelo,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: pedido.schema } },
      system: pedido.system,
      messages: [{ role: 'user', content: pedido.texto }],
    });
    if (resposta.stop_reason === 'refusal') {
      throw new Error('O modelo recusou processar o texto' + (resposta.stop_details?.explanation ? `: ${resposta.stop_details.explanation}` : ''));
    }
    const texto = resposta.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');
    let json: any;
    try { json = JSON.parse(texto); } catch {
      throw new Error('O modelo não devolveu JSON válido');
    }
    return {
      json,
      modelo: resposta.model,
      uso: resposta.usage ? { entrada: resposta.usage.input_tokens, saida: resposta.usage.output_tokens } : null,
    };
  }
}

// Fábrica: lê o ambiente UMA vez por chamada (não no boot) — assim a chave pode ser
// configurada sem reiniciar, e a ausência dela vira 503 só na rota que precisa.
export function provedorDoAmbiente(): ProvedorExtracao {
  const qual = (process.env.IMPORTACAO_PROVEDOR || 'anthropic').trim().toLowerCase();
  if (qual === 'anthropic') {
    const chave = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!chave) {
      throw new ProvedorNaoConfigurado(
        'Extração por IA indisponível: ANTHROPIC_API_KEY não configurada no servidor. O restante da importação (formulário guiado e JSON colado) continua funcionando.',
      );
    }
    return new ProvedorAnthropic(chave, (process.env.IMPORTACAO_MODELO || '').trim() || undefined);
  }
  throw new ProvedorNaoConfigurado(`Extração por IA indisponível: provedor "${qual}" desconhecido (IMPORTACAO_PROVEDOR).`);
}
