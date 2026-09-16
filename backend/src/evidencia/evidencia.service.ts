import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CampoPrimitivo, CritMap, PrimMap, ResultadoSemaforo, classificarRegra } from './semaforo';

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

  // ── VOCABULÁRIO e SEMÁFORO (importação de pacientes) ───────────────────────
  // O que a proposta de importação precisa saber do corpus, sem carregar o corpus:
  //  • os tumores que têm regime, com os `campos_primitivos` de cada um (campo, tipo,
  //    opções, rótulo, seção, estável) — o formulário da secretaria desenha isto;
  //  • os regimes de cada tumor, SÓ id + nome + se é incorporado — o catálogo de nomes que
  //    ela transcreve do PDF, sem critério, referência, grade ou custo.
  // É a rota `/importacao/vocabulario`, com whitelist própria: a secretaria continua fora
  // de `/evidencia` (CorpusGuard), e o portão dela continua exigindo EVIDENCIA nula na
  // sessão — este dicionário de formulário não é o corpus.
  vocabulario() {
    const ev = this.carregar();
    const regimes: any[] = ev?.regimes || [];
    const cp = ev?.campos_primitivos || {};
    const tumores = [...new Set(regimes.map((r) => r?.tumor).filter(Boolean))].sort();
    return {
      tumores: tumores.map((t) => ({
        id: t,
        campos: (this.primitivos(t) || []).map((s) => ({
          campo: s.campo, tipo: s.tipo, opcoes: s.opcoes ?? null, label: s.label ?? s.campo,
          secao: s.secao ?? null, estavel: !!s.estavel, unidade: s.unidade ?? null,
          // vocabulário declarado no dado: token indeterminado (🟡) e rótulo por opção
          indeterminado: s.indeterminado ?? null, rotulos: s.rotulos ?? null,
        })),
        // Nome + cenário/subtipo/esquema: o mínimo para distinguir dois regimes com o
        // mesmo nome (três "Enzalutamida" em próstata: mCSPC, nmCRPC, mCRPC 1L). Continua
        // sem critério, referência, grade ou custo.
        regimes: regimes.filter((r) => r?.tumor === t && r?.regimen_id).map((r) => ({
          regimen_id: String(r.regimen_id), nome: String(r.nome || r.regimen_id),
          cenario: r.cenario ? String(r.cenario) : null, subtipo: r.subtipo ? String(r.subtipo) : null,
          esquema: r.esquema ? String(r.esquema).slice(0, 160) : null,
          incorporado: !this.naoIncorporado(String(r.regimen_id)),
        })),
      })),
      // Aviso honesto: tumor sem campos_primitivos não tem elegibilidade computável.
      sem_primitivos: tumores.filter((t) => !(this.primitivos(t) || []).length),
      _cp_formato: Array.isArray(cp) ? 'array' : 'objeto',
    };
  }

  // campos_primitivos de um tumor. Aceita os dois formatos do lote (array plano = vale
  // para todo tumor com regra; objeto {tumor: [...]}) — mesma leitura da app.
  primitivos(tumor: string): CampoPrimitivo[] | null {
    const cp = this.carregar()?.campos_primitivos;
    if (!cp) return null;
    if (Array.isArray(cp)) return cp as CampoPrimitivo[];
    return (cp[tumor] as CampoPrimitivo[]) || null;
  }

  primMap(tumor: string): PrimMap {
    const m: PrimMap = {};
    (this.primitivos(tumor) || []).forEach((s) => { if (s && s.campo) m[s.campo] = s; });
    return m;
  }

  regime(regimenId: string): any | null {
    if (!regimenId) return null;
    const regimes: any[] = this.carregar()?.regimes || [];
    return regimes.find((r) => String(r?.regimen_id) === String(regimenId)) || null;
  }

  // Critérios nomeados do tumor ({ref:id}) — id→expr e id→label, como a app monta em
  // initEvidencia(); primeira definição vence.
  private critsDoTumor(tumor: string): { exprs: CritMap; labels: Record<string, string> } {
    const exprs: CritMap = {}, labels: Record<string, string> = {};
    for (const r of (this.carregar()?.regimes || []) as any[]) {
      if (r?.tumor !== tumor || !r?.elegibilidade) continue;
      for (const c of r.elegibilidade.criterios || []) {
        if (!c?.id) continue;
        if (!(c.id in exprs)) exprs[c.id] = c.expr;
        if (!(c.id in labels)) labels[c.id] = c.label || c.id;
      }
    }
    return { exprs, labels };
  }

  // Semáforo de um regime para valores INFORMADOS (sem default de tipo — ver semaforo.ts).
  // null = regime fora do corpus (quem chama decide o que fazer com isso).
  classificar(regimenId: string, valores: Record<string, any>): (ResultadoSemaforo & { tumor: string; nao_incorporado: boolean }) | null {
    const r = this.regime(regimenId);
    if (!r) return null;
    const tumor = String(r.tumor || '');
    const { exprs, labels } = this.critsDoTumor(tumor);
    const res = classificarRegra(r?.elegibilidade?.regra, valores || {}, exprs, this.primMap(tumor), labels);
    return { ...res, tumor, nao_incorporado: this.naoIncorporado(regimenId) };
  }
}
