import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { FonteSugerida, Revisao } from '../database/entities';

// Upload vindo do FileInterceptor (memoryStorage) — tipado localmente para não
// depender de @types/multer.
export interface ArquivoUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Estado que a app sobrepõe ao selo do squad (aditivo — nunca reescreve a evidência).
type Estado =
  | 'aprovado'
  | 'contestado'
  | 'ajuste'
  | 'pendente_re_revisao'
  | 'pendente';

const ESTADO_POR_DECISAO: Record<string, Estado> = {
  aprovado: 'aprovado',
  contestado: 'contestado',
  ajuste_solicitado: 'ajuste',
};

@Injectable()
export class RevisoesService {
  constructor(
    @InjectRepository(Revisao) private repo: Repository<Revisao>,
    @InjectRepository(FonteSugerida) private fontes: Repository<FonteSugerida>,
  ) {}

  // ── Fontes sugeridas pelos revisores (protocolos incompletos) ──────────────
  // O revisor só envia DOI/PMID/link ou o PDF pelo navegador. Os bytes do PDF moram
  // no BANCO (coluna bytea, select:false) — o backend também roda na Vercel, onde o
  // filesystem é efêmero. Levar o PDF para data/input/fontes-manuais/ e re-rodar o
  // intake é tarefa do ADMIN, sobre esta lista.
  async criarFonte(
    dto: { regimen_id: string; content_hash: string; tipo: FonteSugerida['tipo']; valor?: string },
    arquivo: ArquivoUpload | undefined,
    revisorId: number,
  ) {
    const valor = (dto.valor || '').trim() || null;
    if (dto.tipo === 'pdf') {
      if (!arquivo) throw new BadRequestException('Anexe o PDF para enviar uma fonte do tipo pdf.');
    } else if (!valor) {
      throw new BadRequestException('Informe o DOI, PMID ou link da fonte.');
    }
    if (arquivo) {
      const ehPdf = /pdf$/i.test(arquivo.mimetype) || /\.pdf$/i.test(arquivo.originalname || '');
      if (!ehPdf) throw new BadRequestException('O anexo deve ser um PDF.');
    }
    const row = this.fontes.create({
      regimen_id: dto.regimen_id,
      content_hash: dto.content_hash,
      tipo: arquivo ? 'pdf' : dto.tipo,
      valor,
      arquivo_nome: arquivo ? (arquivo.originalname || 'fonte.pdf').replace(/[/\\]/g, '_').slice(0, 200) : null,
      arquivo: arquivo ? arquivo.buffer : null,
      revisor_id: revisorId,
    });
    const salvo = await this.fontes.save(row);
    const full = await this.fontes.findOne({ where: { id: salvo.id }, relations: { revisor: true } });
    return this.fonteItem(full!);
  }

  // Lista completa (a app agrupa por regimen_id). Leitura por qualquer autenticado:
  // o revisor vê que a fonte já foi enviada; o admin trabalha a fila de curadoria.
  // O blob nunca vem junto (select:false na coluna) — só metadados.
  async listarFontes() {
    const rows = await this.fontes.find({ relations: { revisor: true }, order: { criado_em: 'DESC' } });
    return { fontes: rows.map((f) => this.fonteItem(f)) };
  }

  // Download do PDF enviado (admin — é quem o leva para a pasta de intake do squad).
  // Busca o blob explicitamente; cai no arquivo em disco só para linhas legadas.
  async arquivoFonte(id: number) {
    const f = await this.fontes
      .createQueryBuilder('f')
      .addSelect('f.arquivo')
      .where('f.id = :id', { id })
      .getOne();
    if (!f) throw new NotFoundException('Fonte não encontrada.');
    const nome = f.arquivo_nome || `${f.regimen_id}.pdf`;
    if (f.arquivo && f.arquivo.length) return { buffer: f.arquivo, nome };
    if (f.arquivo_path && fs.existsSync(f.arquivo_path)) return { buffer: fs.readFileSync(f.arquivo_path), nome };
    throw new NotFoundException('Fonte sem PDF anexado (ou arquivo não encontrado no storage).');
  }

  private fonteItem(f: FonteSugerida) {
    return {
      id: f.id,
      regimen_id: f.regimen_id,
      content_hash: f.content_hash,
      tipo: f.tipo,
      valor: f.valor,
      arquivo_nome: f.arquivo_nome,
      tem_pdf: f.tipo === 'pdf' && (!!f.arquivo_nome || !!f.arquivo_path),
      revisor: f.revisor ? { id: f.revisor.id, nome: f.revisor.nome } : null,
      criado_em: f.criado_em,
    };
  }

