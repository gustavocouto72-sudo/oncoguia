import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Apresentacao, CustoRegime, Insumo, Paciente, PremissasRecursos, UnidadeApresentacao,
} from '../database/entities';
import { EvidenciaService } from '../evidencia/evidencia.service';
import {
  Corpo, DIMENSAO_DA_APRESENTACAO, DIMENSAO_DA_DOSE, Frascos, UnidadeDose,
  arred, centavos, conteudoNaBase, frascosDoItem, quantidadePorAplicacao, reais, scMosteller,
} from './dose';

// De onde saiu o número que a tela mostra. É o campo mais importante da resposta: os três
// caminhos produzem R$ com precisões muito diferentes, e um deles não produz nada.
//   'insumo'             — decomposto por fármaco, frasco a frasco. O bom.
//   'protocolo-fallback' — o preço por ciclo cadastrado em custos_regime. Serve para
//                          compra; NÃO produz receita (aquela tabela não tem contrato).
//   'sem-dado'           — nem um nem outro. Nunca vira zero.
export type OrigemRecurso = 'insumo' | 'protocolo-fallback' | 'sem-dado';

// Por que o caminho por insumo não fechou. Vocabulário fechado para a tela poder explicar
// sem texto livre — e para o gestor saber o que fazer: cadastrar preço é ação dele,
// composição indeterminada não é.
export type MotivoSemInsumo =
  | 'composicao_indeterminada'
  | 'sem_composicao'
  | 'insumo_nao_cadastrado'
  | 'sem_apresentacao'
  | 'apresentacao_ambigua'
  | 'dimensao_incompativel';

const EXPLICACAO: Record<MotivoSemInsumo, string> = {
  sem_composicao: 'Protocolo sem bloco de composição no corpus publicado.',
  composicao_indeterminada:
    'Composição indeterminada no corpus: o texto do esquema tem faixa, alternativa entre fármacos ou uso contínuo, e derivar mg por aplicação exigiria escolher.',
  insumo_nao_cadastrado: 'Fármaco da composição sem insumo cadastrado.',
  sem_apresentacao: 'Insumo cadastrado sem nenhuma apresentação com preço.',
  apresentacao_ambigua:
    'Insumo com mais de uma apresentação e nenhuma marcada como padrão — a apresentação decide o desperdício, e escolher uma seria decisão nossa.',
  dimensao_incompativel:
    'Dose e apresentação em dimensões diferentes (massa × UI × GBq) — converter seria inventar equivalência.',
};

export interface ItemCalculado {
  farmaco: string;
  dose_valor: number;
  dose_unidade: UnidadeDose;
  via: string | null;
  dias_do_ciclo: number[] | null;
  origem_aplicacoes: 'dias_do_esquema' | 'unica_por_ciclo';
  apresentacao: { id: number; conteudo: string; conteudo_valor: number; conteudo_unidade: UnidadeApresentacao };
  frascos: Frascos;
  compra_min_ciclo: number;
  compra_max_ciclo: number;
  faturamento_ciclo: number | null;
  fonte_compra_min: string;
  fonte_compra_max: string;
  fonte_faturamento: string | null;
}

export interface CicloRecurso {
  regimen_id: string;
  origem: OrigemRecurso;
  motivo?: MotivoSemInsumo;
  explicacao?: string;
  // Itens que FALHARAM (quando origem !== 'insumo' por causa deles) — é a fila de
  // trabalho do cadastro, e o que impede a tela de parecer completa quando não é.
  pendencias: { farmaco: string; motivo: MotivoSemInsumo }[];
  itens: ItemCalculado[];
  compra_min_ciclo: number | null;
  compra_max_ciclo: number | null;
  faturamento_ciclo: number | null;
  // margem = faturamento − compra. O MÍNIMO da margem usa o MÁXIMO da compra: a pior
  // margem acontece quando o insumo custa o teto da faixa.
  margem_min_ciclo: number | null;
  margem_max_ciclo: number | null;
  premissas: Corpo;
  selo: 'estimativa';
}

