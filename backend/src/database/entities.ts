import {
  Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

// Perfis são WHITELIST, nunca hierarquia: 'auditor' não é "revisor com mais poder" —
// é um eixo próprio (autoriza exceção de protocolo), e não herda nada de ninguém.
export type Perfil = 'oncologista' | 'revisor' | 'auditor' | 'admin';

// Semáforo de elegibilidade — mesmo vocabulário do motor evalExpr (elegível/atenção/inelegível).
export type Semaforo = 'elegivel' | 'atencao' | 'inelegivel';

// SOLICITAÇÃO DE EXCEÇÃO — autorização do auditor para um protocolo fora do padrão.
// Estende o "Selecionar mesmo assim — exige justificativa": seleção de protocolo
// Inelegível ou Não incorporado não vira tratamento vigente sozinha; nasce 'pendente'
// e só passa a valer com decisão de um auditor.
//   'nao_necessaria' = seleção normal (elegível + incorporado) — vigente na hora;
//   'pendente'       = solicitação aberta, na fila do auditor — NÃO é vigente;
//   'aprovada'       = exceção autorizada — passa a ser o protocolo vigente;
//   'negada'         = exceção recusada — o registro FICA na trilha com o parecer.
// Decisão é ÚNICA e IMUTÁVEL: nada some, nova tentativa = nova avaliação/solicitação.
export type AutorizacaoEstado = 'nao_necessaria' | 'pendente' | 'aprovada' | 'negada';

// Estados em que a avaliação CONTA como protocolo vigente do paciente.
export const AUTORIZACAO_VIGENTE: AutorizacaoEstado[] = ['nao_necessaria', 'aprovada'];

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  nome: string;

  @Column({ length: 60, unique: true })
  login: string;

  @Column({ length: 255 })
  senha_hash: string;

  @Column({ type: 'varchar', length: 20, default: 'oncologista' })
  perfil: Perfil;

  @Column({ default: true })
  ativo: boolean;

  // ---- Identificação profissional (bloco "Profissional Solicitante" da guia TISS) ----
  // Administrativo, não clínico. Opcional: sem preenchimento, a guia imprime em branco.
  @Column({ length: 20, nullable: true })
  conselho: string; // ex.: CRM

  @Column({ length: 30, nullable: true })
  numero_conselho: string;

  @Column({ length: 2, nullable: true })
  uf_conselho: string;

  @Column({ length: 10, nullable: true })
  cbos: string; // Código Brasileiro de Ocupações do solicitante
}

// LGPD: nesta fase os pacientes são FICTÍCIOS (validação). O schema já nasce no
// padrão de produção — dados administrativos mínimos, sem dado clínico solto na
// tabela; o clínico entra estruturado em selecoes_protocolo.dados_clinicos.
@Entity('pacientes')
export class Paciente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 160 })
  nome: string;

  @Column({ type: 'date', nullable: true })
  nasc: string;

  @Column({ type: 'varchar', length: 1, default: 'F' })
  sexo: 'F' | 'M';

  @Column({ length: 120, nullable: true })
  cidade: string;

  @Column({ length: 80, nullable: true })
  operadora: string;

  @Column({ length: 120, nullable: true })
  plano: string;

  @Column({ length: 60, nullable: true })
  carteirinha: string;

  // ---- Contexto oncológico do paciente em seguimento ----
  // Princípio de modelagem: o TUMOR é atributo do PACIENTE, não escolha por visita.
  // Um tumor ativo por paciente (segundo primário não é modelado nesta fase).
  @Column({ length: 60, nullable: true })
  identificador: string; // registro do hospital

  @Column({ length: 40, nullable: true })
  sistema: string; // sistema/aparelho (gu, torax, dig, ...) — navegação já resolvida

  @Column({ length: 60, nullable: true })
  tumor: string;

  @Column({ length: 120, nullable: true })
  subtipo: string;

  // Campos primitivos com estavel:true congelados no cadastro (biologia imutável do tumor).
  // Servem SÓ para pré-preencher e TRAVAR na reavaliação — nunca são a fonte de verdade de
  // uma avaliação (essa é o snapshot_campos da própria Avaliacao).
  @Column({ type: 'jsonb', nullable: true })
  valores_estaveis: Record<string, any>;

  // ---- Agenda de reestadiamento (LEMBRETE, não registro clínico) ----
  // Diferente de avaliacoes/retornos (append-only), a agenda é ESTADO MUTÁVEL e descartável:
  // ela só responde "quando é o próximo". O que aconteceu vive nos registros imutáveis; aqui
  // fica apenas o ponteiro para a frente, reagendado ao selecionar protocolo e a cada retorno
  // com imagem. Intervalo padrão 3 meses, ajustável por paciente (nem todo tumor reestadia no
  // mesmo ritmo) — quem ajusta é o oncologista, em PATCH /pacientes/:id/reestadiamento.
  @Column({ type: 'date', nullable: true })
  proximo_reestadiamento: string;

  @Column({ type: 'int', default: 3 })
  intervalo_reestadiamento_meses: number;

  // Agenda do PRÓXIMO RETORNO (mesma natureza da de reestadiamento: lembrete mutável,
  // não registro clínico). Decidida no fim de cada retorno e sobrescrita no seguinte.
  // Data no passado + nenhum retorno registrado desde então = o paciente não veio.
  @Index()
  @Column({ type: 'date', nullable: true })
  proximo_retorno: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'criado_por' })
  criadoPor: Usuario;

  @Column({ name: 'criado_por', nullable: true })
  criado_por: number;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criado_em: Date;
}