  // Uma decisão por linha (append-only). revisor_id/criado_em são do servidor.
  async criar(
    dto: { regimen_id: string; content_hash: string; decisao: Revisao['decisao']; justificativa?: string; natureza?: Revisao['natureza']; acao?: Revisao['acao']; acao_detalhe?: string; eixo?: Revisao['eixo'] },
    revisorId: number,
  ) {
    const ehParecerCritico = dto.decisao === 'contestado' || dto.decisao === 'ajuste_solicitado';
    // acao_detalhe só acompanha as ações que o exigem (DOI novo / spec da regra / qual o erro)
    const acao = ehParecerCritico ? dto.acao ?? null : null;
    const temDetalhe = acao === 'corrigir_referencia' || acao === 'ajustar_elegibilidade' || acao === 'excluir';
    const row = this.repo.create({
      regimen_id: dto.regimen_id,
      content_hash: dto.content_hash,
      decisao: dto.decisao,
      justificativa: dto.justificativa ?? null,
      // natureza/acao só fazem sentido em contestado/ajuste (aprovado grava null, mesmo se enviadas)
      natureza: ehParecerCritico ? dto.natureza ?? null : null,
      acao,
      acao_detalhe: temDetalhe ? (dto.acao_detalhe || '').trim() || null : null,
      eixo: dto.eixo ?? null,
      revisor_id: revisorId,
    });
    const salvo = await this.repo.save(row);
    const full = await this.repo.findOne({ where: { id: salvo.id }, relations: { revisor: true } });
    return this.toItem(full);
  }

  // Tumor board assíncrono: todas as decisões daquele protocolo, de todos os revisores,
  // atribuídas e com timestamp (mais recente primeiro).
  async porRegime(regimen_id: string) {
    const rows = await this.repo.find({
      where: { regimen_id },
      relations: { revisor: true },
      order: { criado_em: 'DESC' },
    });
    return { regimen_id, decisoes: rows.map((r) => this.toItem(r)) };
  }

  // Mapa regimen_id → estado atual (uma chamada só). Estado = decisão mais recente cujo
  // content_hash == hash atual do regime; se só houver decisão em hash antigo →
  // pendente_re_revisao; sem decisão → pendente (ausente do mapa, default da app).
  async resumo() {
    const hashesAtuais = this.currentHashes();
    const rows = await this.repo.find({ relations: { revisor: true }, order: { criado_em: 'DESC' } });

    const porRegime = new Map<string, Revisao[]>();
    for (const r of rows) {
      if (!porRegime.has(r.regimen_id)) porRegime.set(r.regimen_id, []);
      porRegime.get(r.regimen_id)!.push(r);
    }

    const estados: Record<string, any> = {};
    for (const [rid, decs] of porRegime) {
      const atual = hashesAtuais[rid] ?? null;
      const noHashAtual = atual ? decs.find((d) => d.content_hash === atual) : null; // decs já em DESC
      if (noHashAtual) {
        estados[rid] = {
          estado: ESTADO_POR_DECISAO[noHashAtual.decisao] ?? 'pendente',
          decisao: noHashAtual.decisao,
          revisor: noHashAtual.revisor?.nome ?? null,
          data: this.iso(noHashAtual.criado_em),
          eixo: noHashAtual.eixo ?? null,
          natureza: noHashAtual.natureza ?? null,
          acao: noHashAtual.acao ?? null,
          acao_detalhe: noHashAtual.acao_detalhe ?? null,
          aplicada_em: noHashAtual.aplicada_em ?? null,
          motivo: noHashAtual.justificativa ?? null,
          content_hash: noHashAtual.content_hash,
        };
      } else {
        const ultima = decs[0]; // mais recente (hash antigo)
        estados[rid] = {
          estado: 'pendente_re_revisao',
          decisao_anterior: ultima.decisao,
          revisor: ultima.revisor?.nome ?? null,
          data: this.iso(ultima.criado_em),
          hash_revisado: ultima.content_hash,
          hash_atual: atual,
        };
      }
    }
    return {
      hashes_carregados: Object.keys(hashesAtuais).length,
      protocolos_com_estado: Object.keys(estados).length,
      // ausente do mapa = 'pendente' (default; a app não precisa que o backend liste os 295).
      estados,
    };
  }

