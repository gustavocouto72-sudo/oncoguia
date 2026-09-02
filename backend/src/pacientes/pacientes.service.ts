import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Avaliacao, Paciente, Retorno, SelecaoProtocolo, Semaforo } from '../database/entities';
import { estadoReestadiamento, hojeISO, somarMeses } from '../retornos/retornos.service';

// Payload de uma nova avaliação (reavaliação). data e avaliado_por são do servidor.
export interface NovaAvaliacao {
  regimen_id: string;
  linha_tratamento?: number;
  snapshot_campos: Record<string, any>;
  semaforo: Semaforo;
  detalhe_semaforo?: Record<string, any>;
  // Retorno que motivou esta avaliação (conduta = troca_protocolo). Fecha o ciclo
  // retorno → troca: a avaliação nova não fica solta na trilha.
  retorno_id?: number;
}

@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(Paciente) private pacienteRepo: Repository<Paciente>,
    @InjectRepository(SelecaoProtocolo) private selecaoRepo: Repository<SelecaoProtocolo>,
    @InjectRepository(Avaliacao) private avaliacaoRepo: Repository<Avaliacao>,
    @InjectRepository(Retorno) private retornoRepo: Repository<Retorno>,
  ) {}

  // Lista: nome, tumor, data da última avaliação e último semáforo (por paciente).
  async listar() {
    const pacientes = await this.pacienteRepo.find({ order: { id: 'ASC' } });
    if (!pacientes.length) return [];
    // Última avaliação por paciente, via subconsulta pela data máxima.
    const ultimas = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .distinctOn(['a.paciente_id'])
      .orderBy('a.paciente_id', 'ASC')
      .addOrderBy('a.data', 'DESC')
      .getMany();
    const totais = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .select('a.paciente_id', 'paciente_id')
      .addSelect('COUNT(*)', 'total')
      .groupBy('a.paciente_id')
      .getRawMany<{ paciente_id: number; total: string }>();
    const ultimaPorPac = new Map(ultimas.map((a) => [a.paciente_id, a]));
    const totalPorPac = new Map(totais.map((t) => [Number(t.paciente_id), Number(t.total)]));
    return pacientes.map((p) => {
      const u = ultimaPorPac.get(p.id);
      return {
        id: p.id,
        nome: p.nome,
        identificador: p.identificador,
        nasc: p.nasc,
        sexo: p.sexo,
        cidade: p.cidade,
        operadora: p.operadora,
        plano: p.plano,
        sistema: p.sistema,
        tumor: p.tumor,
        subtipo: p.subtipo,
        avaliacoes_total: totalPorPac.get(p.id) || 0,
        ultima_avaliacao: u ? u.data : null,
        ultimo_semaforo: u ? u.semaforo : null,
        ultimo_regimen_id: u ? u.regimen_id : null,
        ultima_linha: u ? u.linha_tratamento : null,
      };
    });
  }

  // Cadastro do paciente. O tumor é atributo do paciente (não escolha por visita);
  // valores_estaveis guarda os campos_primitivos com estavel:true (biologia imutável).
  criar(dados: Partial<Paciente>, usuarioId: number) {
    return this.pacienteRepo.save(
      this.pacienteRepo.create({ ...dados, criado_por: usuarioId }),
    );
  }

  // Correção cadastral: aplica só as chaves presentes no body e devolve o paciente completo.
  async atualizar(id: number, dados: Partial<Paciente>) {
    const p = await this.pacienteOr404(id);
    Object.assign(p, dados);
    await this.pacienteRepo.save(p);
    return this.obter(id);
  }

  // Remoção administrativa. Cascata explícita: avaliações e seleções do paciente saem
  // junto, independentemente do ON DELETE do banco (sem FK órfã).
  async remover(id: number) {
    await this.pacienteOr404(id);
    // retornos antes das avaliações: retornos.avaliacao_id referencia avaliacoes.
    await this.retornoRepo.delete({ paciente_id: id });
    await this.avaliacaoRepo.delete({ paciente_id: id });
    await this.selecaoRepo.delete({ paciente_id: id });
    await this.pacienteRepo.delete({ id });
    return { ok: true, id };
  }

  private async pacienteOr404(id: number) {
    const p = await this.pacienteRepo.findOne({
      where: { id },
      relations: { criadoPor: true },
    });
    if (!p) throw new NotFoundException('Paciente não encontrado');
    return p;
  }

  // Paciente + última avaliação (o "protocolo que ele estava") + linha do tempo resumida.
  async obter(id: number) {
    const p = await this.pacienteOr404(id);
    const avaliacoes = await this.avaliacaoRepo.find({
      where: { paciente_id: id },
      relations: { avaliadoPor: true },
      order: { data: 'DESC' },
    });
    const ultima = avaliacoes[0] || null;
    return {
      id: p.id,
      nome: p.nome,
      identificador: p.identificador,
      nasc: p.nasc,
      sexo: p.sexo,
      cidade: p.cidade,
      operadora: p.operadora,
      plano: p.plano,
      carteirinha: p.carteirinha,
      sistema: p.sistema,
      tumor: p.tumor,
      subtipo: p.subtipo,
      valores_estaveis: p.valores_estaveis || {},
      // Agenda de reestadiamento com "vencido" já derivado do relógio do SERVIDOR — a app
      // não decide o que está vencido a partir da data da máquina do usuário.
      reestadiamento: estadoReestadiamento(p),
      criado_em: p.criado_em,
      criado_por: p.criadoPor
        ? { id: p.criadoPor.id, nome: p.criadoPor.nome, perfil: p.criadoPor.perfil }
        : null,
      ultima_avaliacao: ultima ? this.mapAvaliacao(ultima) : null,
      // Linha do tempo resumida das avaliações anteriores (sem o snapshot completo).
      linha_do_tempo: avaliacoes.map((a) => ({
        id: a.id,
        data: a.data,
        linha_tratamento: a.linha_tratamento,
        regimen_id: a.regimen_id,
        semaforo: a.semaforo,
        avaliado_por: a.avaliadoPor ? a.avaliadoPor.nome : null,
      })),
    };
  }

  // Histórico completo, ordem cronológica (mais antiga → mais recente).
  async avaliacoes(pacienteId: number) {
    await this.pacienteOr404(pacienteId);
    const rows = await this.avaliacaoRepo.find({
      where: { paciente_id: pacienteId },
      relations: { avaliadoPor: true },
      order: { data: 'ASC' },
    });
    return rows.map((a) => this.mapAvaliacao(a));
  }

  // Cria uma nova avaliação: EMPILHA, nunca sobrescreve. data e avaliado_por do servidor.
  async criarAvaliacao(pacienteId: number, dados: NovaAvaliacao, usuarioId: number) {
    const paciente = await this.pacienteOr404(pacienteId);
    const nova = this.avaliacaoRepo.create({
      paciente_id: pacienteId,
      avaliado_por: usuarioId,
      regimen_id: dados.regimen_id,
      linha_tratamento: dados.linha_tratamento ?? null,
      snapshot_campos: dados.snapshot_campos,
      semaforo: dados.semaforo,
      detalhe_semaforo: dados.detalhe_semaforo ?? null,
      retorno_id: dados.retorno_id ?? null,
    });
    const salva = await this.avaliacaoRepo.save(nova);
    // Selecionar protocolo agenda o reestadiamento (padrão 3 meses, ajustável por paciente).
    // O relógio conta do dia da seleção; um retorno com imagem depois o reancora.
    const proximo = somarMeses(hojeISO(), paciente.intervalo_reestadiamento_meses ?? 3);
    if (proximo) await this.pacienteRepo.update({ id: pacienteId }, { proximo_reestadiamento: proximo });
    const full = await this.avaliacaoRepo.findOne({
      where: { id: salva.id },
      relations: { avaliadoPor: true },
    });
    return this.mapAvaliacao(full);
  }

  private mapAvaliacao(a: Avaliacao) {
    return {
      id: a.id,
      paciente_id: a.paciente_id,
      data: a.data,
      linha_tratamento: a.linha_tratamento,
      regimen_id: a.regimen_id,
      snapshot_campos: a.snapshot_campos,
      semaforo: a.semaforo,
      detalhe_semaforo: a.detalhe_semaforo,
      retorno_id: a.retorno_id ?? null,
      avaliado_por: a.avaliadoPor
        ? { id: a.avaliadoPor.id, nome: a.avaliadoPor.nome, perfil: a.avaliadoPor.perfil }
        : null,
    };
  }

  // ---- Seleções de protocolo (feature existente, mantida) ----
  async selecoes(pacienteId: number) {
    await this.pacienteOr404(pacienteId);
    const rows = await this.selecaoRepo.find({
      where: { paciente_id: pacienteId },
      relations: { selecionadoPor: true },
      order: { criado_em: 'DESC' },
    });
    return rows.map((s) => ({
      id: s.id,
      regimen_id: s.regimen_id,
      protocolo_nome: s.protocolo_nome,
      tumor: s.tumor,
      dados_clinicos: s.dados_clinicos,
      justificativa: s.justificativa,
      selecionado_por: s.selecionadoPor
        ? { id: s.selecionadoPor.id, nome: s.selecionadoPor.nome, perfil: s.selecionadoPor.perfil }
        : null,
      criado_em: s.criado_em,
    }));
  }
}
