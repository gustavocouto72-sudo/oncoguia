import {
  Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

// Perfis são WHITELIST, nunca hierarquia: 'auditor' não é "revisor com mais poder" —
// é um eixo próprio (autoriza exceção de protocolo), e não herda nada de ninguém.
// 'gestor' é outro eixo próprio, e o mais restrito de todos: vê recursos (insumos,
// projeção de compra, faturamento, margem) e NADA de clínico — não revisa protocolo,
// não decide autorização, e não recebe NOME de paciente. A pseudonimização é do
// SERVIDOR (a resposta não carrega o nome), não filtro de tela.
// 'secretaria' é o espelho do gestor: recebe o NOME e o cadastro (registro, nascimento,
// convênio, médico assistente, agenda de retorno) e NADA de clínico — sem tumor, sem
// protocolo, sem semáforo, sem trilha, sem corpus de evidência, sem dinheiro. A fronteira
// é "administrativo = dela; clínico = nunca", e o corte é no SELECT do servidor (a
// resposta dela não carrega tumor), não filtro de tela — mesmo padrão da pseudonimização.
export type Perfil = 'oncologista' | 'revisor' | 'auditor' | 'admin' | 'gestor' | 'secretaria';

// O vocabulário fechado, num lugar só — DTO, CHECK do banco e tela de admin leem daqui.
export const PERFIS: Perfil[] = ['oncologista', 'revisor', 'auditor', 'admin', 'gestor', 'secretaria'];

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

  // PERFIL ATIVO PADRÃO — o chapéu que o login entrega. Não é mais "o perfil da pessoa":
  // é o item de `perfis` com que a sessão começa. O CHECK do banco garante que ele SEMPRE
  // pertence à lista (CHK_usuarios_perfis).
  @Column({ type: 'varchar', length: 20, default: 'oncologista' })
  perfil: Perfil;

  // A LISTA de chapéus que esta pessoa pode vestir — um por vez. Quem define é o admin.
  // Trocar = POST /auth/trocar-perfil, que valida o pedido CONTRA ESTA LISTA e emite um
  // token novo. O token continua carregando UM perfil: os guards não mudam de lógica.
  @Column({ type: 'varchar', length: 20, array: true, default: () => `ARRAY['oncologista']::varchar(20)[]` })
  perfis: Perfil[];

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

// Postgres devolve `numeric` como STRING (para não perder precisão no caminho do driver).
// Sem transformer, `custo_ciclo_tabela * ciclos` viraria concatenação de string em vez de
// multiplicação — o tipo de bug que passa no teste feliz e entrega um total absurdo.
const dinheiro = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null || v === undefined ? null : Number(v)),
};

// LGPD: nesta fase os pacientes são FICTÍCIOS (validação). O schema já nasce no
// padrão de produção — dados administrativos mínimos, sem dado clínico solto na
// tabela; o clínico entra estruturado em selecoes_protocolo.dados_clinicos.
// Item de uma das três listas de problemas do paciente. `registrado_por` é uma fotografia
// (id + nome) — a lista é lida direto da ficha, sem join; e o nome do autor no momento do
// registro é o que a trilha também mostra.
export interface ItemListaProblemas {
  texto: string;
  origem: string;
  registrado_por: { id: number; nome: string } | null;
  em: string; // ISO timestamp
}
export type ListaProblemas = 'comorbidades' | 'medicacoes_uso' | 'alergias';
export const LISTAS_PROBLEMAS: ListaProblemas[] = ['comorbidades', 'medicacoes_uso', 'alergias'];

