import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Query, Request, Res,
  StreamableFile, UploadedFile, UseGuards, UseInterceptors, ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { RevisorOuAdminGuard } from '../auth/revisor.guard';
import { ArquivoUpload, RevisoesService } from './revisoes.service';

class CriarRevisaoDto {
  @IsString() @IsNotEmpty() @MaxLength(160) regimen_id: string;
  @IsString() @IsNotEmpty() @MaxLength(64) content_hash: string;
  @IsIn(['aprovado', 'contestado', 'ajuste_solicitado']) decisao: 'aprovado' | 'contestado' | 'ajuste_solicitado';
  // Obrigatória para contestado/ajuste_solicitado; opcional (ignorada) para aprovado.
  // NADA de @IsOptional aqui: ele venceria o @ValidateIf e deixaria passar sem motivo.
  // @ValidateIf só liga os validadores quando a decisão exige justificativa.
  @ValidateIf((o) => o.decisao === 'contestado' || o.decisao === 'ajuste_solicitado')
  @IsString({ message: 'justificativa obrigatória para contestado/ajuste_solicitado' })
  @IsNotEmpty({ message: 'justificativa obrigatória para contestado/ajuste_solicitado' })
  justificativa?: string;
  // Natureza da contestação/ajuste (mesma mecânica do @ValidateIf acima):
  // 'dado' = fonte/DOI/critério errado → o squad refaz; 'clinico' = registro clínico.
  @ValidateIf((o) => o.decisao === 'contestado' || o.decisao === 'ajuste_solicitado')
  @IsIn(['dado', 'clinico'], { message: 'natureza (dado|clinico) obrigatória para contestado/ajuste_solicitado' })
  natureza?: 'dado' | 'clinico';
  // AÇÃO explícita — é o que o intake do squad roteia (a natureza classifica; a ação decide).
  // Obrigatória para contestado/ajuste_solicitado; ações que mudam o corpo publicado
  // (refutar, excluir, corrigir_referencia) só existem via este campo, nunca deduzidas do
  // texto livre. refutar = rejeição clínica, o regime FICA visível (não incorporado);
  // excluir = erro/duplicata, sai de vez (raro).
  @ValidateIf((o) => o.decisao === 'contestado' || o.decisao === 'ajuste_solicitado')
  @IsIn(['refutar', 'excluir', 'corrigir_referencia', 'ajustar_elegibilidade', 'manter_anotar', 'outro'], {
    message: 'acao (refutar|excluir|corrigir_referencia|ajustar_elegibilidade|manter_anotar|outro) obrigatória para contestado/ajuste_solicitado',
  })
  acao?: 'refutar' | 'excluir' | 'corrigir_referencia' | 'ajustar_elegibilidade' | 'manter_anotar' | 'outro';
  // Complemento da ação — obrigatório quando a ação precisa de input estruturado do revisor:
  // corrigir_referencia (o DOI/estudo novo), ajustar_elegibilidade (a spec da regra) e
  // excluir (qual o erro: duplicado de quê / entrada errada).
  @ValidateIf((o) => o.acao === 'corrigir_referencia' || o.acao === 'ajustar_elegibilidade' || o.acao === 'excluir')
  @IsString({ message: 'acao_detalhe obrigatório: DOI novo (corrigir_referencia), spec da regra (ajustar_elegibilidade) ou o erro (excluir)' })
  @IsNotEmpty({ message: 'acao_detalhe obrigatório: DOI novo (corrigir_referencia), spec da regra (ajustar_elegibilidade) ou o erro (excluir)' })
  @MaxLength(2000)
  acao_detalhe?: string;
  @IsOptional() @IsIn(['grade', 'esmo', 'custo', 'elegibilidade', 'geral']) eixo?: 'grade' | 'esmo' | 'custo' | 'elegibilidade' | 'geral';
}