// Avaliação = registro IMUTÁVEL e EMPILHADO do paciente em seguimento. Cada reavaliação é
// uma nova linha; correção também é nova linha (nunca UPDATE de conteúdo clínico, nunca DELETE).
// snapshot_campos congela TODOS os campos_primitivos (estáveis + dinâmicos) daquele momento,
// tornando o registro autossuficiente e auditável — independe do estado atual do Paciente.
@Entity('avaliacoes')
@Index(['paciente_id', 'data'])
export class Avaliacao {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column({ name: 'paciente_id' })
  paciente_id: number;

  @CreateDateColumn({ name: 'data', type: 'timestamptz' })
  data: Date; // do servidor — momento da avaliação

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'avaliado_por' })
  avaliadoPor: Usuario;

  @Column({ name: 'avaliado_por', nullable: true })
  avaliado_por: number; // do JWT

  @Column({ type: 'int', nullable: true })
  linha_tratamento: number;

  @Column({ length: 160 })
  regimen_id: string; // protocolo selecionado nesta avaliação

  @Column({ type: 'jsonb' })
  snapshot_campos: Record<string, any>; // TODOS os campos_primitivos congelados

  @Column({ type: 'varchar', length: 20 })
  semaforo: Semaforo; // elegivel | atencao | inelegivel

  @Column({ type: 'jsonb', nullable: true })
  detalhe_semaforo: Record<string, any>; // quais regras passaram/falharam
  // (detalhe_semaforo.ressalva guarda a justificativa do médico ao selecionar fora do
  //  padrão — é ela que o auditor lê no card da fila de autorizações.)

  // ---- Solicitação de exceção (autorização do auditor) ----
  // Seleção normal nasce 'nao_necessaria'. Inelegível/Não incorporado nasce 'pendente' e
  // só vira vigente quando um auditor aprova. Ver AutorizacaoEstado.
  @Column({ type: 'varchar', length: 20, default: 'nao_necessaria' })
  autorizacao_estado: AutorizacaoEstado;

  // Parecer do auditor — OBRIGATÓRIO nas duas decisões (aprovar e negar). O médico lê
  // o desfecho na trilha do paciente; negada permanece visível com este texto.
  @Column({ type: 'text', nullable: true })
  autorizacao_parecer: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'autorizacao_auditor_id' })
  autorizacaoAuditor: Usuario;

  @Column({ name: 'autorizacao_auditor_id', nullable: true })
  autorizacao_auditor_id: number; // do JWT do auditor (servidor)

  @Column({ name: 'autorizacao_decidida_em', type: 'timestamptz', nullable: true })
  autorizacao_decidida_em: Date; // do servidor

  // Retorno que MOTIVOU esta avaliação (o retorno cuja conduta foi troca_protocolo). null
  // nas avaliações que não nasceram de um retorno (primeira seleção, reavaliação avulsa).
  // É o elo que fecha o ciclo retorno → troca: na trilha a avaliação nova aparece atrelada
  // ao retorno que a pediu, e não solta no meio da linha do tempo.
  @Column({ name: 'retorno_id', nullable: true })
  retorno_id: number;
}

// Linha do tempo de protocolos escolhidos por paciente. dados_clinicos é a
// fotografia do formulário clínico no momento da escolha (JSONB).
@Entity('selecoes_protocolo')
export class SelecaoProtocolo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column({ name: 'paciente_id' })
  paciente_id: number;

  @Column({ length: 160 })
  regimen_id: string;

  @Column({ length: 255 })
  protocolo_nome: string;

  @Column({ length: 60, nullable: true })
  tumor: string;

  @Column({ type: 'jsonb', nullable: true })
  dados_clinicos: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  justificativa: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'selecionado_por' })
  selecionadoPor: Usuario;

  @Column({ name: 'selecionado_por', nullable: true })
  selecionado_por: number;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criado_em: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Revisão clínica dos PROTOCOLOS (camada humana sobre os 295 do squad).