// ---- CABEÇALHO ONCOLÓGICO (lista de problemas · parte clínica) ----
// A estrutura é a do guia de cabeçalho oncológico do revisor — o que ele já escreve à mão
// no "Evoluções Anteriores" do TASY. Princípio que atravessa tudo: OMITIR É PREFERÍVEL A
// INFERIR. Campo sem informação fica ausente (não vira "não realizou"); data incompleta
// fica incompleta (mm/aaaa e aaaa são válidas como estão; ninguém completa dia ou mês).
export type TipoLinhaCabecalho = 'apresentacao' | 'propedeutica' | 'terapeutica';
export const TIPOS_LINHA_CABECALHO: TipoLinhaCabecalho[] = ['apresentacao', 'propedeutica', 'terapeutica'];
// Campo de texto com autoria: título, subtítulo e status atual. `em`/`por` são do servidor.
export interface TextoCabecalho { texto: string; em: string; por: { id: number; nome: string } | null }
export interface LinhaCabecalho {
  id: string;
  tipo: TipoLinhaCabecalho;
  data: string | null;      // dd/mm/aaaa | mm/aaaa | aaaa — parcial fica parcial
  rotulo: string | null;    // alternativa curta à data (S1, C3, D15) — típico da intercorrência
  texto: string;
  pai_id: string | null;    // preenchido = intercorrência da linha-pai (só terapêutica tem filhos)
  origem: string;           // 'manual' | 'importacao (evolução de dd/mm/aaaa)'
  por: { id: number; nome: string } | null;
  em: string;               // ISO timestamp
}
// Marcador tumoral NÃO é linha de texto: é série (valor, data) — a tela destaca subida e
// último valor; o texto do prontuário imprime a série com setas.
export interface PontoMarcador { valor: string; data: string }
export interface MarcadorCabecalho { id: string; nome: string; unidade: string | null; pontos: PontoMarcador[] }
export interface CabecalhoOncologico {
  titulo?: TextoCabecalho;
  subtitulo?: TextoCabecalho;
  linhas?: LinhaCabecalho[];
  marcadores?: MarcadorCabecalho[];
  status_atual?: TextoCabecalho;
}

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

  // ---- Medidas do paciente (opcionais) ----
  // Existem só para REFINAR a dose calculada no módulo de recursos: mg/m² precisa de
  // superfície corporal e mg/kg precisa de peso. Sem elas, o cálculo usa o paciente-padrão
  // DECLARADO (premissas_recursos) e a tela diz que está usando o padrão — nunca finge que
  // o número é do paciente. Numeric vem como string do Postgres, daí o transformer.
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: dinheiro })
  peso_kg: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 1, nullable: true, transformer: dinheiro })
  altura_cm: number | null;

  // Campos primitivos com estavel:true congelados no cadastro (biologia imutável do tumor).
  // Servem SÓ para pré-preencher e TRAVAR na reavaliação — nunca são a fonte de verdade de
  // uma avaliação (essa é o snapshot_campos da própria Avaliacao).
  @Column({ type: 'jsonb', nullable: true })
  valores_estaveis: Record<string, any>;

  // ---- LISTA DE PROBLEMAS (comorbidades · medicações em uso · alergias) ----
  // O que o oncologista assistencial olha de relance antes de decidir. Cada item guarda
  // de onde veio (`origem`: "registro manual" na ficha, ou "importação (evolução de …)"
  // quando a validação de uma proposta o gravou), quem gravou e quando. É estado MUTÁVEL
  // (item entra e sai pela ficha) — o rastro de cada mudança vai para a trilha como evento
  // administrativo 'lista_problemas', append-only. Dado CLÍNICO: fora do payload da
  // secretaria (não entra no SELECT_ADMINISTRATIVO) e escrita só por quem trata.
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  comorbidades: ItemListaProblemas[];

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  medicacoes_uso: ItemListaProblemas[];

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  alergias: ItemListaProblemas[];

  // ---- CABEÇALHO ONCOLÓGICO ----
  // O resto da lista de problemas: título, subtítulo, linhas tipadas (apresentação ·
  // propedêutica · terapêutica, com intercorrências como filhas), marcadores em série e
  // status atual. Um objeto só, default {} (a ficha não distingue "sem cabeçalho" de
  // "cabeçalho vazio"). O CHECK da migration limita `tipo` das linhas ao vocabulário
  // literal; o resto da validação (data parcial, pai só em terapêutica) é do serviço.
  // Mesmo regime das três listas: estado mutável, rastro append-only na trilha (evento
  // 'cabecalho_oncologico'), dado clínico fora do payload da secretaria.
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  cabecalho_oncologico: CabecalhoOncologico;

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

  // COM QUE CHAPÉU esta avaliação foi feita. Desde que uma pessoa pode ter vários perfis,
  // `avaliadoPor.perfil` responde "o que ele é hoje", não "o que ele era ao gravar" — e é
  // a segunda pergunta que a trilha precisa responder. Vem do JWT (perfil ativo), nunca
  // do cliente. Null só quando o autor foi removido (ON DELETE SET NULL).
  @Column({ name: 'perfil_ativo', type: 'varchar', length: 20, nullable: true })
  perfil_ativo: Perfil;

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
  // (detalhe_semaforo.ressalva guarda o CONTEXTO montado pela app ao selecionar fora do
  //  padrão — "selecionado apesar de Inelegível — critérios: …" / "apesar de NÃO
  //  incorporado (motivo)". Até 2026-09-17 a justificativa livre do médico ia embutida
  //  aqui; agora tem coluna própria, abaixo.)

  // ---- Solicitação de exceção (autorização do auditor) ----
  // Seleção normal nasce 'nao_necessaria'. Inelegível/Não incorporado nasce 'pendente' e
  // só vira vigente quando um auditor aprova. Ver AutorizacaoEstado.
  @Column({ type: 'varchar', length: 20, default: 'nao_necessaria' })
  autorizacao_estado: AutorizacaoEstado;

  // JUSTIFICATIVA DO SOLICITANTE — o texto do médico ao pedir a exceção (Inelegível ou
  // Não incorporado). OBRIGATÓRIA no servidor sempre que a avaliação nasce 'pendente':
  // é o que o auditor lê para decidir, e a trilha guarda as duas pontas (esta + o
  // parecer). Null nas seleções normais e nas solicitações anteriores a 2026-09-17 sem
  // texto livre (inelegível era só um confirm); as antigas de não incorporado foram
  // migradas a partir da ressalva ("— justificativa: …").
  @Column({ type: 'text', nullable: true })
  justificativa_solicitante: string;

  // Parecer do auditor — OBRIGATÓRIO nas duas decisões (aprovar e negar). O médico lê
  // o desfecho na trilha do paciente; negada permanece visível com este texto.
  @Column({ type: 'text', nullable: true })
  autorizacao_parecer: string;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'autorizacao_auditor_id' })
  autorizacaoAuditor: Usuario;

  @Column({ name: 'autorizacao_auditor_id', nullable: true })
  autorizacao_auditor_id: number; // do JWT do auditor (servidor)

  // Chapéu de quem DECIDIU — coluna própria porque a decisão mora na mesma linha do
  // pedido, e pedido e decisão são pessoas (e perfis) diferentes.
  @Column({ name: 'autorizacao_perfil_ativo', type: 'varchar', length: 20, nullable: true })
  autorizacao_perfil_ativo: Perfil;

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

  // Chapéu ativo no momento do parecer — ver Avaliacao.perfil_ativo.
  @Column({ name: 'perfil_ativo', type: 'varchar', length: 20, nullable: true })
  perfil_ativo: Perfil;

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

  // Chapéu ativo no momento do registro — ver Avaliacao.perfil_ativo.
  @Column({ name: 'perfil_ativo', type: 'varchar', length: 20, nullable: true })
  perfil_ativo: Perfil;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criado_em: Date; // do servidor
}

