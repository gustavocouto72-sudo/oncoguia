import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Corpus do squad (backend/data/evidencia.json) lido no SERVIDOR. Existia só para ser
// servido à app; agora também responde uma pergunta que não pode depender do cliente:
// este regime é INCORPORADO pela instituição?
//
// Por que isso importa: selecionar protocolo Não incorporado abre solicitação de exceção
// (nasce 'pendente', não vira tratamento vigente sem auditor). Enquanto essa derivação
// vivesse só na app, bastava um POST direto sem `autorizacao_estado` para o protocolo
// nascer vigente e pular o auditor — a trava seria de tela, não de sistema.
@Injectable()
export class EvidenciaService {
  private readonly log = new Logger(EvidenciaService.name);
  private cache: any = null;
  private naoIncorporados: Set<string> | null = null;

  // cwd cobre o dev local (node dist/main em backend/); __dirname cobre o build
  // serverless (Vercel), onde o cwd não é a raiz do backend.
  private caminhos(): string[] {
    return [
      process.env.ONCOGUIA_EVIDENCIA_PATH,
      path.resolve(process.cwd(), 'data', 'evidencia.json'),
      path.resolve(__dirname, '..', '..', '..', 'data', 'evidencia.json'),
    ].filter(Boolean) as string[];
  }

  carregar(): any {
    if (this.cache) return this.cache;
    for (const p of this.caminhos()) {
      try {
        this.cache = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return this.cache;
      } catch {
        /* tenta o próximo */
      }
    }
    throw new NotFoundException(
      'Evidência não encontrada — rode python3 app/build-data.py para gerar backend/data/evidencia.json',
    );
  }

  // Mesma derivação da app (`incorporacao()` em app/index.html), na ordem de precedência:
  //  1. campo EXPLÍCITO r.incorporacao.status (gravado pelo Step 08 quando o revisor refuta);
  //  2. flag "nao_incorporado:/nao_incluido:" do squad;
  //  3. sufixo "-nao-incorporado/-nao-incluido" no regimen_id;
  //  4. texto do nome/status_incorporacao.
  // Duas implementações da mesma regra é dívida conhecida: a app precisa dela para pintar
  // o card antes de qualquer POST, e o servidor não pode confiar na app. Se a regra mudar,
  // muda nos dois — o portão da autorização quebra se saírem de sincronia (checks A7/A8).
  private indice(): Set<string> {
    if (this.naoIncorporados) return this.naoIncorporados;
    const set = new Set<string>();
    const regimes: any[] = this.carregar()?.regimes || [];
    for (const r of regimes) {
      const id = String(r?.regimen_id || '');
      if (!id) continue;
      if (r?.incorporacao?.status === 'nao_incorporado') { set.add(id); continue; }
      const flags: string[] = Array.isArray(r?.flags) ? r.flags.map(String) : [];
      if (flags.some((f) => /^nao_(incorporad|inclu)/i.test(f))) { set.add(id); continue; }
      if (/-nao-(incorporad|inclu)/.test(id)) { set.add(id); continue; }
      const texto = `${r?.nome || ''} ${r?.afirmado_protocolo?.status_incorporacao || ''}`;
      if (/n[ãa]o (incorporad|inclu[ií]d)/i.test(texto)) set.add(id);
    }
    this.naoIncorporados = set;
    this.log.log(`corpus: ${regimes.length} regimes, ${set.size} não incorporados`);
    return set;
  }

  // true = a instituição NÃO oferece este protocolo → seleção exige autorização de exceção.
  // Regime desconhecido no corpus devolve false: quem não está no corpus não é "não
  // incorporado", é outra coisa — e inventar pendência sobre dado ausente é pior do que
  // deixar passar (o eixo Inelegível continua valendo por cima).
  naoIncorporado(regimenId: string): boolean {
    if (!regimenId) return false;
    try {
      return this.indice().has(String(regimenId));
    } catch (e) {
      // Sem corpus no disco o servidor não deixa de gravar a avaliação — mas registra,
      // porque nesse estado o enforcement do não-incorporado está cego.
      this.log.warn(`corpus indisponível: enforcement de não-incorporado inativo (${e.message})`);
      return false;
    }
  }
}