// Append-only e IMUTÁVEL (como Avaliacao): mudar de ideia = nova linha, nunca UPDATE/DELETE.
// Indexada por regimen_id + content_hash: a revisão vale para AQUELA versão do regime.
// Quando o squad re-roda e a vigilância muda o regime, o content_hash muda e a revisão
// "expira" sozinha (o protocolo volta a pendente_re_revisao) — sem tocar no selo do squad.
// O revisor humano se SOBREPÕE à análise do squad; não a reescreve (a evidência permanece).
export type DecisaoRevisao = 'aprovado' | 'contestado' | 'ajuste_solicitado';
export type EixoRevisao = 'grade' | 'esmo' | 'custo' | 'elegibilidade' | 'geral';
// Natureza da contestação/ajuste — decide o destino do parecer no loop com o squad:
// 'dado' = fonte/DOI/critério não computável errado → o squad REFAZ o regime (vai no export);
// 'clinico' = discordância de nota/magnitude → registro clínico (não dispara reprocessamento).
export type NaturezaRevisao = 'dado' | 'clinico';
// AÇÃO explícita da contestação/ajuste — é o que o intake do squad (Steps 08/10) roteia
// de fato (a natureza classifica; a ação DECIDE). Sem ação explícita, ações que mudam o
// corpo publicado (refutar, excluir, corrigir_referencia) NUNCA são deduzidas do texto livre:
//   'refutar'               = rejeição clínica — o regime NÃO some: fica visível como não
//                             incorporado (motivo refutado) com a justificativa do revisor;
//                             só sai da lista de candidatos selecionáveis. Manter a informação
//                             é prova da completude da avaliação.
//   'excluir'               = erro/duplicata — dado errado sai DE VEZ do consolidado
//                             (acao_detalhe = qual o erro). Raro; NUNCA para rejeição clínica.
//   'corrigir_referencia'   = DOI/estudo-pivô errado → trocar e re-derivar só aquele eixo (acao_detalhe = DOI novo)
//   'ajustar_elegibilidade' = mudar a regra computável (acao_detalhe = spec do revisor)
//   'manter_anotar'         = o dado está certo; a justificativa é ressalva/contexto (nada muda)
//   'outro'                 = não se encaixa → fila de triagem manual (nunca roteia automático)
// ('remover', o nome antigo de refutar, foi migrado nos dados: rejeição clínica não apaga.)
export type AcaoRevisao = 'refutar' | 'excluir' | 'corrigir_referencia' | 'ajustar_elegibilidade' | 'manter_anotar' | 'outro';

// Fonte sugerida pelo REVISOR para um protocolo incompleto (falta a referência-fonte).
// O revisor clínico só indica a fonte — DOI/PMID/link ou o próprio PDF (upload) — e o
// backend guarda num storage que ele controla. Quem leva o PDF para a pasta de intake
// do squad (data/input/fontes-manuais/) e re-roda é o ADMIN; o revisor nunca vê filesystem.
export type TipoFonteSugerida = 'doi' | 'pmid' | 'url' | 'pdf';

@Entity('fontes_sugeridas')
@Index(['regimen_id', 'criado_em'])
export class FonteSugerida {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 160 })
  regimen_id: string;

  // Versão do regime no momento do envio — se o squad já re-rodou, o admin sabe que a
  // sugestão foi feita sobre uma versão anterior.
  @Column({ length: 64 })
  content_hash: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'revisor_id' })
  revisor: Usuario;

  @Column({ name: 'revisor_id', nullable: true })
  revisor_id: number; // do JWT (servidor)

  @Column({ type: 'varchar', length: 10 })
  tipo: TipoFonteSugerida; // doi | pmid | url | pdf

  // DOI/PMID/URL informado (null quando o envio é só o PDF).
  @Column({ type: 'text', nullable: true })
  valor: string;

  // Upload: nome original do arquivo e o PDF em si. Os bytes ficam no BANCO (bytea) —
  // na Vercel o filesystem é efêmero/read-only, então disco local não serve de storage.
  // select:false: as listagens nunca arrastam o blob; o download busca a coluna explicitamente.
  @Column({ length: 255, nullable: true })
  arquivo_nome: string;

  @Column({ type: 'bytea', nullable: true, select: false })
  arquivo: Buffer;

  // Legado (storage em disco da primeira versão) — não é mais escrito.
  @Column({ length: 500, nullable: true })
  arquivo_path: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criado_em: Date; // do servidor
}