// Fonte sugerida pelo revisor clínico para um protocolo incompleto: DOI/PMID/link
// (campo leve) OU o PDF anexado (multipart, campo "arquivo"). O revisor nunca lida
// com pasta/nome de arquivo — isso é curadoria do admin, sobre a lista enviada.
class CriarFonteDto {
  @IsString() @IsNotEmpty() @MaxLength(160) regimen_id: string;
  @IsString() @IsNotEmpty() @MaxLength(64) content_hash: string;
  @IsIn(['doi', 'pmid', 'url', 'pdf']) tipo: 'doi' | 'pmid' | 'url' | 'pdf';
  // Obrigatório quando tipo ≠ pdf (validação de conjunto no service, que também vê o arquivo).
  @IsOptional() @IsString() @MaxLength(600) valor?: string;
}

// Subconjunto a exportar: lista de regimen_id selecionada na Revisão clínica.
// Vazio/ausente = pacote completo (todas as revisões gravadas).
class ExportarDto {
  @IsOptional() @IsArray() @IsString({ each: true }) regimen_ids?: string[];
}

// Leitura do workbench (decisões por regime): revisor|admin — o oncologista não vê a
// Revisão. Exceção: GET /revisoes/resumo aberto a qualquer autenticado, pois é ele que
// pinta o selo de estado nos protocolos do paciente.
// Escrita: guard EXPLÍCITO revisor|admin (whitelist, não hierarquia).
@UseGuards(JwtAuthGuard)
@Controller('revisoes')
export class RevisoesController {
  constructor(private service: RevisoesService) {}

  @Post()
  @UseGuards(RevisorOuAdminGuard)
  criar(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CriarRevisaoDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.criar(dto, req.user.id);
  }

  // GET /revisoes/resumo — mapa regimen_id → estado atual (uma chamada só para a sobreposição).
  @Get('resumo')
  resumo() {
    return this.service.resumo();
  }

  // POST /revisoes/fontes — o revisor envia a fonte que falta (DOI/PMID/link ou PDF).
  // Multipart: campos texto + arquivo opcional "arquivo" (PDF, até 25 MB, em memória —
  // o service valida e grava no storage do backend).
  @Post('fontes')
  @UseGuards(RevisorOuAdminGuard)
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 25 * 1024 * 1024 } }))
  criarFonte(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CriarFonteDto,
    @UploadedFile() arquivo: ArquivoUpload | undefined,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.criarFonte(dto, arquivo, req.user.id);
  }

  // GET /revisoes/fontes — todas as fontes enviadas (a app agrupa por regimen_id).
  @Get('fontes')
  listarFontes() {
    return this.service.listarFontes();
  }

  // GET /revisoes/fontes/:id/arquivo — download do PDF anexado. Admin: é quem salva o
  // arquivo em data/input/fontes-manuais/<regimen_id>.pdf e re-roda o intake do squad.
  @Get('fontes/:id/arquivo')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async arquivoFonte(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response) {
    const { buffer, nome } = await this.service.arquivoFonte(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nome.replace(/"/g, '')}"`);
    return new StreamableFile(buffer);
  }

  // GET /revisoes?regimen_id= — todas as decisões daquele protocolo (tumor board assíncrono).
  // Restrito a revisor|admin: o oncologista não participa da Revisão (só vê o resumo).
  @Get()
  @UseGuards(RevisorOuAdminGuard)
  porRegime(@Query('regimen_id') regimen_id: string) {
    return this.service.porRegime(regimen_id);
  }
}

// Pacote de revisões para devolver ao squad (revisao-decisoes.json, Steps 08/10) — o caminho
// /revisao/export é mantido da Mesa aposentada, agora lendo da tabela única `revisoes`.
// Restrito ao ADMIN (quem trabalha com os agentes); revisores terceiros só revisam.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('revisao')
export class RevisaoExportController {
  constructor(private service: RevisoesService) {}

  // GET = pacote completo (todas as revisões gravadas).
  @Get('export')
  exportar() {
    return this.service.exportar();
  }

  // POST = subconjunto por regimen_id ("baixar selecionadas" / filtro atual). Mesmo schema do GET.
  @Post('export')
  exportarSelecao(@Body(new ValidationPipe({ whitelist: true })) dto: ExportarDto) {
    return this.service.exportar(dto.regimen_ids);
  }
}