// CÁLCULO puro de recursos, separado do serviço de PROJEÇÃO por um motivo estrutural:
// a ficha do paciente (auditor + admin) precisa da decomposição por insumo, e o
// controller que a serve vive no módulo de CUSTOS. Se o cálculo morasse junto da
// projeção — que depende de CustosService para o tempo de uso —, custos importaria
// recursos e recursos importaria custos. Cortado aqui, cada um importa só o que usa.
@Injectable()
export class RecursosCalculoService {
  constructor(
    @InjectRepository(Insumo) private insumoRepo: Repository<Insumo>,
    @InjectRepository(Apresentacao) private apresRepo: Repository<Apresentacao>,
    @InjectRepository(PremissasRecursos) private premRepo: Repository<PremissasRecursos>,
      @InjectRepository(CustoRegime) private custoRepo: Repository<CustoRegime>,
    private evidencia: EvidenciaService,
  ) {}

  // ---- cadastro de insumos e apresentações (admin) --------------------------
  listarInsumos() {
    return this.insumoRepo
      .createQueryBuilder('i')
      .leftJoinAndMapMany('i.apresentacoes', Apresentacao, 'a', 'a.insumo_id = i.id')
      .orderBy('i.farmaco', 'ASC')
      .addOrderBy('a.conteudo_valor', 'ASC')
      .getMany();
  }

  // Os fármacos que o CORPUS pede e o cadastro ainda não tem. É a fila do admin, montada
  // do lado de cá para ninguém precisar cruzar planilha com JSON na mão.
  async farmacosDoCorpus() {
    const regimes: any[] = this.evidencia.carregar()?.regimes || [];
    const uso = new Map<string, { farmaco: string; regimes: number; resolvidos: number }>();
    for (const r of regimes) {
      for (const it of (r?.composicao?.itens || [])) {
        const f = String(it.farmaco || '');
        if (!f) continue;
        const linha = uso.get(f) || { farmaco: f, regimes: 0, resolvidos: 0 };
        linha.regimes += 1;
        if (!it.indeterminado) linha.resolvidos += 1;
        uso.set(f, linha);
      }
    }
    const cadastrados = new Set((await this.insumoRepo.find()).map((i) => i.farmaco));
    return [...uso.values()]
      .map((l) => ({ ...l, cadastrado: cadastrados.has(l.farmaco) }))
      // Fila ordenada pelo que mais destrava: fármaco com mais itens RESOLVIDOS é o que
      // converte cadastro em projeção; o resto continua indeterminado mesmo com preço.
      .sort((a, b) => b.resolvidos - a.resolvidos || a.farmaco.localeCompare(b.farmaco));
  }

  async salvarInsumo(farmaco: string, usuarioId: number) {
    const nome = String(farmaco || '').trim();
    if (!nome) throw new BadRequestException('farmaco obrigatório');
    const existe = await this.insumoRepo.findOneBy({ farmaco: nome });
    if (existe) return existe;
    return this.insumoRepo.save(this.insumoRepo.create({ farmaco: nome, atualizado_por: usuarioId }));
  }

  async salvarApresentacao(
    id: number | null,
    dto: {
      insumo_id: number; conteudo: string; conteudo_valor: number;
      conteudo_unidade: UnidadeApresentacao; padrao?: boolean;
      preco_compra_tabela: number; preco_compra_negociado: number;
      preco_faturamento?: number | null;
      fonte_compra_tabela: string; fonte_compra_negociado: string;
      fonte_faturamento?: string | null;
    },
    usuarioId: number,
  ) {
    const insumo = await this.insumoRepo.findOneBy({ id: dto.insumo_id });
    if (!insumo) throw new BadRequestException(`Insumo ${dto.insumo_id} não existe`);
    if (dto.preco_compra_negociado > dto.preco_compra_tabela) {
      throw new BadRequestException(
        'preco_compra_negociado não pode ser maior que preco_compra_tabela — a faixa sairia invertida',
      );
    }
    // Faturamento e fonte entram JUNTOS ou nenhum entra. Preço sem rastro é número que a
    // tela não pode mostrar, e fonte sem preço é rastro de nada.
    const temPreco = dto.preco_faturamento !== undefined && dto.preco_faturamento !== null;
    const temFonte = !!String(dto.fonte_faturamento || '').trim();
    if (temPreco !== temFonte) {
      throw new BadRequestException(
        'preco_faturamento e fonte_faturamento entram juntos: preço de contrato sem fonte não vai para a tela, e fonte sem preço não projeta receita',
      );
    }
    // Uma padrão por insumo: desmarca a anterior ANTES de gravar (o índice único
    // parcial no banco recusaria a segunda, e o erro chegaria como 500 sem explicação).
    if (dto.padrao) {
      await this.apresRepo
        .createQueryBuilder()
        .update(Apresentacao)
        .set({ padrao: false })
        .where('insumo_id = :i', { i: dto.insumo_id })
        .execute();
    }
    const linha = this.apresRepo.create({
      ...(id ? { id } : {}),
      insumo_id: dto.insumo_id,
      conteudo: dto.conteudo.trim(),
      conteudo_valor: dto.conteudo_valor,
      conteudo_unidade: dto.conteudo_unidade,
      padrao: !!dto.padrao,
      preco_compra_tabela: dto.preco_compra_tabela,
      preco_compra_negociado: dto.preco_compra_negociado,
      preco_faturamento: temPreco ? dto.preco_faturamento! : null,
      fonte_compra_tabela: dto.fonte_compra_tabela.trim(),
      fonte_compra_negociado: dto.fonte_compra_negociado.trim(),
      fonte_faturamento: temFonte ? String(dto.fonte_faturamento).trim() : null,
      atualizado_por: usuarioId,
    });
    return this.apresRepo.save(linha);
  }