@Entity('revisoes')
@Index(['regimen_id', 'content_hash'])
@Index(['regimen_id', 'criado_em'])
export class Revisao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 160 })
  regimen_id: string;

  // Versão revisada: hash do conteúdo (selo+eixos+referência+regra) daquele momento.
  @Column({ length: 64 })
  content_hash: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'revisor_id' })
  revisor: Usuario;

  @Column({ name: 'revisor_id', nullable: true })
  revisor_id: number; // do JWT (servidor)

  @Column({ type: 'varchar', length: 20 })
  decisao: DecisaoRevisao; // aprovado | contestado | ajuste_solicitado

  // Obrigatória para contestado/ajuste_solicitado (validado no DTO). Exportável como
  // feedback pro squad num momento futuro — NÃO auto-conectado agora.
  @Column({ type: 'text', nullable: true })
  justificativa: string;

  // Eixo em questão (opcional): contestação/ajuste podem apontar um eixo específico.
  @Column({ type: 'varchar', length: 20, nullable: true })
  eixo: EixoRevisao;

  // Obrigatória para contestado/ajuste_solicitado (validado no DTO); null para aprovado.
  @Column({ type: 'varchar', length: 20, nullable: true })
  natureza: NaturezaRevisao;

  // Obrigatória para contestado/ajuste_solicitado a partir da introdução do campo (validado
  // no DTO); null para aprovado e para as decisões antigas (essas o intake TRIA com humano —
  // propõe um balde lendo o texto e só age após confirmação; nunca auto-executa).
  @Column({ type: 'varchar', length: 30, nullable: true })
  acao: AcaoRevisao;

  // Complemento da ação: DOI novo (corrigir_referencia) ou spec da regra (ajustar_elegibilidade).
  @Column({ type: 'text', nullable: true })
  acao_detalhe: string;

  // Quando o intake do squad EXECUTOU essa ação (data do run). null = ainda não executada.
  // É o que separa "já triado e aplicado" de "fila de trabalho": acao diz PARA ONDE vai,
  // aplicada_em diz se JÁ FOI. Só faz sentido com acao setada (CHECK no banco) e não é
  // escrita pelo revisor — quem carimba é o intake, ao fechar o ciclo do parecer.
  @Column({ type: 'date', nullable: true })
  aplicada_em: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criado_em: Date; // do servidor
}

// ─────────────────────────────────────────────────────────────────────────────
// RETORNO — a consulta de seguimento do paciente já em tratamento.
// Append-only e IMUTÁVEL, como Avaliacao: correção é um registro NOVO, nunca UPDATE.
// Um retorno responde três coisas sobre o protocolo em curso: o tumor respondeu?
// (só com imagem — regra RECIST abaixo), o paciente tolerou? (toxicidades com grau CTCAE)
// e o que se faz agora? (conduta).
//
// REGRA RECIST (a razão de `resposta` não ser um campo livre): resposta de tumor é medida
// em imagem. Sem exame de imagem/reestadiamento neste retorno, o médico não tem como
// afirmar resposta_parcial ou progressão — o retorno registra toxicidade e observações, e
// a resposta fica 'nao_avaliada'. A UI trava o seletor e o DTO devolve 400 se vier
// resposta ≠ nao_avaliada com com_imagem=false: as duas travas, porque a segunda é a que
// vale (a UI é conveniência, não é o controle).
export type RespostaRetorno =
  | 'resposta_completa'
  | 'resposta_parcial'
  | 'doenca_estavel'
  | 'progressao'
  | 'nao_avaliada';

// mantem = segue o mesmo protocolo; troca_protocolo = abre a seleção de protocolos (o fluxo
// existente, com semáforo) e a avaliação nova nasce vinculada a ESTE retorno
// (avaliacoes.retorno_id); suspende = interrompe o tratamento.
export type CondutaRetorno = 'mantem' | 'troca_protocolo' | 'suspende';

// Toxicidade observada: nome + grau CTCAE (1–5). O seletor de NOME vem das toxicidades do
// regime em curso no corpus do squad (r.toxicidades[].nome) mais a opção "outra" com texto
// livre — o corpus sugere, o médico não fica preso a ele.
export interface ToxicidadeRegistrada {
  nome: string;
  grau: number; // CTCAE 1–5
}

@Entity('retornos')
@Index(['paciente_id', 'data_realizada'])
export class Retorno {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column({ name: 'paciente_id' })
  paciente_id: number;

