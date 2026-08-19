import { MigrationInterface, QueryRunner } from 'typeorm';

// O PDF da fonte sugerida passa a morar no banco (bytea), não em disco: o backend
// também roda na Vercel, onde o filesystem é efêmero/read-only. Uploads são pequenos
// (limite de 25 MB no interceptor; na Vercel o corpo da request é limitado a ~4,5 MB).
// A coluna arquivo_path fica como legado (não é mais escrita).
export class FonteArquivoNoBanco1785196800000 implements MigrationInterface {
  name = 'FonteArquivoNoBanco1785196800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fontes_sugeridas" ADD COLUMN IF NOT EXISTS "arquivo" bytea`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fontes_sugeridas" DROP COLUMN IF EXISTS "arquivo"`);
  }
}
