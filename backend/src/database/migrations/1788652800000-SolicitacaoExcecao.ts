import { MigrationInterface, QueryRunner } from 'typeorm';

// SOLICITAÇÃO DE EXCEÇÃO — protocolo Inelegível ou Não incorporado só vira vigente com
// autorização de auditor. Duas coisas entram aqui:
//
//  1) perfil 'auditor' no vocabulário de usuários. A coluna já era varchar sem CHECK — o
//     "enum" vivia só no TypeScript. Passa a existir no banco, com os quatro perfis, para
//     que um perfil inválido não entre por outra porta (seed, SQL manual, importação).
//
//  2) as quatro colunas de autorização em `avaliacoes`. A avaliação continua IMUTÁVEL no
//     conteúdo clínico: o que estas colunas registram é a decisão administrativa sobre
//     aquela seleção — uma vez, sem volta. Os CHECKs garantem a coerência do par
//     estado/decisão: enquanto está pendente (ou não precisa de exceção) não há parecer,
//     auditor nem data; decidida (aprovada|negada) exige os três. Nada some: uma exceção
//     negada permanece na trilha do paciente com o parecer do auditor.
export class SolicitacaoExcecao1788652800000 implements MigrationInterface {
  name = 'SolicitacaoExcecao1788652800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) perfil auditor
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfil"`);
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD CONSTRAINT "CHK_usuarios_perfil"
        CHECK ("perfil" IN ('oncologista','revisor','auditor','admin'))
    `);

    // 2) colunas de autorização
    await queryRunner.query(`
      ALTER TABLE "avaliacoes"
        ADD COLUMN IF NOT EXISTS "autorizacao_estado" character varying(20) NOT NULL DEFAULT 'nao_necessaria',
        ADD COLUMN IF NOT EXISTS "autorizacao_parecer" text,
        ADD COLUMN IF NOT EXISTS "autorizacao_auditor_id" integer,
        ADD COLUMN IF NOT EXISTS "autorizacao_decidida_em" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "avaliacoes" ADD CONSTRAINT "FK_avaliacoes_autorizacao_auditor"
          FOREIGN KEY ("autorizacao_auditor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP CONSTRAINT IF EXISTS "CHK_avaliacoes_autorizacao_estado"`);
    await queryRunner.query(`
      ALTER TABLE "avaliacoes" ADD CONSTRAINT "CHK_avaliacoes_autorizacao_estado"
        CHECK ("autorizacao_estado" IN ('nao_necessaria','pendente','aprovada','negada'))
    `);
    // Coerência do par estado/decisão: decidida exige parecer + auditor + data; não
    // decidida não pode ter nenhum dos três (parecer obrigatório nas DUAS decisões).
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP CONSTRAINT IF EXISTS "CHK_avaliacoes_autorizacao_decisao"`);
    await queryRunner.query(`
      ALTER TABLE "avaliacoes" ADD CONSTRAINT "CHK_avaliacoes_autorizacao_decisao"
        CHECK (
          ("autorizacao_estado" IN ('aprovada','negada')
            AND "autorizacao_parecer" IS NOT NULL
            AND "autorizacao_auditor_id" IS NOT NULL
            AND "autorizacao_decidida_em" IS NOT NULL)
          OR
          ("autorizacao_estado" IN ('nao_necessaria','pendente')
            AND "autorizacao_parecer" IS NULL
            AND "autorizacao_auditor_id" IS NULL
            AND "autorizacao_decidida_em" IS NULL)
        )
    `);
    // Fila do auditor: pendentes primeiro, por paciente.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_avaliacoes_autorizacao_estado" ON "avaliacoes" ("autorizacao_estado", "data")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_avaliacoes_autorizacao_estado"`);
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP CONSTRAINT IF EXISTS "CHK_avaliacoes_autorizacao_decisao"`);
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP CONSTRAINT IF EXISTS "CHK_avaliacoes_autorizacao_estado"`);
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP CONSTRAINT IF EXISTS "FK_avaliacoes_autorizacao_auditor"`);
    await queryRunner.query(`
      ALTER TABLE "avaliacoes"
        DROP COLUMN IF EXISTS "autorizacao_decidida_em",
        DROP COLUMN IF EXISTS "autorizacao_auditor_id",
        DROP COLUMN IF EXISTS "autorizacao_parecer",
        DROP COLUMN IF EXISTS "autorizacao_estado"
    `);
    // Usuários auditor viram oncologista antes de o CHECK antigo (sem 'auditor') voltar.
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfil"`);
    await queryRunner.query(`UPDATE "usuarios" SET "perfil" = 'oncologista' WHERE "perfil" = 'auditor'`);
  }
}