// EVENTO ADMINISTRATIVO — o que a SECRETARIA registra sobre o paciente, sem tocar em nada
// clínico. Dois tipos, na mesma tabela append-only:
//   'reagendamento' — a DATA do próximo retorno mudou (pacientes.proximo_retorno, a coluna
//                     mutável de agenda). `data_anterior` → `data` guardam de onde para onde,
//                     `nota` é o motivo curto. A DECISÃO clínica de intervalo (retornos.
//                     proximo_retorno/proximo_intervalo, congelada no registro do médico)
//                     NÃO muda: o médico decidiu "em 1 mês"; a secretaria só moveu o dia.
//   'contato'       — contato com paciente faltoso: `data` do contato, `meio` (telefone,
//                     whatsapp, email, presencial, outro) e `nota` curta.
// Append-only como avaliações e retornos: não há rota de UPDATE/DELETE; correção é linha
// nova. Aparece na trilha do médico como evento administrativo (tipo próprio) — quem cuida
// do paciente vê que a agenda foi mexida, por quem e por quê.
// Quem pode registrar é whitelist de ROTA (secretaria + quem trata o paciente) — o perfil
// ativo fica carimbado aqui como nos irmãos (Avaliacao.perfil_ativo).
export type TipoEventoAdministrativo = 'reagendamento' | 'contato' | 'lista_problemas' | 'cabecalho_oncologico';
export type MeioContato = 'telefone' | 'whatsapp' | 'email' | 'presencial' | 'outro';
export const MEIOS_CONTATO: MeioContato[] = ['telefone', 'whatsapp', 'email', 'presencial', 'outro'];

