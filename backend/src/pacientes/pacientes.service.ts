import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AUTORIZACAO_VIGENTE, Avaliacao, AutorizacaoEstado, Paciente, SelecaoProtocolo, Semaforo,
} from '../database/entities';
import { EvidenciaService } from '../evidencia/evidencia.service';

// Payload de uma nova avaliação (reavaliação). data e avaliado_por são do servidor.
export interface NovaAvaliacao {
  regimen_id: string;
  linha_tratamento?: number;
  snapshot_campos: Record<string, any>;
  semaforo: Semaforo;
  detalhe_semaforo?: Record<string, any>;
  // Solicitação de exceção: a app manda 'pendente' ao selecionar um protocolo Inelegível
  // ou Não incorporado. Só estes dois valores são aceitos na criação — 'aprovada'/'negada'
  // são do auditor, nunca de quem registra a avaliação.
  autorizacao_estado?: Extract<AutorizacaoEstado, 'nao_necessaria' | 'pendente'>;
}

@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(Paciente) private pacienteRepo: Repository<Paciente>,
    @InjectRepository(SelecaoProtocolo) private selecaoRepo: Repository<SelecaoProtocolo>,
    @InjectRepository(Avaliacao) private avaliacaoRepo: Repository<Avaliacao>,
    private evidencia: EvidenciaService,
  ) {}

  // Lista: nome, tumor, data da última avaliação e último semáforo (por paciente).
  async listar() {
    const pacientes = await this.pacienteRepo.find({ order: { id: 'ASC' } });
    if (!pacientes.length) return [];
    // Última avaliação VIGENTE por paciente (via data máxima). Solicitação de exceção
    // pendente — ou negada — não é o protocolo do paciente: não entra aqui.
    const ultimas = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .distinctOn(['a.paciente_id'])
      .where('a.autorizacao_estado IN (:...vigentes)', { vigentes: AUTORIZACAO_VIGENTE })
      .orderBy('a.paciente_id', 'ASC')
      .addOrderBy('a.data', 'DESC')
      .getMany();
    // Exceções aguardando auditor, por paciente (selo ⏳ na lista).
    const pendentes = await this.avaliacaoRepo
      .createQueryBuilder('a')
      .select('a.paciente_id', 'paciente_id')
      .addSelect('COUNT(*)', 'total')
      .where('a.autorizacao_estado = :e', { e: 'pendente' })
      .groupBy('a.paciente_id')
      .getRawMany<{ paciente_id: number; total: string }>();
    const pendentePorPac = new Map(pendentes.map((t) => [Number(t.paciente_id), Number(t.total)]));
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
        autorizacoes_pendentes: pendentePorPac.get(p.id) || 0,
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
      relations: { avaliadoPor: true, autorizacaoAuditor: true },
      order: { data: 'DESC' },
    });
    // Protocolo vigente = última avaliação que NÃO depende de autorização pendente e não
    // foi negada. A pendente/negada continua na linha do tempo, com o seu estado.
    const ultima = avaliacoes.find((a) => AUTORIZACAO_VIGENTE.includes(a.autorizacao_estado)) || null;
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
        autorizacao_estado: a.autorizacao_estado,
        autorizacao_parecer: a.autorizacao_parecer,
        autorizacao_auditor: a.autorizacaoAuditor ? a.autorizacaoAuditor.nome : null,
        autorizacao_decidida_em: a.autorizacao_decidida_em,
      })),
    };
  }

  // Histórico completo, ordem cronológica (mais antiga → mais recente).
  async avaliacoes(pacienteId: number) {
    await this.pacienteOr404(pacienteId);
    const rows = await this.avaliacaoRepo.find({
      where: { paciente_id: pacienteId },
      relations: { avaliadoPor: true, autorizacaoAuditor: true },
      order: { data: 'ASC' },
    });
    return rows.map((a) => this.mapAvaliacao(a));
  }

  // Cria uma nova avaliação: EMPILHA, nunca sobrescreve. data e avaliado_por do servidor.
  async criarAvaliacao(pacienteId: number, dados: NovaAvaliacao, usuarioId: number) {
    await this.pacienteOr404(pacienteId);
    // Solicitação de exceção — decidida NO SERVIDOR, não pela app. A app manda
    // 'pendente' (é o que pinta o botão "Selecionar mesmo assim"), mas os dois eixos que
    // exigem exceção são reconferidos aqui, cada um na sua fonte:
    //   Inelegível     → o semáforo do próprio payload;
    //   Não incorporado→ o corpus do squad, lido do disco pelo EvidenciaService.
    // Sem esta segunda checagem, um POST direto sem `autorizacao_estado` faria um
    // protocolo não incorporado nascer VIGENTE, pulando o auditor: a trava seria de
    // tela, não de sistema. O cliente só consegue ser mais restritivo, nunca menos.
    const exigeAutorizacao =
      dados.autorizacao_estado === 'pendente' ||
      dados.semaforo === 'inelegivel' ||
      this.evidencia.naoIncorporado(dados.regimen_id);
    const autorizacao_estado: AutorizacaoEstado = exigeAutorizacao ? 'pendente' : 'nao_necessaria';
    const nova = this.avaliacaoRepo.create({
      paciente_id: pacienteId,
      avaliado_por: usuarioId,
      regimen_id: dados.regimen_id,
      linha_tratamento: dados.linha_tratamento ?? null,
      snapshot_campos: dados.snapshot_campos,
      semaforo: dados.semaforo,
      detalhe_semaforo: dados.detalhe_semaforo ?? null,
      autorizacao_estado,
    });
    const salva = await this.avaliacaoRepo.save(nova);
    const full = await this.avaliacaoRepo.findOne({
      where: { id: salva.id },
      relations: { avaliadoPor: true, autorizacaoAuditor: true },
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
      // Estado da solicitação de exceção (⏳ pendente · ✅ aprovada · ⛔ negada) + parecer.
      autorizacao_estado: a.autorizacao_estado,
      autorizacao_parecer: a.autorizacao_parecer,
      autorizacao_decidida_em: a.autorizacao_decidida_em,
      autorizacao_auditor: a.autorizacaoAuditor
        ? { id: a.autorizacaoAuditor.id, nome: a.autorizacaoAuditor.nome }
        : null,
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
