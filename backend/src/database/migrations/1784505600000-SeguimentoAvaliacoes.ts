import { MigrationInterface, QueryRunner } from 'typeorm';

// Fluxo do paciente em seguimento:
//  - o tumor passa a ser atributo do paciente (sistema/tumor/subtipo + valores_estaveis);
//  - avaliacoes: registros imutáveis e empilhados (uma linha por reavaliação; correção = nova linha).
export class SeguimentoAvaliacoes1784505600000 implements MigrationInterface {
  name = 'SeguimentoAvaliacoes1784505600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Contexto oncológico no paciente (um tumor ativo por paciente).
    await queryRunner.query(`
      ALTER TABLE "pacientes"
        ADD COLUMN IF NOT EXISTS "identificador" character varying(60),
        ADD COLUMN IF NOT EXISTS "sistema" character varying(40),
        ADD COLUMN IF NOT EXISTS "tumor" character varying(60),
        ADD COLUMN IF NOT EXISTS "subtipo" character varying(120),
        ADD COLUMN IF NOT EXISTS "valores_estaveis" jsonb,
        ADD COLUMN IF NOT EXISTS "criado_por" integer,
        ADD COLUMN IF NOT EXISTS "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_pacientes_criado_por'
        ) THEN
          ALTER TABLE "pacientes"
            ADD CONSTRAINT "FK_pacientes_criado_por" FOREIGN KEY ("criado_por")
            REFERENCES "usuarios"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Avaliações — imutáveis e empilhadas. Sem coluna de UPDATE de conteúdo clínico.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "avaliacoes" (
        "id" SERIAL PRIMARY KEY,
        "paciente_id" integer NOT NULL,
        "data" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "avaliado_por" integer,
        "linha_tratamento" integer,
        "regimen_id" character varying(160) NOT NULL,
        "snapshot_campos" jsonb NOT NULL,
        "semaforo" character varying(20) NOT NULL,
        "detalhe_semaforo" jsonb,
        CONSTRAINT "FK_avaliacoes_paciente" FOREIGN KEY ("paciente_id")
          REFERENCES "pacientes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_avaliacoes_usuario" FOREIGN KEY ("avaliado_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_avaliacoes_paciente_data" ON "avaliacoes" ("paciente_id", "data")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "avaliacoes"`);
    await queryRunner.query(
      `ALTER TABLE "pacientes" DROP CONSTRAINT IF EXISTS "FK_pacientes_criado_por"`,
    );
    await queryRunner.query(`
      ALTER TABLE "pacientes"
        DROP COLUMN IF EXISTS "identificador",
        DROP COLUMN IF EXISTS "sistema",
        DROP COLUMN IF EXISTS "tumor",
        DROP COLUMN IF EXISTS "subtipo",
        DROP COLUMN IF EXISTS "valores_estaveis",
        DROP COLUMN IF EXISTS "criado_por",
        DROP COLUMN IF EXISTS "criado_em"
    `);
  }
}