@Entity('eventos_administrativos')
@Index(['paciente_id', 'criado_em'])
export class EventoAdministrativo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column({ name: 'paciente_id' })
  paciente_id: number;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoEventoAdministrativo;

  // reagendamento: a data NOVA do retorno; contato: o dia em que o contato aconteceu.
  @Column({ type: 'date' })
  data: string;

  // reagendamento: a data que valia antes (de onde saiu). Nulo no contato.
  @Column({ type: 'date', nullable: true })
  data_anterior: string | null;

  // contato: por que meio. Nulo no reagendamento.
  @Column({ type: 'varchar', length: 20, nullable: true })
  meio: MeioContato | null;

  // Motivo do reagendamento / nota do contato. CURTA de propósito: é registro
  // administrativo, não evolução — o campo é limitado no DTO e no banco.
  @Column({ type: 'varchar', length: 280, nullable: true })
  nota: string | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'registrado_por' })
  registradoPor: Usuario;

  @Column({ name: 'registrado_por', nullable: true })
  registrado_por: number; // do JWT (servidor)

  @Column({ name: 'perfil_ativo', type: 'varchar', length: 20, nullable: true })
  perfil_ativo: Perfil;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criado_em: Date;
}

// PROPOSTA DE IMPORTAÇÃO — o envelope administrativo do paciente que entra pronto.
//
// Duas alçadas, UM ponto de digitação: a secretaria importa o paciente inteiro (cadastro
// pela rota normal + esta proposta), e os dados clínicos ficam aqui como PROPOSTA
// PENDENTE — não são registro clínico, não são lidos por nenhum motor, não aparecem em
// snapshot nenhum. O oncologista abre o paciente, vê a tabela pronta (campo, valor
// proposto, trecho de evidência do prontuário), corrige o que precisar e VALIDA: o clique
// dele é o que grava os primitivos no paciente, roda o semáforo NO SERVIDOR e — só no
// verde (elegível + incorporado) — cria a avaliação vigente. Qualquer outra cor devolve o
// motivo e não seleciona nada; nunca nasce exceção automática. As assinaturas (avaliação,
// retorno) são do VALIDADOR; a proposta aparece na trilha como evento administrativo com
// o nome de quem a enviou.
//
// `payload` é o envelope como a secretaria (ou, na entrega 2, a extração) o enviou —
// imutável depois de criado: { tumor, regimen_id?, campos:[{campo,valor,trecho}],
// meta:{data_inicio, data_evolucao, proximo_retorno, medico_assistente_texto, sem_campo[],
// historico, protocolo_texto} }. `resultado` é o que a validação produziu (correções
// aplicadas, semáforo, ids criados, motivo de não-seleção) — para a ficha e a trilha
// contarem o que aconteceu sem recalcular nada.
//
// No máximo UMA proposta pendente por paciente (índice parcial + checagem no serviço → 409).
// `validada_por`/`validada_em` = quem decidiu e quando, nos DOIS desfechos (validada ou
// descartada); o desfecho está em `estado`, e o motivo do descarte em `motivo_descarte`.
export type EstadoProposta = 'pendente' | 'validada' | 'descartada';
export const ESTADOS_PROPOSTA: EstadoProposta[] = ['pendente', 'validada', 'descartada'];

