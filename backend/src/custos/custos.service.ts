import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AUTORIZACAO_VIGENTE, Avaliacao, CustoRegime, Paciente } from '../database/entities';
import { EvidenciaService } from '../evidencia/evidencia.service';
import { periodicidadesDoEsquema, periodicidadeUnica } from './periodicidade';

// Dias por mês usados na conversão tempo→ciclos. 30.4 é o valor fixado na especificação
// desta fase (365.25/12 = 30.44); fica explícito aqui para o portão poder conferir a
// aritmética contra o mesmo número.
const DIAS_POR_MES = 30.4;

export const AVISO_PFS =
  'Estimativa por PFS é piso: tratamento costuma exceder a progressão.';

export type MotivoSemEstimativa =
  | 'regime_desconhecido'
  | 'sem_expectativa_uso'
  | 'tempo_indeterminado'
  | 'ciclos_nao_derivaveis'
  | 'periodicidade_nao_derivavel'
  | 'sem_preco_cadastrado';

// Texto que a app mostra. Fica no SERVIDOR para que "sem estimativa" seja sempre a mesma
// frase, com o mesmo motivo — e nunca um zero, nem um campo vazio que o usuário leia
// como "custo baixo".
const EXPLICACAO: Record<MotivoSemEstimativa, string> = {
  regime_desconhecido: 'Protocolo não encontrado no corpus publicado.',
  sem_expectativa_uso: 'Protocolo sem bloco de expectativa de uso no corpus.',
  tempo_indeterminado:
    'Tempo de uso indeterminado: o pivotal não reporta duração nem PFS mediana, ou o esquema não fecha um número de ciclos.',
  ciclos_nao_derivaveis:
    'Duração fixa declarada em tempo contínuo, sem contagem de ciclos — custo por ciclo não se aplica.',
  periodicidade_nao_derivavel:
    'Periodicidade não derivável do esquema (ausente ou com mais de uma alternativa) — converter tempo em ciclos exigiria chutar o intervalo.',
  sem_preco_cadastrado: 'Custo por ciclo ainda não cadastrado para este protocolo.',
};

export interface Estimativa {
  regimen_id: string;
  disponivel: boolean;
  motivo?: MotivoSemEstimativa;
  explicacao?: string;
  ciclos_esperados?: number;
  origem_ciclos?: 'esquema' | 'proxy_pfs' | 'duracao_reportada';
  origem_detalhe?: string;
  periodicidade_dias?: number;
  custo_ciclo?: { min: number; max: number; fonte_min: string; fonte_max: string };
  total_min?: number;
  total_max?: number;
  nota_expectativa?: string;
  aviso?: string;
  selo: 'estimativa';
}

@Injectable()
export class CustosService {
  constructor(
    @InjectRepository(CustoRegime) private custoRepo: Repository<CustoRegime>,
    @InjectRepository(Avaliacao) private avaliacaoRepo: Repository<Avaliacao>,
    @InjectRepository(Paciente) private pacienteRepo: Repository<Paciente>,
    private evidencia: EvidenciaService,
  ) {}

  // ---- cadastro (admin) ----------------------------------------------------
  listar() {
    return this.custoRepo.find({ relations: { atualizadoPor: true }, order: { regimen_id: 'ASC' } });
  }

  async salvar(
    regimenId: string,
    dto: {
      custo_ciclo_tabela: number;
      custo_ciclo_negociado: number;
      fonte_tabela: string;
      fonte_negociado: string;
    },
    usuarioId: number,
  ) {
    if (!this.regimePorId(regimenId)) {
      throw new BadRequestException(`Protocolo desconhecido no corpus: ${regimenId}`);
    }
    // Negociado acima da tabela inverteria a faixa (min > max) e a tela mostraria um
    // intervalo de trás para frente. É erro de cadastro, e é aqui que ele para.
    if (dto.custo_ciclo_negociado > dto.custo_ciclo_tabela) {
      throw new BadRequestException(
        'custo_ciclo_negociado não pode ser maior que custo_ciclo_tabela — a faixa sairia invertida',
      );
    }
    for (const [campo, valor] of [
      ['fonte_tabela', dto.fonte_tabela],
      ['fonte_negociado', dto.fonte_negociado],
    ] as const) {
      if (!String(valor || '').trim()) {
        throw new BadRequestException(`${campo} obrigatório — nenhum preço aparece na tela sem fonte`);
      }
    }
    await this.custoRepo.save({
      regimen_id: regimenId,
      custo_ciclo_tabela: dto.custo_ciclo_tabela,
      custo_ciclo_negociado: dto.custo_ciclo_negociado,
      fonte_tabela: dto.fonte_tabela.trim(),
      fonte_negociado: dto.fonte_negociado.trim(),
      atualizado_por: usuarioId,
    });
    return this.custoRepo.findOne({
      where: { regimen_id: regimenId },
      relations: { atualizadoPor: true },
    });
  }