  // Hashes atuais dos regimes: sidecar emitido pelo build-data.py (não duplica a lógica de hash).
  private currentHashes(): Record<string, string> {
    const p =
      process.env.ONCOGUIA_HASHES_PATH ||
      path.resolve(process.cwd(), 'data', 'content-hashes.json');
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return j.hashes || {};
    } catch {
      return {}; // sem sidecar → estados caem em pendente_re_revisao (não some com a informação)
    }
  }

  private iso(d: Date | null) {
    return d ? new Date(d).toISOString() : null;
  }

  // Gera o revisao-decisoes.json a partir da tabela única `revisoes` — é este arquivo que o
  // admin baixa e entrega na pasta do run para os Steps 08/10 reincorporarem. Quem ROTEIA o
  // intake é a AÇÃO explícita (`acao`): refutar (rejeição clínica — o regime fica visível como
  // não incorporado/refutado, só sai dos candidatos), excluir (erro/duplicata — sai de vez),
  // corrigir_referencia (troca o DOI e re-deriva só aquele eixo), ajustar_elegibilidade (nova
  // regra computável), manter_anotar (nada muda; a nota vira contexto visível), outro (triagem manual).
  // Decisões antigas SEM acao (legado em texto livre) saem com acao=null + triagem_manual=true:
  // o intake propõe um balde lendo o texto e o humano confirma antes de qualquer execução —
  // nada destrutivo/mutante é deduzido de texto livre.
  // `estado_intake` fecha o ciclo: ter ação não significa que ela já rodou. Os estados são
  // exclusivos e nesta ordem de precedência (ver legenda_estado_intake):
  //   aguardando_re_revisao     — hash_atual conhecido e != content_hash: o parecer é de uma
  //                               versão anterior do regime (inclusive quando foi a própria
  //                               execução que mudou o regime). Precede tudo: seja o que for
  //                               que já se aplicou, quem decide sobre a versão nova é o revisor.
  //   pendente_triagem          — crítica sem acao: ninguém triou ainda.
  //   triada_aplicada           — acao + aplicada_em: triada com o humano e executada pelo intake.
  //   triada_pendente_execucao  — acao sem aplicada_em: é a FILA DE TRABALHO real do intake.
  //   registro                  — aprovado no hash atual: nada a rotear.
  // hash_atual null (sidecar ausente ou regime fora do consolidado) NÃO vira divergência — não dá
  // para afirmar que a versão mudou; o estado cai no eixo de triagem e o hash_atual null fala por si.
  // `regimenIds` (opcional) restringe ao subconjunto selecionado na Revisão clínica.
  async exportar(regimenIds?: string[]) {
    const rows = await this.repo.find({ relations: { revisor: true }, order: { criado_em: 'ASC' } });
    const idSet = regimenIds && regimenIds.length ? new Set(regimenIds) : null;
    const selecionadas = idSet ? rows.filter((d) => idSet.has(d.regimen_id)) : rows;
    const hashesAtuais = this.currentHashes();
    const contagem: Record<string, number> = {
      aguardando_re_revisao: 0,
      pendente_triagem: 0,
      triada_aplicada: 0,
      triada_pendente_execucao: 0,
      registro: 0,
    };
    const decisoes = selecionadas.map((d) => {
      const critico = d.decisao === 'contestado' || d.decisao === 'ajuste_solicitado';
      const hashAtual = hashesAtuais[d.regimen_id] ?? null;
      const estadoIntake = hashAtual && hashAtual !== d.content_hash
        ? 'aguardando_re_revisao'
        : !critico
          ? 'registro'
          : !d.acao
            ? 'pendente_triagem'
            : d.aplicada_em
              ? 'triada_aplicada'
              : 'triada_pendente_execucao';
      contagem[estadoIntake]++;
      // reprocessar = a ação re-deriva o dado (corrigir_referencia | ajustar_elegibilidade).
      // refutar/excluir/manter_anotar/outro não reprocessam. Legado (sem acao): mantém a leitura
      // antiga (natureza dado), mas o intake só age após confirmação humana (triagem_manual).
      const reprocessar = d.acao
        ? d.acao === 'corrigir_referencia' || d.acao === 'ajustar_elegibilidade'
        : d.natureza === 'dado';
      return {
        regimen_id: d.regimen_id,
        content_hash: d.content_hash,
        hash_atual: hashAtual, // difere do content_hash ⇒ parecer de versão anterior
        decisao: d.decisao,
        natureza: d.natureza ?? null,
        acao: d.acao ?? null,
        acao_detalhe: d.acao_detalhe ?? null,
        // Data em que o intake EXECUTOU a ação; null = ainda não executada.
        aplicada_em: d.aplicada_em ?? null,
        estado_intake: estadoIntake,
        // Legado sem ação explícita: o intake NÃO roteia automático — propõe balde e pede confirmação.
        triagem_manual: critico && !d.acao,
        eixo: d.eixo ?? null,
        justificativa: d.justificativa || '',
        reprocessar,
        correcao: reprocessar ? d.acao_detalhe || d.justificativa || '' : null,
        revisor: d.revisor ? d.revisor.nome : '',
        data: d.criado_em ? d.criado_em.toISOString().slice(0, 10) : null,
      };
    });
    return {
      meta: {
        exportado_em: new Date().toISOString().slice(0, 10),
        escopo: idSet ? 'selecao' : 'completo',
        total_decisoes: decisoes.length,
        // Placar do ciclo: o que falta triar, o que falta executar e o que voltou para o revisor.
        estados_intake: contagem,
        gerado_por: 'OncoGuia — backend (/revisao/export, tabela revisoes)',
        legenda_decisao: {
          aprovado: 'protocolo aprovado pelo revisor naquele content_hash (registro; nada a refazer)',
          contestado: 'contestado — quem roteia é a AÇÃO (legenda_acao); a natureza classifica (dado|clinico)',
          ajuste_solicitado: 'ajuste pedido — mesma leitura de ação/natureza do contestado',
        },
        legenda_acao: {
          refutar: 'rejeição clínica — o regime NÃO sai do corpo publicado: continua no regimes-consolidados.json e na tela, marcado não incorporado (motivo refutado) com a justificativa do revisor (nota_revisao) + revisor/data. Só sai da lista de candidatos selecionáveis. NÃO reprocessa; manter a informação é prova da completude da avaliação.',
          excluir: 'erro/duplicata (dado errado, NÃO rejeição clínica) — a entrada sai DE VEZ do consolidado; acao_detalhe diz qual o erro. Raro; rastreado em meta.revisao_humana.excluidos[].',
          corrigir_referencia: 'DOI/estudo-pivô errado → trocar pela referência em acao_detalhe e re-derivar SÓ o eixo afetado com a fonte nova; passa de novo pelo portão de verificação.',
          ajustar_elegibilidade: 'aplicar a regra computável de acao_detalhe; re-validar órfãos + estadiamento.',
          manter_anotar: 'o dado está certo — anexar a justificativa ao regime como contexto visível e marcar "revisado com ressalva". NÃO muda o dado.',
          outro: 'não se encaixa → fila de triagem manual; NUNCA roteia automático.',
          _seguranca: 'refutar, excluir e corrigir_referencia mudam o corpo publicado: só agir com acao setada explicitamente, NUNCA deduzida do texto livre. Decisões com acao=null (legado) saem com triagem_manual=true — propor balde e confirmar com humano antes de executar.',
        },
        legenda_estado_intake: {
          aguardando_re_revisao: 'o regime mudou depois deste parecer (hash_atual != content_hash) — inclusive quando foi a própria execução da ação que o mudou. O parecer não vale para a versão publicada: quem decide sobre ela é o revisor. Precede os demais estados.',
          pendente_triagem: 'crítica ainda SEM acao (legado em texto livre): o intake propõe um balde e o humano confirma antes de qualquer execução. É o mesmo conjunto de triagem_manual=true.',
          triada_aplicada: 'acao confirmada com o humano E já executada pelo intake em aplicada_em — ciclo fechado; nada a refazer.',
          triada_pendente_execucao: 'acao confirmada mas ainda NÃO executada (aplicada_em null) — é a fila de trabalho real do intake. Tipicamente acao=outro, que nunca roteia automático.',
          registro: 'aprovado no hash atual: registro do revisor, nada a rotear.',
          _leitura: 'acao diz PARA ONDE a decisão vai; aplicada_em diz se JÁ FOI. Ter acao não significa executada — só aplicada_em atesta isso.',
        },
        legenda_natureza: {
          dado: 'fonte/DOI/critério não computável errado (classificação; quem decide o destino é a acao)',
          clinico: 'discordância clínica de nota/magnitude (classificação; quem decide o destino é a acao)',
        },
      },
      decisoes,
    };
  }

  private toItem(d: Revisao) {
    return {
      id: d.id,
      regimen_id: d.regimen_id,
      content_hash: d.content_hash,
      decisao: d.decisao,
      justificativa: d.justificativa,
      natureza: d.natureza,
      acao: d.acao,
      acao_detalhe: d.acao_detalhe,
      aplicada_em: d.aplicada_em ?? null,
      eixo: d.eixo,
      revisor: d.revisor ? { id: d.revisor.id, nome: d.revisor.nome } : null,
      criado_em: d.criado_em,
    };
  }
}