@Entity('importacao_propostas')
@Index(['paciente_id', 'criada_em'])
export class ImportacaoProposta {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Paciente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paciente_id' })
  paciente: Paciente;

  @Column({ name: 'paciente_id' })
  paciente_id: number;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  estado: EstadoProposta;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'criada_por' })
  criadaPor: Usuario;

  @Column({ name: 'criada_por', nullable: true })
  criada_por: number; // do JWT

  // Chapéu de quem ENVIOU (secretaria ou admin) — como nos irmãos, do JWT.
  @Column({ name: 'perfil_ativo', type: 'varchar', length: 20, nullable: true })
  perfil_ativo: Perfil;

  @CreateDateColumn({ name: 'criada_em', type: 'timestamptz' })
  criada_em: Date;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'validada_por' })
  validadaPor: Usuario;

  @Column({ name: 'validada_por', nullable: true })
  validada_por: number; // do JWT do validador (servidor)

  @Column({ name: 'validada_em', type: 'timestamptz', nullable: true })
  validada_em: Date;

  @Column({ name: 'motivo_descarte', type: 'text', nullable: true })
  motivo_descarte: string;

  @Column({ type: 'jsonb', nullable: true })
  resultado: Record<string, any>;
}

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
// Escrita: admin. Leitura: gestor + admin (whitelist explícita no controller). O auditor
// saiu da leitura quando o dinheiro saiu do fluxo de autorização: ele decide mérito, não
// custo.
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

  // "O preço cadastrado cobre este período, em dias." Existe para o caso que o esquema
  // não resolve: oral diário contínuo (osimertinibe, sunitinibe, pazopanibe) não tem
  // intervalo de ciclo NENHUM no texto, então o servidor não consegue converter meses de
  // tratamento em ciclos e o regime fica sem custo mesmo com preço cadastrado.
  //
  // É um dado ADMINISTRATIVO, declarado por quem cadastra o preço — não sai de extração
  // clínica, e a tela precisa dizer isso. Por que não derivar: derivar exigiria escolher
  // um intervalo que o esquema não afirma, que é exatamente o chute que este módulo
  // recusa. Declarar é honesto; adivinhar não.
  //
  // null (default) = o preço é por ciclo e o intervalo vem do esquema. Sem valor aqui e
  // sem periodicidade no esquema, o regime segue sem conversão — nunca há default
  // silencioso de 30 dias.
  @Column({ type: 'int', nullable: true })
  periodo_dias: number | null;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizado_em: Date; // do servidor

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'atualizado_por' })
  atualizadoPor: Usuario;

  @Column({ name: 'atualizado_por', nullable: true })
  atualizado_por: number; // do JWT do admin (servidor)
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURSOS — os dois lados do dinheiro, no nível do INSUMO.
//
// `custos_regime` (acima) responde "quanto custa um ciclo deste protocolo", com um preço
// cadastrado à mão por protocolo. Isto aqui responde a pergunta operacional: "quantos
// frascos de qual fármaco o hospital compra, e quanto cobra da operadora por eles".
// Os dois convivem: o preço por protocolo vira FALLBACK, e toda saída de tela diz qual
// dos dois produziu o número (origem: insumo | protocolo-fallback | sem dado).

// Fármaco canônico. O nome é o MESMO vocabulário que o bloco `composicao` do corpus usa
// (extracao-composicao/lexico.py) — é essa igualdade literal que liga dose a preço. Não
// há tabela de sinônimos aqui de propósito: sinônimo silencioso é como se casa a dose de
// uma droga com o preço de outra.
@Entity('insumos')
export class Insumo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120, unique: true })
  farmaco: string;

  @Column({ default: true })
  ativo: boolean;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizado_em: Date;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'atualizado_por' })
  atualizadoPor: Usuario;

  @Column({ name: 'atualizado_por', nullable: true })
  atualizado_por: number;
}