  // ---- estimativa (auditor + admin) ----------------------------------------
  private regimePorId(regimenId: string): any | null {
    const regimes: any[] = this.evidencia.carregar()?.regimes || [];
    return regimes.find((r) => String(r?.regimen_id) === String(regimenId)) || null;
  }

  private sem(regimen_id: string, motivo: MotivoSemEstimativa, extra?: Partial<Estimativa>): Estimativa {
    return { regimen_id, disponivel: false, motivo, explicacao: EXPLICACAO[motivo], selo: 'estimativa', ...extra };
  }

  // Centavos na multiplicação: ciclos x preço em reais com casa decimal acumula erro de
  // ponto flutuante (0.1+0.2), e um total de carteira somando centenas de protocolos
  // amplifica o desvio. Multiplica inteiro, divide no fim.
  private multiplicar(ciclos: number, reais: number): number {
    return Math.round(ciclos * Math.round(reais * 100)) / 100;
  }

  async estimativa(regimenId: string): Promise<Estimativa> {
    const regime = this.regimePorId(regimenId);
    if (!regime) return this.sem(regimenId, 'regime_desconhecido');
    const bloco = regime.expectativa_uso;
    if (!bloco) return this.sem(regimenId, 'sem_expectativa_uso');

    const nota = bloco.nota || undefined;
    // Indeterminado no corpus é indeterminado aqui: a Fase 1 já decidiu que não há número
    // honesto, e o custo não inventa um.
    if (bloco.indeterminado) return this.sem(regimenId, 'tempo_indeterminado', { nota_expectativa: nota });

    let ciclos: number | null = null;
    let origem: Estimativa['origem_ciclos'];
    let origemDetalhe = '';
    let periodicidade: number | undefined;
    let aviso: string | undefined;

    if (bloco.tipo === 'fixa') {
      if (typeof bloco.ciclos !== 'number' || !bloco.ciclos) {
        // Ex.: olaparibe "por 2 anos" — duração fixa, mas sem ciclos. Custo POR CICLO não
        // multiplica isso; virá do módulo de custo por período, não daqui.
        return this.sem(regimenId, 'ciclos_nao_derivaveis', { nota_expectativa: nota });
      }
      ciclos = bloco.ciclos;
      periodicidade = bloco.periodicidade_dias ?? undefined;
      origem = 'esquema';
      origemDetalhe = `${bloco.ciclos} ciclos declarados no esquema`;
    } else if (bloco.tipo === 'ate_progressao') {
      const meses =
        typeof bloco.duracao_mediana_tratamento_meses === 'number'
          ? bloco.duracao_mediana_tratamento_meses
          : typeof bloco.pfs_mediana_meses === 'number'
            ? bloco.pfs_mediana_meses
            : null;
      if (meses === null) return this.sem(regimenId, 'tempo_indeterminado', { nota_expectativa: nota });

      const per = periodicidadeUnica(regime.esquema || '');
      if (!per) {
        return this.sem(regimenId, 'periodicidade_nao_derivavel', {
          nota_expectativa: nota,
          origem_detalhe: `periodicidades lidas no esquema: [${periodicidadesDoEsquema(regime.esquema || '').join(', ')}]`,
        });
      }
      periodicidade = per;
      ciclos = Math.round((meses * DIAS_POR_MES) / per);
      if (ciclos < 1) ciclos = 1;
      if (bloco.proxy === 'pfs') {
        origem = 'proxy_pfs';
        origemDetalhe = `${meses} meses de PFS mediana ÷ ${per} dias`;
        aviso = AVISO_PFS;
      } else {
        origem = 'duracao_reportada';
        origemDetalhe = `${meses} meses de duração mediana reportada ÷ ${per} dias`;
      }
    } else {
      return this.sem(regimenId, 'sem_expectativa_uso', { nota_expectativa: nota });
    }

    const custo = await this.custoRepo.findOne({ where: { regimen_id: regimenId } });
    if (!custo) {
      // Tempo resolvido mas sem preço: devolve o tempo (é informação legítima) e diz o
      // que falta, em vez de sumir com o bloco inteiro.
      return this.sem(regimenId, 'sem_preco_cadastrado', {
        ciclos_esperados: ciclos!,
        origem_ciclos: origem,
        origem_detalhe: origemDetalhe,
        periodicidade_dias: periodicidade,
        nota_expectativa: nota,
        aviso,
      });
    }

    return {
      regimen_id: regimenId,
      disponivel: true,
      ciclos_esperados: ciclos!,
      origem_ciclos: origem,
      origem_detalhe: origemDetalhe,
      periodicidade_dias: periodicidade,
      custo_ciclo: {
        min: custo.custo_ciclo_negociado,
        max: custo.custo_ciclo_tabela,
        fonte_min: custo.fonte_negociado,
        fonte_max: custo.fonte_tabela,
      },
      total_min: this.multiplicar(ciclos!, custo.custo_ciclo_negociado),
      total_max: this.multiplicar(ciclos!, custo.custo_ciclo_tabela),
      nota_expectativa: nota,
      aviso,
      selo: 'estimativa',
    };
  }

