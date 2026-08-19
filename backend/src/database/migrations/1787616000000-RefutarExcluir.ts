import { MigrationInterface, QueryRunner } from 'typeorm';

// Semântica de "remover" revista: rejeição clínica NÃO apaga o regime. A ação vira
// 'refutar' — o regime continua no corpo publicado, marcado não incorporado (motivo
// refutado) com a justificativa do revisor; só sai dos candidatos selecionáveis.
// Manter a informação é prova da completude da avaliação.
// Exceção estreita: 'excluir' (novo valor) — erro/duplicata (dado errado, não rejeição
// clínica) sai de vez do consolidado, com acao_detalhe dizendo qual o erro.
// Linhas antigas com acao='remover' eram rejeições clínicas → migram para 'refutar'.
export class RefutarExcluir1787616000000 implements MigrationInterface {
  name = 'RefutarExcluir1787616000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "revisoes" DROP CONSTRAINT IF EXISTS "CHK_revisoes_acao"`);
    await queryRunner.query(`UPDATE "revisoes" SET "acao" = 'refutar' WHERE "acao" = 'remover'`);
    await queryRunner.query(`
      ALTER TABLE "revisoes" ADD CONSTRAINT "CHK_revisoes_acao"
        CHECK ("acao" IS NULL OR "acao" IN ('refutar','excluir','corrigir_referencia','ajustar_elegibilidade','manter_anotar','outro'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "revisoes" DROP CONSTRAINT IF EXISTS "CHK_revisoes_acao"`);
    await queryRunner.query(`UPDATE "revisoes" SET "acao" = 'remover' WHERE "acao" IN ('refutar','excluir')`);
    await queryRunner.query(`
      ALTER TABLE "revisoes" ADD CONSTRAINT "CHK_revisoes_acao"
        CHECK ("acao" IS NULL OR "acao" IN ('remover','corrigir_referencia','ajustar_elegibilidade','manter_anotar','outro'))
    `);
  }
}