  // Remoção de insumo (com as apresentações, por ON DELETE CASCADE). Existe porque
  // cadastro errado tem de poder sair: um fármaco digitado com grafia que não casa com o
  // léxico da composição fica invisível para o cálculo e visível na lista, e a única
  // correção honesta é apagar e cadastrar de novo com o nome certo.
  async removerInsumo(id: number) {
    const linha = await this.insumoRepo.findOneBy({ id });
    if (!linha) throw new NotFoundException('Insumo não encontrado');
    await this.insumoRepo.delete({ id });
    return { removido: id };
  }

  async removerApresentacao(id: number) {
    const linha = await this.apresRepo.findOneBy({ id });
    if (!linha) throw new NotFoundException('Apresentação não encontrada');
    await this.apresRepo.delete({ id });
    return { removido: id };
  }

  // ---- premissas do paciente-padrão ----------------------------------------
  async premissas(): Promise<PremissasRecursos> {
    const p = await this.premRepo.findOneBy({ id: 1 });
    if (!p) {
      // A migration semeia a linha; se ela sumiu, recriar com os valores DECLARADOS na
      // especificação é melhor que devolver 500 — e a tela continua mostrando quais são.
      return this.premRepo.save(
        this.premRepo.create({ id: 1, sc_m2: 1.75, peso_kg: 70, clearance_ml_min: 100 }),
      );
    }
    return p;
  }

  async salvarPremissas(
    dto: { sc_m2: number; peso_kg: number; clearance_ml_min: number },
    usuarioId: number,
  ) {
    await this.premRepo.save({ id: 1, ...dto, atualizado_por: usuarioId });
    return this.premissas();
  }

  // ---- corpo do cálculo ----------------------------------------------------
  // Padrão declarado, refinado pelo paciente quando ele TEM as medidas. Cada eixo é
  // refinado por conta própria: peso real com altura ausente melhora o mg/kg e deixa o
  // mg/m² no padrão — e a resposta diz isso em `origem_sc` / `origem_peso`.
  private corpoDe(prem: PremissasRecursos, paciente?: Paciente | null): Corpo {
    const peso = paciente?.peso_kg ?? null;
    const altura = paciente?.altura_cm ?? null;
    const temSC = peso !== null && altura !== null;
    return {
      sc_m2: temSC ? arred(scMosteller(peso!, altura!), 2) : Number(prem.sc_m2),
      peso_kg: peso !== null ? Number(peso) : Number(prem.peso_kg),
      clearance_ml_min: Number(prem.clearance_ml_min),
      origem_sc: temSC ? 'paciente' : 'padrao_declarado',
      origem_peso: peso !== null ? 'paciente' : 'padrao_declarado',
      // Clearance real exigiria creatinina, que não é campo do cadastro. Enquanto não
      // for, é sempre o declarado — e a tela precisa dizer.
      origem_clearance: 'padrao_declarado',
    };
  }

  private regimePorId(regimenId: string): any | null {
    const regimes: any[] = this.evidencia.carregar()?.regimes || [];
    return regimes.find((r) => String(r?.regimen_id) === String(regimenId)) || null;
  }

  // Apresentação que o cálculo usa: a marcada `padrao`; se não houver marcação e existir
  // exatamente UMA, essa. Mais de uma sem marcação devolve null — o servidor não escolhe.
  private apresentacaoDe(lista: Apresentacao[]): Apresentacao | 'ambigua' | null {
    if (!lista.length) return null;
    const marcada = lista.find((a) => a.padrao);
    if (marcada) return marcada;
    return lista.length === 1 ? lista[0] : 'ambigua';
  }

