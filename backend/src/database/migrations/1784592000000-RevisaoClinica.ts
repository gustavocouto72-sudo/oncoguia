import { MigrationInterface, QueryRunner } from 'typeorm';

// Revisão clínica dos protocolos (camada humana sobre os 295 do squad).
// Append-only e imutável (como avaliacoes): uma linha por decisão; mudar de ideia = nova linha.
// Ancorada em regimen_id + content_hash — quando o squad re-roda e o conteúdo muda, a revisão
// "expira" (protocolo volta a pendente_re_revisao). Migration idempotente.
export class RevisaoClinica1784592000000 implements MigrationInterface {
  name = 'RevisaoClinica1784592000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "revisoes" (
        "id" SERIAL PRIMARY KEY,
        "regimen_id" character varying(160) NOT NULL,
        "content_hash" character varying(64) NOT NULL,
        "revisor_id" integer,
        "decisao" character varying(20) NOT NULL,
        "justificativa" text,
        "eixo" character varying(20),
        "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_revisoes_usuario" FOREIGN KEY ("revisor_id")
          REFERENCES "usuarios"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_revisoes_decisao"
          CHECK ("decisao" IN ('aprovado','contestado','ajuste_solicitado'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_revisoes_regimen_hash" ON "revisoes" ("regimen_id", "content_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_revisoes_regimen_data" ON "revisoes" ("regimen_id", "criado_em")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "revisoes"`);
  }
}
