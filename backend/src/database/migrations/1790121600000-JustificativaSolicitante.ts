import { MigrationInterface, QueryRunner } from 'typeorm';

// JUSTIFICATIVA DO SOLICITANTE (pedido da direção, 2026-09-17) — coluna própria em
// `avaliacoes` para o texto do médico ao pedir uma exceção (protocolo Inelegível ou Não
// incorporado). Até aqui a justificativa vivia EMBUTIDA em detalhe_semaforo.ressalva
// ("Selecionado apesar de NÃO incorporado (motivo) — justificativa: <texto>") e o
// Inelegível nem tinha texto livre (era um confirm). Agora: obrigatória no servidor
// sempre que a avaliação nasce 'pendente'; o auditor lê na fila; a trilha registra as
// duas pontas (esta e o parecer).
//
// Backfill: o que já estava dentro da ressalva sai para a coluna, pelo marcador
// "justificativa: " (o texto do médico é sempre o que vem DEPOIS do último marcador —
// a ressalva composta inelegível+não incorporado tem o marcador uma vez só, no fim).
// A ressalva não é alterada: continua sendo o contexto que a app montou na hora.
export class JustificativaSolicitante1790121600000 implements MigrationInterface {
  name = 'JustificativaSolicitante1790121600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "avaliacoes" ADD COLUMN IF NOT EXISTS "justificativa_solicitante" text`);
    await queryRunner.query(`
      UPDATE "avaliacoes"
         SET "justificativa_solicitante" = NULLIF(BTRIM(SUBSTRING("detalhe_semaforo"->>'ressalva' FROM 'justificativa: (.*)$')), '')
       WHERE "justificativa_solicitante" IS NULL
         AND "autorizacao_estado" <> 'nao_necessaria'
         AND ("detalhe_semaforo"->>'ressalva') ~ 'justificativa: '`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // O texto migrado continua dentro da ressalva; o digitado depois de 2026-09-17 se
    // perde — e é para o down avisar isso, não fazê-lo em silêncio.
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP COLUMN IF EXISTS "justificativa_solicitante"`);
  }
}