  // ---- custo/receita de UM ciclo do protocolo ------------------------------
  async cicloDoRegime(
    regimenId: string,
    ctx: {
      insumos: Map<string, Insumo>;
      apres: Map<number, Apresentacao[]>;
      precos: Map<string, CustoRegime>;
      corpo: Corpo;
    },
  ): Promise<CicloRecurso> {
    const base = {
      regimen_id: regimenId,
      itens: [] as ItemCalculado[],
      pendencias: [] as { farmaco: string; motivo: MotivoSemInsumo }[],
      premissas: ctx.corpo,
      selo: 'estimativa' as const,
    };
    const fallback = (motivo: MotivoSemInsumo, pend: typeof base.pendencias = []): CicloRecurso => {
      const preco = ctx.precos.get(regimenId);
      if (preco) {
        return {
          ...base, pendencias: pend, origem: 'protocolo-fallback', motivo, explicacao: EXPLICACAO[motivo],
          compra_min_ciclo: Number(preco.custo_ciclo_negociado),
          compra_max_ciclo: Number(preco.custo_ciclo_tabela),
          // custos_regime não tem preço de contrato. Sem receita, sem margem — e nunca
          // herdando a compra, que produziria margem zero.
          faturamento_ciclo: null, margem_min_ciclo: null, margem_max_ciclo: null,
        };
      }
      return {
        ...base, pendencias: pend, origem: 'sem-dado', motivo, explicacao: EXPLICACAO[motivo],
        compra_min_ciclo: null, compra_max_ciclo: null,
        faturamento_ciclo: null, margem_min_ciclo: null, margem_max_ciclo: null,
      };
    };

    const regime = this.regimePorId(regimenId);
    const comp = regime?.composicao;
    if (!comp) return fallback('sem_composicao');
    // Composição parcial NÃO é usada nem "pelo que dá": somar os itens resolvidos e
    // ignorar o resto entrega um custo menor que o real com cara de completo.
    if (!comp.completa) return fallback('composicao_indeterminada');

    const itens: ItemCalculado[] = [];
    const pendencias: { farmaco: string; motivo: MotivoSemInsumo }[] = [];
    let compraMin = 0, compraMax = 0, faturamento = 0;
    let faturamentoCompleto = true;

    for (const it of comp.itens || []) {
      const farmaco = String(it.farmaco);
      const insumo = ctx.insumos.get(farmaco);
      if (!insumo) { pendencias.push({ farmaco, motivo: 'insumo_nao_cadastrado' }); continue; }
      const escolha = this.apresentacaoDe(ctx.apres.get(insumo.id) || []);
      if (escolha === null) { pendencias.push({ farmaco, motivo: 'sem_apresentacao' }); continue; }
      if (escolha === 'ambigua') { pendencias.push({ farmaco, motivo: 'apresentacao_ambigua' }); continue; }
      const un = it.dose_unidade as UnidadeDose;
      if (DIMENSAO_DA_DOSE[un] !== DIMENSAO_DA_APRESENTACAO[escolha.conteudo_unidade]) {
        pendencias.push({ farmaco, motivo: 'dimensao_incompativel' }); continue;
      }

      const dias: number[] | null = it.dias_do_ciclo || null;
      // Sem dias escritos, UMA aplicação por ciclo. Não é chute: o extrator já derruba
      // para indeterminado tudo que é semanal, contínuo ou intra-diário sem dias — o que
      // sobra sem dias é o esquema de aplicação única ("Docetaxel 75 mg/m² a cada 21
      // dias"). Ainda assim vai rotulado, porque é uma leitura e não um dado escrito.
      const aplicacoes = dias?.length || 1;
      const qtd = quantidadePorAplicacao(Number(it.dose_valor), un, ctx.corpo);
      const conteudo = conteudoNaBase(Number(escolha.conteudo_valor), escolha.conteudo_unidade);
      const frascos = frascosDoItem(qtd, conteudo, aplicacoes);

      const cMin = centavos(Number(escolha.preco_compra_negociado)) * frascos.frascos_por_ciclo;
      const cMax = centavos(Number(escolha.preco_compra_tabela)) * frascos.frascos_por_ciclo;
      const fat = escolha.preco_faturamento === null || escolha.preco_faturamento === undefined
        ? null
        : centavos(Number(escolha.preco_faturamento)) * frascos.frascos_por_ciclo;
      compraMin += cMin; compraMax += cMax;
      if (fat === null) faturamentoCompleto = false; else faturamento += fat;

      itens.push({
        farmaco, dose_valor: Number(it.dose_valor), dose_unidade: un, via: it.via ?? null,
        dias_do_ciclo: dias,
        origem_aplicacoes: dias ? 'dias_do_esquema' : 'unica_por_ciclo',
        apresentacao: {
          id: escolha.id, conteudo: escolha.conteudo,
          conteudo_valor: Number(escolha.conteudo_valor), conteudo_unidade: escolha.conteudo_unidade,
        },
        frascos,
        compra_min_ciclo: reais(cMin), compra_max_ciclo: reais(cMax),
        faturamento_ciclo: fat === null ? null : reais(fat),
        fonte_compra_min: escolha.fonte_compra_negociado,
        fonte_compra_max: escolha.fonte_compra_tabela,
        fonte_faturamento: escolha.fonte_faturamento ?? null,
      });
    }

    // Uma pendência derruba o protocolo inteiro para o fallback: um ciclo montado com
    // três dos quatro fármacos é mais perigoso que nenhum, porque parece completo.
    if (pendencias.length || !itens.length) {
      return fallback(pendencias[0]?.motivo || 'insumo_nao_cadastrado', pendencias);
    }

    const fat = faturamentoCompleto ? faturamento : null;
    return {
      ...base, itens, pendencias: [],
      origem: 'insumo',
      compra_min_ciclo: reais(compraMin), compra_max_ciclo: reais(compraMax),
      faturamento_ciclo: fat === null ? null : reais(fat),
      // Pior margem com a compra no teto; melhor margem com a compra no negociado.
      margem_min_ciclo: fat === null ? null : reais(fat - compraMax),
      margem_max_ciclo: fat === null ? null : reais(fat - compraMin),
    };
  }

