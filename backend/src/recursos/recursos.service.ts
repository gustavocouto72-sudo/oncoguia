import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AUTORIZACAO_VIGENTE, Avaliacao, Paciente } from '../database/entities';
import { EvidenciaService } from '../evidencia/evidencia.service';
import { CustosService, Estimativa } from '../custos/custos.service';
import { CicloRecurso, RecursosCalculoService } from './recursos-calculo.service';
import { centavos, reais } from './dose';

const HORIZONTES = [3, 6, 12] as const;
export type Horizonte = (typeof HORIZONTES)[number];
const DIAS_POR_MES = 30.4; // mesmo número da especificação e de custos.service

// PROJEÇÃO POR HORIZONTE — a carteira inteira somada por 3, 6 ou 12 meses.
//
// Duas coisas que este serviço faz e que valem ser lidas antes do código:
//   • soma só quem TEM número, e reporta separadamente quem ficou de fora e por quê.
//     Tratar "sem dado" como zero diria que a carteira custa menos do que custa — o
//     mesmo erro que o módulo de custo já recusa;
//   • pseudonimiza no SERVIDOR. Para o gestor, a coluna `nome` do paciente nem é
//     selecionada do banco: não há caminho de código que a devolva por engano.
@Injectable()
export class RecursosService {
  constructor(
    @InjectRepository(Avaliacao) private avaliacaoRepo: Repository<Avaliacao>,
    @InjectRepository(Paciente) private pacienteRepo: Repository<Paciente>,
    private evidencia: EvidenciaService,
    private custos: CustosService,
    private calculo: RecursosCalculoService,
  ) {}

  // ---- projeção por horizonte ----------------------------------------------
  private async vigentesPorPaciente(): Promise<Avaliacao[]> {
    return this.avaliacaoRepo
      .createQueryBuilder('a')
      .distinctOn(['a.paciente_id'])
      .where('a.autorizacao_estado IN (:...vigentes)', { vigentes: AUTORIZACAO_VIGENTE })
      .orderBy('a.paciente_id', 'ASC')
      .addOrderBy('a.data', 'DESC')
      .getMany();
  }

  // Ciclos que ainda cabem no horizonte. É ESTIMATIVA e a resposta diz isso: o sistema
  // registra quando o protocolo foi escolhido, não quando cada aplicação aconteceu.
  //   decorridos  = dias desde o início da avaliação ÷ periodicidade (para baixo)
  //   restantes   = esperados − decorridos
  //   no horizonte= min(restantes, horizonte ÷ periodicidade)  — também para baixo
  private ciclosNoHorizonte(e: Estimativa, inicio: Date, horizonteMeses: Horizonte, hoje: Date) {
    if (!e.uso.disponivel || !e.uso.ciclos_esperados || !e.uso.periodicidade_dias) return null;
    const per = e.uso.periodicidade_dias;
    const diasCorridos = Math.max(0, Math.floor((hoje.getTime() - inicio.getTime()) / 86_400_000));
    const decorridos = Math.floor(diasCorridos / per);
    const restantes = Math.max(0, e.uso.ciclos_esperados - decorridos);
    const cabem = Math.floor((horizonteMeses * DIAS_POR_MES) / per);
    return {
      periodicidade_dias: per,
      ciclos_esperados: e.uso.ciclos_esperados,
      ciclos_decorridos: decorridos,
      ciclos_restantes: restantes,
      ciclos_no_horizonte: Math.min(restantes, cabem),
    };
  }

  // PSEUDONIMIZAÇÃO: a linha do gestor nasce SEM o nome. Não é o nome apagado depois — o
  // campo nunca é lido para ele, e por isso não há caminho de código que o devolva por
  // engano num campo novo. Rótulo estável: "Paciente #12 · mama · AC-T".
  private linhaPaciente(perfil: string, p: Paciente | undefined, pacienteId: number,
                        tumor: string | null, protocolo: string | null) {
    const ref = `Paciente #${pacienteId}`;
    const rotulo = [ref, tumor || null, protocolo || null].filter(Boolean).join(' · ');
    if (perfil === 'gestor') return { paciente_id: pacienteId, paciente_ref: ref, rotulo, tumor };
    return { paciente_id: pacienteId, paciente_ref: ref, rotulo, tumor, paciente: p?.nome ?? null };
  }