  async estimativas(ids: string[]): Promise<Estimativa[]> {
    return Promise.all([...new Set(ids)].map((id) => this.estimativa(id)));
  }

  // ---- agregado por paciente e de carteira ---------------------------------
  // Base: protocolo VIGENTE da trilha (mesma regra do resto do sistema — exceção
  // pendente ou negada não é o protocolo do paciente, então não entra no custo).
  private async vigentesPorPaciente(): Promise<Avaliacao[]> {
    return this.avaliacaoRepo
      .createQueryBuilder('a')
      .distinctOn(['a.paciente_id'])
      .where('a.autorizacao_estado IN (:...vigentes)', { vigentes: AUTORIZACAO_VIGENTE })
      .orderBy('a.paciente_id', 'ASC')
      .addOrderBy('a.data', 'DESC')
      .getMany();
  }

  async porPaciente(pacienteId: number) {
    const vigente = (await this.vigentesPorPaciente()).find((a) => a.paciente_id === pacienteId) || null;
    if (!vigente) {
      return { paciente_id: pacienteId, regimen_id: null, estimativa: null, sem_protocolo_vigente: true };
    }
    return {
      paciente_id: pacienteId,
      regimen_id: vigente.regimen_id,
      estimativa: await this.estimativa(vigente.regimen_id),
      sem_protocolo_vigente: false,
    };
  }

  // Total de carteira: soma só os pacientes cujo protocolo vigente TEM estimativa, e
  // reporta separadamente quantos ficaram de fora e por quê. Somar tratando "sem
  // estimativa" como zero diria que a carteira custa menos do que custa — que é
  // exatamente o erro que este módulo existe para não cometer.
  async carteira() {
    const vigentes = await this.vigentesPorPaciente();
    const pacientes = await this.pacienteRepo.find({ select: { id: true, nome: true } });
    const nomePorId = new Map(pacientes.map((p) => [p.id, p.nome]));
    const porRegime = new Map<string, Estimativa>();
    for (const id of new Set(vigentes.map((v) => v.regimen_id))) {
      porRegime.set(id, await this.estimativa(id));
    }

    let total_min = 0;
    let total_max = 0;
    const comEstimativa: any[] = [];
    const semEstimativa: any[] = [];
    let usaProxyPfs = false;
    for (const v of vigentes) {
      const e = porRegime.get(v.regimen_id)!;
      const linha = {
        paciente_id: v.paciente_id,
        paciente: nomePorId.get(v.paciente_id) || null,
        regimen_id: v.regimen_id,
      };
      if (e.disponivel) {
        total_min += Math.round(e.total_min! * 100);
        total_max += Math.round(e.total_max! * 100);
        if (e.origem_ciclos === 'proxy_pfs') usaProxyPfs = true;
        comEstimativa.push({ ...linha, total_min: e.total_min, total_max: e.total_max, origem_ciclos: e.origem_ciclos });
      } else {
        semEstimativa.push({ ...linha, motivo: e.motivo, explicacao: e.explicacao });
      }
    }
    return {
      pacientes_no_calculo: comEstimativa.length,
      pacientes_sem_estimativa: semEstimativa.length,
      total_min: total_min / 100,
      total_max: total_max / 100,
      aviso: usaProxyPfs ? AVISO_PFS : undefined,
      com_estimativa: comEstimativa,
      sem_estimativa: semEstimativa,
      selo: 'estimativa' as const,
    };
  }

  // Cobertura: quantos protocolos do corpus conseguem produzir estimativa hoje, e a FILA
  // do admin — os que já têm o TEMPO resolvido e só esperam preço. É o número que impede
  // a tela de parecer completa quando não é.
  async cobertura() {
    const regimes: any[] = this.evidencia.carregar()?.regimes || [];
    const comPreco = new Set((await this.custoRepo.find({ select: { regimen_id: true } })).map((c) => c.regimen_id));
    const contagem: Record<string, number> = {};
    const fila: any[] = [];
    for (const r of regimes) {
      const e = await this.estimativa(r.regimen_id);
      const chave = e.disponivel ? 'com_estimativa' : e.motivo!;
      contagem[chave] = (contagem[chave] || 0) + 1;
      if (!e.disponivel && e.motivo === 'sem_preco_cadastrado') {
        fila.push({
          regimen_id: r.regimen_id,
          nome: r.nome || r.regimen_id,
          tumor: r.tumor,
          esquema: r.esquema,
          ciclos_esperados: e.ciclos_esperados,
          origem_ciclos: e.origem_ciclos,
          origem_detalhe: e.origem_detalhe,
        });
      }
    }
    return {
      total_regimes: regimes.length,
      precos_cadastrados: comPreco.size,
      aguardando_preco: fila.length,
      por_situacao: contagem,
      fila_preco: fila,
    };
  }
}
