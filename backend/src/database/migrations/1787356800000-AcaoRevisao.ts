import { MigrationInterface, QueryRunner } from 'typeorm';

// AÇÃO explícita da contestação/ajuste (`revisoes.acao` + `revisoes.acao_detalhe`).
// Antes, todo parecer de natureza 'dado' virava reprocessar=true no export — ambíguo:
// um "RETIRAR o regime" e um "pode aprovar do jeito que está" caíam no mesmo balde,
// e um regime removido voltaria no run seguinte. A ação é o que o intake do squad
// (Steps 08/10) roteia de fato:
//   remover | corrigir_referencia | ajustar_elegibilidade | manter_anotar | outro
// Regra de segurança: remover e corrigir_referencia são destrutivos/mutantes — o squad
// só age com `acao` setada explicitamente, NUNCA deduzida do texto livre.
// As linhas existentes ficam com acao NULL (legado): o intake propõe um balde por
// decisão lendo o texto e apresenta para o humano confirmar antes de executar.
export class AcaoRevisao1787356800000 implements MigrationInterface {
  name = 'AcaoRevisao1787356800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "revisoes" ADD COLUMN IF NOT EXISTS "acao" character varying(30)`);
    await queryRunner.query(`ALTER TABLE "revisoes" ADD COLUMN IF NOT EXISTS "acao_detalhe" text`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "revisoes" ADD CONSTRAINT "CHK_revisoes_acao"
          CHECK ("acao" IS NULL OR "acao" IN ('remover','corrigir_referencia','ajustar_elegibilidade','manter_anotar','outro'));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "revisoes" DROP CONSTRAINT IF EXISTS "CHK_revisoes_acao"`);
    await queryRunner.query(`ALTER TABLE "revisoes" DROP COLUMN IF EXISTS "acao_detalhe"`);
    await queryRunner.query(`ALTER TABLE "revisoes" DROP COLUMN IF EXISTS "acao"`);
  }
}