  async projecao(horizonte: Horizonte, perfil: string) {
    if (!HORIZONTES.includes(horizonte)) {
      throw new BadRequestException(`horizonte deve ser um de ${HORIZONTES.join(', ')} meses`);
    }
    const hoje = new Date();
    const vigentes = await this.vigentesPorPaciente();
    const ctx = await this.calculo.contexto();
    // O nome só é buscado quando o perfil pode vê-lo. Gestor não carrega a coluna.
    const pacientes = perfil === 'gestor'
      ? await this.pacienteRepo.find({ select: { id: true, tumor: true } })
      : await this.pacienteRepo.find({ select: { id: true, nome: true, tumor: true } });
    const porId = new Map(pacientes.map((p) => [p.id, p]));

    const ids = [...new Set(vigentes.map((v) => v.regimen_id))];
    const estimativas = new Map<string, Estimativa>(
      (await this.custos.estimativas(ids)).map((e) => [e.regimen_id, e]),
    );
    const ciclos = new Map<string, CicloRecurso>();
    for (const id of ids) ciclos.set(id, await this.calculo.cicloDoRegime(id, ctx));
    const regimes: any[] = this.evidencia.carregar()?.regimes || [];
    const nomeRegime = new Map(regimes.map((r) => [r.regimen_id, r?.nome || r?.regimen_id]));

    // acumuladores em CENTAVOS
    const demanda = new Map<string, { farmaco: string; conteudo: string; frascos: number; min: number; max: number }>();
    const porProtocolo = new Map<string, any>();
    const carteira: any[] = [];
    const fora: any[] = [];
    let compraMin = 0, compraMax = 0, faturamento = 0;
    let faturamentoCompleto = true;

    for (const v of vigentes) {
      const p = porId.get(v.paciente_id);
      const c = ciclos.get(v.regimen_id)!;
      const e = estimativas.get(v.regimen_id)!;
      const linha = this.linhaPaciente(perfil, p, v.paciente_id, p?.tumor ?? null,
                                       nomeRegime.get(v.regimen_id) ?? v.regimen_id);
      const janela = this.ciclosNoHorizonte(e, new Date(v.data), horizonte, hoje);
      if (!janela) {
        fora.push({ ...linha, regimen_id: v.regimen_id, motivo: 'sem_uso_derivavel',
                    explicacao: e.uso.explicacao || 'Sem tempo de uso derivável para este protocolo.' });
        continue;
      }
      if (c.origem === 'sem-dado') {
        fora.push({ ...linha, regimen_id: v.regimen_id, ...janela,
                    motivo: c.motivo, explicacao: c.explicacao });
        continue;
      }
      const n = janela.ciclos_no_horizonte;
      const cMin = centavos(c.compra_min_ciclo!) * n;
      const cMax = centavos(c.compra_max_ciclo!) * n;
      const fat = c.faturamento_ciclo === null ? null : centavos(c.faturamento_ciclo) * n;
      compraMin += cMin; compraMax += cMax;
      if (fat === null) faturamentoCompleto = false; else faturamento += fat;

      for (const it of c.itens) {
        const chave = `${it.farmaco}|${it.apresentacao.conteudo}`;
        const d = demanda.get(chave) || {
          farmaco: it.farmaco, conteudo: it.apresentacao.conteudo, frascos: 0, min: 0, max: 0,
        };
        d.frascos += it.frascos.frascos_por_ciclo * n;
        d.min += centavos(it.compra_min_ciclo) * n;
        d.max += centavos(it.compra_max_ciclo) * n;
        demanda.set(chave, d);
      }

      const pp = porProtocolo.get(v.regimen_id) || {
        regimen_id: v.regimen_id, protocolo: nomeRegime.get(v.regimen_id) ?? v.regimen_id,
        origem: c.origem, pacientes: 0, ciclos: 0,
        compra_min: 0, compra_max: 0, faturamento: 0, faturamento_completo: true,
      };
      pp.pacientes += 1; pp.ciclos += n;
      pp.compra_min += cMin; pp.compra_max += cMax;
      if (fat === null) pp.faturamento_completo = false; else pp.faturamento += fat;
      porProtocolo.set(v.regimen_id, pp);

      carteira.push({
        ...linha, regimen_id: v.regimen_id, protocolo: nomeRegime.get(v.regimen_id) ?? v.regimen_id,
        origem: c.origem, ...janela,
        compra_min: reais(cMin), compra_max: reais(cMax),
        faturamento: fat === null ? null : reais(fat),
        margem_min: fat === null ? null : reais(fat - cMax),
        margem_max: fat === null ? null : reais(fat - cMin),
      });
    }

    return {
      horizonte_meses: horizonte,
      gerado_em: hoje.toISOString(),
      pseudonimizado: perfil === 'gestor',
      premissas: ctx.corpo,
      pacientes_no_calculo: carteira.length,
      pacientes_fora: fora.length,
      compra_min: reais(compraMin),
      compra_max: reais(compraMax),
      // Faturamento parcial NÃO vira total: se um protocolo da carteira não tem contrato
      // cadastrado, a receita da carteira é desconhecida, não "a soma do que tem".
      faturamento: faturamentoCompleto ? reais(faturamento) : null,
      faturamento_completo: faturamentoCompleto,
      margem_min: faturamentoCompleto ? reais(faturamento - compraMax) : null,
      margem_max: faturamentoCompleto ? reais(faturamento - compraMin) : null,
      demanda_compra: [...demanda.values()]
        .map((d) => ({ ...d, min: reais(d.min), max: reais(d.max) }))
        .sort((a, b) => b.max - a.max),
      faturamento_por_protocolo: [...porProtocolo.values()]
        .map((p) => ({
          ...p,
          compra_min: reais(p.compra_min), compra_max: reais(p.compra_max),
          faturamento: p.faturamento_completo ? reais(p.faturamento) : null,
          margem_min: p.faturamento_completo ? reais(p.faturamento - p.compra_max) : null,
          margem_max: p.faturamento_completo ? reais(p.faturamento - p.compra_min) : null,
        }))
        .sort((a, b) => b.compra_max - a.compra_max),
      carteira,
      fora,
      aviso: 'Ciclos restantes são ESTIMATIVA: o sistema registra quando o protocolo foi escolhido, não cada aplicação.',
      selo: 'estimativa' as const,
    };
  }

}