  // Avaliação (= protocolo em curso) sobre a qual este retorno fala. Sem ela o retorno
  // ficaria solto: "houve progressão" só diz alguma coisa contra um protocolo.
  @ManyToOne(() => Avaliacao, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'avaliacao_id' })
  avaliacao: Avaliacao;

  @Column({ name: 'avaliacao_id', nullable: true })
  avaliacao_id: number;

  // Congelado do protocolo em curso no momento do retorno — o registro continua legível
  // mesmo que a avaliação de origem suma (SET NULL) ou que o corpus mude de nome.
  @Column({ length: 160, nullable: true })
  regimen_id: string;

  // Para quando ESTE retorno estava previsto. Preenchida pelo SERVIDOR a partir da
  // agenda vigente no momento do registro — não é campo digitável.
  @Column({ type: 'date', nullable: true })
  data_agendada: string;

  @Column({ type: 'date' })
  data_realizada: string;

  // Houve exame de imagem/reestadiamento neste retorno? É o que habilita `resposta`.
  @Column({ type: 'boolean', default: false })
  com_imagem: boolean;

  @Column({ type: 'varchar', length: 20, default: 'nao_avaliada' })
  resposta: RespostaRetorno;

  @Column({ type: 'jsonb', nullable: true })
  toxicidades: ToxicidadeRegistrada[];

  @Column({ type: 'varchar', length: 20 })
  conduta: CondutaRetorno;

  // De onde veio o dado deste retorno (consulta presencial, laudo externo, telefone…) —
  // procedência explícita, no mesmo espírito do "confirmado precisa de DOI" do corpus.
  @Column({ length: 160, nullable: true })
  fonte_dados: string;

  // O que foi DECIDIDO nesta consulta sobre o próximo retorno — congelado junto com o
  // resto do registro. A agenda do paciente muda; isto não. `proximo_intervalo` guarda a
  // ESCOLHA ('3s'|'1m'|'2m'|'3m'|'especifica'|'nenhum'), que é o que sugere o intervalo
  // do retorno seguinte; subtrair datas para adivinhá-la daria "28 dias" para quem
  // escolheu "1 mês" em fevereiro.
  @Column({ type: 'date', nullable: true })
  proximo_retorno: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  proximo_intervalo: string;

  @Column({ type: 'text', nullable: true })
  observacoes: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'registrado_por' })
  registradoPor: Usuario;

  @Column({ name: 'registrado_por', nullable: true })
  registrado_por: number; // do JWT (servidor)

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criado_em: Date; // do servidor
}

// Postgres devolve `numeric` como STRING (para não perder precisão no caminho do driver).
// Sem transformer, `custo_ciclo_tabela * ciclos` viraria concatenação de string em vez de
// multiplicação — o tipo de bug que passa no teste feliz e entrega um total absurdo.
const dinheiro = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null || v === undefined ? null : Number(v)),
};

// CUSTO POR CICLO, POR REGIME — a metade "preço" da expectativa de custo global.
// (A metade "tempo" é `expectativa_uso`, que vem do corpus do squad e NÃO mora no banco.)
//
// Preço DUPLO de propósito: tabela CMED é teto público e negociado é o que a operadora
// paga de fato. A estimativa sai em FAIXA porque o número exato depende de contrato — dar
// um valor único aqui seria fingir precisão que não existe.
//
// Nível REGIME nesta fase: um custo por protocolo, cadastrado pelo admin. Custo por
// fármaco+dose (que exige superfície corporal do paciente) espera o módulo BSA — está no
// backlog, e é por isso que aqui não há coluna de fármaco.
//
// Escrita: admin. Leitura: auditor + admin (whitelist explícita no controller).
@Entity('custos_regime')
export class CustoRegime {
  // O regimen_id é a chave: um registro por protocolo, sobrescrito no cadastro.
  @PrimaryColumn({ length: 160 })
  regimen_id: string;

  // Teto público (CMED). É o extremo SUPERIOR da faixa.
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: dinheiro })
  custo_ciclo_tabela: number;

  // O que a operadora paga de fato. Extremo INFERIOR da faixa.
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: dinheiro })
  custo_ciclo_negociado: number;

  // Rastro obrigatório dos DOIS preços: nenhum número aparece na tela sem fonte.
  // Ex.: "CMED 2026-01 (PMVG 18%)" / "Contrato Operadora X, aditivo 2026-03".
  @Column({ length: 200 })
  fonte_tabela: string;

  @Column({ length: 200 })
  fonte_negociado: string;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizado_em: Date; // do servidor

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'atualizado_por' })
  atualizadoPor: Usuario;

  @Column({ name: 'atualizado_por', nullable: true })
  atualizado_por: number; // do JWT do admin (servidor)
}
