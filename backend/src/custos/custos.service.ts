import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AUTORIZACAO_VIGENTE, Avaliacao, CustoRegime, Paciente } from '../database/entities';
import { EvidenciaService } from '../evidencia/evidencia.service';
import { RecursosCalculoService } from '../recursos/recursos-calculo.service';
import { periodicidadesDoEsquema, periodicidadeUnica } from './periodicidade';

// Dias por mês usados na conversão tempo→ciclos. 30.4 é o valor fixado na especificação
// desta fase (365.25/12 = 30.44); fica explícito aqui para o portão poder conferir a
// aritmética contra o mesmo número.
const DIAS_POR_MES = 30.4;

export const AVISO_PFS =
  'Estimativa por PFS é piso: tratamento costuma exceder a progressão.';

// USO e CUSTO são duas perguntas independentes, e a resposta de uma não pode sequestrar a
// da outra. "Quantas aplicações este paciente deve receber?" é dado clínico do corpus;
// "quanto custa" depende de alguém ter cadastrado preço. Antes as duas vinham num
// `disponivel` só, e um protocolo com tempo perfeitamente derivável sumia da tela inteira
// por falta de preço — escondendo informação que já existia.
export type MotivoSemUso =
  | 'regime_desconhecido'
  | 'sem_expectativa_uso'
  | 'tempo_indeterminado'
  | 'ciclos_nao_derivaveis'
  | 'periodicidade_nao_derivavel';

export type MotivoSemCusto = 'sem_preco_cadastrado' | 'sem_uso_derivavel';

// Texto que a app mostra. Fica no SERVIDOR para que o motivo seja sempre a mesma frase —
// e nunca um zero, nem um campo vazio que o usuário leia como "custo baixo".
const EXPLICACAO: Record<MotivoSemUso | MotivoSemCusto, string> = {
  regime_desconhecido: 'Protocolo não encontrado no corpus publicado.',
  sem_expectativa_uso: 'Protocolo sem bloco de expectativa de uso no corpus.',
  tempo_indeterminado:
    'Tempo de uso indeterminado: o pivotal não reporta duração nem PFS mediana, ou o esquema não fecha um número de ciclos.',
  ciclos_nao_derivaveis:
    'Duração fixa declarada em tempo contínuo, sem contagem de ciclos — o preço por ciclo não se aplica.',
  periodicidade_nao_derivavel:
    'Periodicidade não derivável do esquema, e o preço não declara o período que cobre — converter tempo em aplicações exigiria chutar o intervalo.',
  sem_preco_cadastrado: 'Custo por ciclo ainda não cadastrado para este protocolo.',
  sem_uso_derivavel: 'Sem tempo de uso derivável — não há por quanto multiplicar o preço.',
};

// De onde saiu o intervalo entre aplicações. 'periodo_declarado' é ADMINISTRATIVO: quem
// cadastrou o preço declarou quantos dias ele cobre. Não é extração clínica, e a tela
// precisa dizer isso — por isso é campo próprio, e não um detalhe de texto.
export type OrigemPeriodicidade = 'esquema' | 'periodo_declarado';

export interface BlocoUso {
  disponivel: boolean;
  motivo?: MotivoSemUso;
  explicacao?: string;
  ciclos_esperados?: number;
  origem_ciclos?: 'esquema' | 'proxy_pfs' | 'duracao_reportada';
  origem_detalhe?: string;
  periodicidade_dias?: number;
  periodicidade_origem?: OrigemPeriodicidade;
  duracao_meses?: number;
  nota_expectativa?: string;
  aviso?: string;
}

export interface BlocoCusto {
  disponivel: boolean;
  motivo?: MotivoSemCusto;
  explicacao?: string;
  custo_ciclo?: { min: number; max: number; fonte_min: string; fonte_max: string };
  periodo_dias?: number | null;
  total_min?: number;
  total_max?: number;
}

export interface Estimativa {
  regimen_id: string;
  uso: BlocoUso;
  custo: BlocoCusto;
  selo: 'estimativa';
}

