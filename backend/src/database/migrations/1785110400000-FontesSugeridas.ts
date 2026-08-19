import { MigrationInterface, QueryRunner } from 'typeorm';

// Fontes sugeridas pelos revisores clínicos (protocolos com selo incompleto).
// O revisor envia DOI/PMID/link ou o PDF pelo navegador; o backend guarda aqui e no
// storage próprio (uploads/fontes-sugeridas). O passo de filesystem — salvar em
// data/input/fontes-manuais/<regimen_id>.pdf e re-rodar o intake — é do ADMIN,
// que trabalha sobre esta tabela (visão de curadoria).
export class FontesSugeridas1785110400000 implements MigrationInterface {
  name = 'FontesSugeridas1785110400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fontes_sugeridas" (
        "id" SERIAL PRIMARY KEY,
        "regimen_id" character varying(160) NOT NULL,
        "content_hash" character varying(64) NOT NULL,
        "revisor_id" integer REFERENCES "usuarios"("id") ON DELETE SET NULL,
        "tipo" character varying(10) NOT NULL,
        "valor" text,
        "arquivo_nome" character varying(255),
        "arquivo_path" character varying(500),
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_fontes_sugeridas_tipo" CHECK ("tipo" IN ('doi','pmid','url','pdf'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fontes_sugeridas_regime_data" ON "fontes_sugeridas" ("regimen_id", "criado_em")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "fontes_sugeridas"`);
  }
}