  async contexto(paciente?: Paciente | null) {
    const [insumos, apresentacoes, precos, prem] = await Promise.all([
      this.insumoRepo.find(),
      this.apresRepo.find(),
      this.custoRepo.find(),
      this.premissas(),
    ]);
    const apres = new Map<number, Apresentacao[]>();
    for (const a of apresentacoes) {
      if (!apres.has(a.insumo_id)) apres.set(a.insumo_id, []);
      apres.get(a.insumo_id)!.push(a);
    }
    return {
      insumos: new Map(insumos.map((i) => [i.farmaco, i])),
      apres,
      precos: new Map(precos.map((c) => [c.regimen_id, c])),
      corpo: this.corpoDe(prem, paciente),
    };
  }

  async porRegime(regimenId: string): Promise<CicloRecurso> {
    return this.cicloDoRegime(regimenId, await this.contexto());
  }

  // Decomposição do ciclo com as medidas REAIS do paciente quando existem — é a versão
  // que a ficha do paciente mostra (auditor + admin). Mesma conta, corpo diferente: e a
  // resposta carrega `premissas` dizendo qual dos dois corpos foi usado em cada eixo.
  async porRegimeEPaciente(regimenId: string, paciente: Paciente | null): Promise<CicloRecurso> {
    return this.cicloDoRegime(regimenId, await this.contexto(paciente));
  }

  // Cobertura: quantos protocolos do corpus conseguem chegar ao nível de INSUMO hoje, e
  // por que os outros não. É o número que impede a tela de parecer completa.
  async cobertura() {
    const regimes: any[] = this.evidencia.carregar()?.regimes || [];
    const ctx = await this.contexto();
    const contagem: Record<string, number> = {};
    const faltando = new Map<string, number>();
    for (const r of regimes) {
      const c = await this.cicloDoRegime(r.regimen_id, ctx);
      const chave = c.origem === 'insumo' ? 'insumo' : `${c.origem}:${c.motivo}`;
      contagem[chave] = (contagem[chave] || 0) + 1;
      for (const p of c.pendencias) {
        if (p.motivo === 'insumo_nao_cadastrado') {
          faltando.set(p.farmaco, (faltando.get(p.farmaco) || 0) + 1);
        }
      }
    }
    return {
      total_regimes: regimes.length,
      por_situacao: contagem,
      farmacos_sem_insumo: [...faltando.entries()]
        .map(([farmaco, regimes]) => ({ farmaco, regimes }))
        .sort((a, b) => b.regimes - a.regimes),
    };
  }
}
