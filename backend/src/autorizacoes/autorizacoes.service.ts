import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Avaliacao, AutorizacaoEstado } from '../database/entities';

export type FiltroAutorizacao = 'pendentes' | 'decididas' | 'todas';

export interface DecisaoAutorizacao {
  decisao: 'aprovada' | 'negada';
  parecer: string;
}

// Fila de solicitações de exceção + a decisão do auditor.
// A decisão é ÚNICA e IMUTÁVEL: só uma avaliação 'pendente' pode ser decidida, e uma vez
// decidida (aprovada ou negada) nunca mais muda — nova tentativa é uma nova avaliação,
// com uma nova solicitação. Negada não some da trilha: fica com o parecer visível.
@Injectable()
export class AutorizacoesService {
  constructor(@InjectRepository(Avaliacao) private avaliacaoRepo: Repository<Avaliacao>) {}

  async listar(filtro: FiltroAutorizacao = 'pendentes') {
    const estados: AutorizacaoEstado[] =
      filtro === 'decididas' ? ['aprovada', 'negada']
      : filtro === 'todas' ? ['pendente', 'aprovada', 'negada']
      : ['pendente'];
    const rows = await this.avaliacaoRepo.find({
      where: { autorizacao_estado: In(estados) },
      relations: { paciente: true, avaliadoPor: true, autorizacaoAuditor: true },
      order: { data: 'DESC' },
    });
    return rows.map((a) => this.map(a));
  }

  // Contadores da aba (fila x histórico) — uma chamada só, para o selo do menu.
  async contagem() {
    const rows = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .select('a.autorizacao_estado', 'estado')
      .addSelect('COUNT(*)', 'total')
      .where('a.autorizacao_estado <> :n', { n: 'nao_necessaria' })
      .groupBy('a.autorizacao_estado')
      .getRawMany<{ estado: AutorizacaoEstado; total: string }>();
    const por = (e: AutorizacaoEstado) => Number(rows.find((r) => r.estado === e)?.total || 0);
    return { pendentes: por('pendente'), aprovadas: por('aprovada'), negadas: por('negada') };
  }

  // Decisão do auditor. Parecer obrigatório NAS DUAS decisões (aprovar e negar) — sem ele,
  // 400. Só 'pendente' é decidível: 'nao_necessaria' não é solicitação e já decidida é final.
  async decidir(avaliacaoId: number, dados: DecisaoAutorizacao, auditorId: number) {
    const a = await this.avaliacaoRepo.findOne({ where: { id: avaliacaoId } });
    if (!a) throw new NotFoundException('Solicitação de exceção não encontrada');
    const parecer = String(dados.parecer ?? '').trim();
    if (!parecer) throw new BadRequestException('Parecer obrigatório para aprovar ou negar');
    if (parecer.length > 4000) throw new BadRequestException('Parecer muito longo (máx. 4000 caracteres)');
    if (a.autorizacao_estado === 'nao_necessaria') {
      throw new ConflictException('Esta avaliação não é uma solicitação de exceção');
    }
    if (a.autorizacao_estado !== 'pendente') {
      throw new ConflictException(
        `Solicitação já ${a.autorizacao_estado} — a decisão é única e imutável. Uma nova tentativa exige nova solicitação.`,
      );
    }
    // UPDATE condicionado ao estado pendente: duas decisões simultâneas, uma só vence.
    const res = await this.avaliacaoRepo.update(
      { id: avaliacaoId, autorizacao_estado: 'pendente' },
      {
        autorizacao_estado: dados.decisao,
        autorizacao_parecer: parecer,
        autorizacao_auditor_id: auditorId,
        autorizacao_decidida_em: new Date(),
      },
    );
    if (!res.affected) throw new ConflictException('Solicitação já decidida por outro auditor');
    const full = await this.avaliacaoRepo.findOne({
      where: { id: avaliacaoId },
      relations: { paciente: true, avaliadoPor: true, autorizacaoAuditor: true },
    });
    return this.map(full);
  }

  // Card da fila: o paciente (contexto clínico), o protocolo, o snapshot que gerou o
  // semáforo, o detalhe (critérios que falharam + a justificativa do médico na ressalva)
  // e quem pediu. A evidência do protocolo (selos/eixos/pivô com DOI) a app cruza pelo
  // regimen_id no corpus que já carrega de /evidencia.
  private map(a: Avaliacao) {
    const p = a.paciente;
    return {
      id: a.id,
      estado: a.autorizacao_estado,
      data: a.data,
      regimen_id: a.regimen_id,
      linha_tratamento: a.linha_tratamento,
      semaforo: a.semaforo,
      detalhe_semaforo: a.detalhe_semaforo,
      snapshot_campos: a.snapshot_campos,
      paciente: p
        ? {
            id: p.id, nome: p.nome, nasc: p.nasc, sexo: p.sexo,
            identificador: p.identificador, tumor: p.tumor, subtipo: p.subtipo,
            operadora: p.operadora, plano: p.plano,
          }
        : null,
      solicitante: a.avaliadoPor
        ? { id: a.avaliadoPor.id, nome: a.avaliadoPor.nome, perfil: a.avaliadoPor.perfil }
        : null,
      parecer: a.autorizacao_parecer,
      auditor: a.autorizacaoAuditor
        ? { id: a.autorizacaoAuditor.id, nome: a.autorizacaoAuditor.nome, perfil: a.autorizacaoAuditor.perfil }
        : null,
      decidida_em: a.autorizacao_decidida_em,
    };
  }
}