// Unidades em que um frasco/comprimido pode ser medido. Fechado, e casado com a dimensão
// da dose: mg/g/mcg e AUC caem na dimensão 'mg'; UI e GBq são dimensões próprias e só
// casam com dose na mesma dimensão. Sem isso, "30 UI de BCG" acharia preço num frasco de
// 30 mg de outra coisa.
export type UnidadeApresentacao = 'mg' | 'g' | 'mcg' | 'UI' | 'GBq';

@Entity('apresentacoes')
@Index(['insumo_id'])
export class Apresentacao {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Insumo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'insumo_id' })
  insumo: Insumo;

  @Column({ name: 'insumo_id' })
  insumo_id: number;

  // Rótulo humano ("frasco-ampola 150 mg"). NÃO entra em conta nenhuma — quem entra é o
  // par conteudo_valor/conteudo_unidade. Texto e número separados porque texto de rótulo
  // muda ("150mg", "150 mg", "FA 150 mg") e conta não pode depender de grafia.
  @Column({ length: 120 })
  conteudo: string;

  @Column({ type: 'numeric', precision: 12, scale: 3, transformer: dinheiro })
  conteudo_valor: number;

  @Column({ type: 'varchar', length: 10 })
  conteudo_unidade: UnidadeApresentacao;

  // Qual apresentação o cálculo usa quando o insumo tem mais de uma. Sem marcação e com
  // mais de uma, o servidor devolve "sem dado" em vez de escolher: a apresentação decide
  // o desperdício (2 frascos de 100 mg para uma dose de 150 mg desperdiçam 50 mg; 1 de
  // 150 mg não desperdiça nada), e com ele o custo.
  @Column({ default: false })
  padrao: boolean;

  // COMPRA — o que o hospital paga. Faixa, pelo mesmo motivo de custos_regime: tabela
  // CMED é teto público, negociado é o que se paga de fato.
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: dinheiro })
  preco_compra_tabela: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: dinheiro })
  preco_compra_negociado: number;

  // FATURAMENTO — o que se cobra da operadora. NULLABLE, e essa é a decisão de modelagem
  // que mais importa aqui: sem contrato cadastrado NÃO HÁ projeção de receita. Herdar o
  // preço de compra produziria margem zero — um número que parece resposta e é a
  // ausência de resposta.
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: dinheiro })
  preco_faturamento: number | null;

  // Rastro obrigatório de cada preço. Nenhum número aparece na tela sem fonte.
  @Column({ length: 200 })
  fonte_compra_tabela: string;

  @Column({ length: 200 })
  fonte_compra_negociado: string;

  @Column({ length: 200, nullable: true })
  fonte_faturamento: string | null;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizado_em: Date;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'atualizado_por' })
  atualizadoPor: Usuario;

  @Column({ name: 'atualizado_por', nullable: true })
  atualizado_por: number;
}

// PACIENTE-PADRÃO DECLARADO — linha única (id=1).
//
// Existe para o cálculo ter um corpo quando o paciente não tem peso/altura no cadastro.
// São DECLARAÇÕES administrativas, não medidas, e a tela precisa dizer isso: um custo
// calculado sobre 1,75 m² é o custo de um paciente que não existe. Ficam em tabela, e não
// em constante no código, porque a especificação pede que sejam configuráveis e visíveis.
@Entity('premissas_recursos')
export class PremissasRecursos {
  @PrimaryColumn({ type: 'int' })
  id: number; // sempre 1 (CHECK no banco)

  @Column({ type: 'numeric', precision: 4, scale: 2, transformer: dinheiro })
  sc_m2: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: dinheiro })
  peso_kg: number;

  // Clearance de creatinina usado na fórmula de Calvert (dose_mg = AUC × (CrCl + 25)).
  @Column({ type: 'numeric', precision: 5, scale: 1, transformer: dinheiro })
  clearance_ml_min: number;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizado_em: Date;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'atualizado_por' })
  atualizadoPor: Usuario;

  @Column({ name: 'atualizado_por', nullable: true })
  atualizado_por: number;
}