@Injectable()
export class CustosService {
  constructor(
    @InjectRepository(CustoRegime) private custoRepo: Repository<CustoRegime>,
    @InjectRepository(Avaliacao) private avaliacaoRepo: Repository<Avaliacao>,
    @InjectRepository(Paciente) private pacienteRepo: Repository<Paciente>,
    private evidencia: EvidenciaService,
    private recursos: RecursosCalculoService,
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
      periodo_dias?: number | null;
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
    // periodo_dias ausente/vazio grava NULL — "não declarado" e "30 dias" são coisas
    // diferentes, e a segunda nunca é assumida.
    const periodo =
      dto.periodo_dias === undefined || dto.periodo_dias === null ? null : Number(dto.periodo_dias);
    await this.custoRepo.save({
      regimen_id: regimenId,
      custo_ciclo_tabela: dto.custo_ciclo_tabela,
      custo_ciclo_negociado: dto.custo_ciclo_negociado,
      fonte_tabela: dto.fonte_tabela.trim(),
      fonte_negociado: dto.fonte_negociado.trim(),
      periodo_dias: periodo,
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

  private semUso(regimen_id: string, motivo: MotivoSemUso, extra?: Partial<BlocoUso>): Estimativa {
    return {
      regimen_id,
      uso: { disponivel: false, motivo, explicacao: EXPLICACAO[motivo], ...extra },
      custo: { disponivel: false, motivo: 'sem_uso_derivavel', explicacao: EXPLICACAO.sem_uso_derivavel },
      selo: 'estimativa',
    };
  }

  // Centavos na multiplicação: ciclos x preço em reais com casa decimal acumula erro de
  // ponto flutuante (0.1+0.2), e um total de carteira somando centenas de protocolos
  // amplifica o desvio. Multiplica inteiro, divide no fim.
  private multiplicar(ciclos: number, reais: number): number {
    return Math.round(ciclos * Math.round(reais * 100)) / 100;
  }

  // `precos` opcional: quem chama em LOTE (cobertura, carteira, estimativas) carrega a
  // tabela inteira UMA vez e passa aqui. Sem isso cada regime fazia o seu próprio
  // findOne — 295 idas ao Neon numa chamada só, 13,8s de resposta, e a tela do admin
  // ficava em "Carregando…" tempo suficiente para o portão desistir.
  async estimativa(regimenId: string, precos?: Map<string, CustoRegime>): Promise<Estimativa> {
    const regime = this.regimePorId(regimenId);
    if (!regime) return this.semUso(regimenId, 'regime_desconhecido');
    const bloco = regime.expectativa_uso;
    if (!bloco) return this.semUso(regimenId, 'sem_expectativa_uso');

    const nota = bloco.nota || undefined;
    // Indeterminado no corpus é indeterminado aqui: a Fase 1 já decidiu que não há número
    // honesto, e o custo não inventa um.
    if (bloco.indeterminado) return this.semUso(regimenId, 'tempo_indeterminado', { nota_expectativa: nota });

    // O preço é lido ANTES de decidir a periodicidade: quando o esquema não dá o
    // intervalo, o período declarado no cadastro pode dar. Sem isso, o oral contínuo
    // ficava sem uso derivável mesmo com o dado disponível ao lado.
    const custo = precos
      ? precos.get(regimenId) || null
      : await this.custoRepo.findOne({ where: { regimen_id: regimenId } });

    let ciclos: number | null = null;
    let origem: BlocoUso['origem_ciclos'];
    let origemDetalhe = '';
    let periodicidade: number | undefined;
    let periodicidadeOrigem: OrigemPeriodicidade | undefined;
    let duracaoMeses: number | undefined;
    let aviso: string | undefined;

    if (bloco.tipo === 'fixa') {
      if (typeof bloco.ciclos !== 'number' || !bloco.ciclos) {
        // Ex.: olaparibe "por 2 anos" — duração fixa declarada em tempo contínuo, sem
        // contagem de ciclos. Aqui o período declarado NÃO resolve: o problema não é o
        // intervalo, é que o corpus não fecha um número de aplicações.
        return this.semUso(regimenId, 'ciclos_nao_derivaveis', { nota_expectativa: nota });
      }
      ciclos = bloco.ciclos;
      periodicidade = bloco.periodicidade_dias ?? undefined;
      periodicidadeOrigem = periodicidade ? 'esquema' : undefined;
      origem = 'esquema';
      origemDetalhe = `${bloco.ciclos} ciclos declarados no esquema`;
    } else if (bloco.tipo === 'ate_progressao') {
      const meses =
        typeof bloco.duracao_mediana_tratamento_meses === 'number'
          ? bloco.duracao_mediana_tratamento_meses
          : typeof bloco.pfs_mediana_meses === 'number'
            ? bloco.pfs_mediana_meses
            : null;
      if (meses === null) return this.semUso(regimenId, 'tempo_indeterminado', { nota_expectativa: nota });
      duracaoMeses = meses;

      // 1º o esquema (clínico); 2º o período declarado no cadastro (administrativo).
      // Nesta ordem: o que o protocolo afirma vence o que alguém digitou.
      const doEsquema = periodicidadeUnica(regime.esquema || '');
      const declarado = custo && custo.periodo_dias ? Number(custo.periodo_dias) : null;
      const per = doEsquema ?? declarado;
      if (!per) {
        return this.semUso(regimenId, 'periodicidade_nao_derivavel', {
          nota_expectativa: nota,
          duracao_meses: meses,
          origem_detalhe: `periodicidades lidas no esquema: [${periodicidadesDoEsquema(regime.esquema || '').join(', ')}]`,
        });
      }
      periodicidade = per;
      periodicidadeOrigem = doEsquema ? 'esquema' : 'periodo_declarado';
      ciclos = Math.max(1, Math.round((meses * DIAS_POR_MES) / per));
      const sufixo =
        periodicidadeOrigem === 'periodo_declarado'
          ? `${meses} meses ÷ período declarado de ${per} dias`
          : `${meses} meses ÷ ${per} dias`;
      if (bloco.proxy === 'pfs') {
        origem = 'proxy_pfs';
        origemDetalhe = `${sufixo} (PFS mediana do pivotal)`;
        aviso = AVISO_PFS;
      } else {
        origem = 'duracao_reportada';
        origemDetalhe = `${sufixo} (duração mediana reportada no pivotal)`;
      }
    } else {
      return this.semUso(regimenId, 'sem_expectativa_uso', { nota_expectativa: nota });
    }

    // USO resolvido — renderiza haja preço ou não.
    const uso: BlocoUso = {
      disponivel: true,
      ciclos_esperados: ciclos!,
      origem_ciclos: origem,
      origem_detalhe: origemDetalhe,
      periodicidade_dias: periodicidade,
      periodicidade_origem: periodicidadeOrigem,
      duracao_meses: duracaoMeses,
      nota_expectativa: nota,
      aviso,
    };

    if (!custo) {
      return {
        regimen_id: regimenId,
        uso,
        custo: { disponivel: false, motivo: 'sem_preco_cadastrado', explicacao: EXPLICACAO.sem_preco_cadastrado },
        selo: 'estimativa',
      };
    }

    return {
      regimen_id: regimenId,
      uso,
      custo: {
        disponivel: true,
        custo_ciclo: {
          min: custo.custo_ciclo_negociado,
          max: custo.custo_ciclo_tabela,
          fonte_min: custo.fonte_negociado,
          fonte_max: custo.fonte_tabela,
        },
        periodo_dias: custo.periodo_dias ?? null,
        total_min: this.multiplicar(ciclos!, custo.custo_ciclo_negociado),
        total_max: this.multiplicar(ciclos!, custo.custo_ciclo_tabela),
      },
      selo: 'estimativa',
    };
  }

  private async mapaPrecos(): Promise<Map<string, CustoRegime>> {
    return new Map((await this.custoRepo.find()).map((c) => [c.regimen_id, c]));
  }

  async estimativas(ids: string[]): Promise<Estimativa[]> {
    const precos = await this.mapaPrecos();
    return Promise.all([...new Set(ids)].map((id) => this.estimativa(id, precos)));
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
      return { paciente_id: pacienteId, regimen_id: null, estimativa: null, recursos: null, sem_protocolo_vigente: true };
    }
    // DUAS leituras do mesmo protocolo, lado a lado na ficha, de propósito:
    //   • `estimativa` — preço por CICLO do protocolo x ciclos esperados (custos_regime);
    //   • `recursos`   — decomposição por INSUMO, frasco a frasco, com as medidas REAIS
    //                    do paciente quando existem e o padrão declarado quando não.
    // A segunda só fecha para uma minoria dos protocolos (a composição do corpus é
    // indeterminada em 90%), e quando não fecha ela mesma diz por quê. Nenhuma das duas
    // substitui a outra em silêncio: a tela mostra a origem de cada número.
    const paciente = await this.pacienteRepo.findOneBy({ id: pacienteId });
    return {
      paciente_id: pacienteId,
      regimen_id: vigente.regimen_id,
      estimativa: await this.estimativa(vigente.regimen_id),
      recursos: await this.recursos.porRegimeEPaciente(vigente.regimen_id, paciente),
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
    const precos = await this.mapaPrecos();
    const porRegime = new Map<string, Estimativa>();
    for (const id of new Set(vigentes.map((v) => v.regimen_id))) {
      porRegime.set(id, await this.estimativa(id, precos));
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
      // Só entra na SOMA quem tem custo. Uso sem preço não vira zero: fica na lista de
      // fora, com o motivo — e o motivo diz que falta preço, não que falta tempo.
      if (e.custo.disponivel) {
        total_min += Math.round(e.custo.total_min! * 100);
        total_max += Math.round(e.custo.total_max! * 100);
        if (e.uso.origem_ciclos === 'proxy_pfs') usaProxyPfs = true;
        comEstimativa.push({
          ...linha, total_min: e.custo.total_min, total_max: e.custo.total_max,
          origem_ciclos: e.uso.origem_ciclos, ciclos_esperados: e.uso.ciclos_esperados,
        });
      } else {
        semEstimativa.push({
          ...linha,
          motivo: e.custo.motivo,
          explicacao: e.custo.explicacao,
          // Uso derivável sem preço é informação útil: mostra o que já se sabe.
          ciclos_esperados: e.uso.disponivel ? e.uso.ciclos_esperados : undefined,
          uso_disponivel: e.uso.disponivel,
        });
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
    const precos = await this.mapaPrecos();
    const comPreco = new Set(precos.keys());
    const contagem: Record<string, number> = {};
    const fila: any[] = [];
    for (const r of regimes) {
      const e = await this.estimativa(r.regimen_id, precos);
      const chave = e.custo.disponivel ? 'com_estimativa' : e.uso.disponivel ? 'sem_preco_cadastrado' : e.uso.motivo!;
      contagem[chave] = (contagem[chave] || 0) + 1;
      if (e.uso.disponivel && !e.custo.disponivel) {
        fila.push({
          regimen_id: r.regimen_id,
          nome: r.nome || r.regimen_id,
          tumor: r.tumor,
          esquema: r.esquema,
          ciclos_esperados: e.uso.ciclos_esperados,
          origem_ciclos: e.uso.origem_ciclos,
          origem_detalhe: e.uso.origem_detalhe,
        });
      }
    }
    return {
      total_regimes: regimes.length,
      precos_cadastrados: comPreco.size,
      aguardando_preco: fila.length,
      // Quantos protocolos têm USO derivável — o teto do que o cadastro de preço pode
      // transformar em estimativa de custo. O resto não vira custo nem com preço.
      com_uso_derivavel: (contagem['com_estimativa'] || 0) + fila.length,
      por_situacao: contagem,
      fila_preco: fila,
    };
  }
}
