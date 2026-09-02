import { MigrationInterface, QueryRunner } from 'typeorm';

// RETORNO / TRILHA DO PACIENTE.
//
// Três coisas nascem aqui:
//  1) `retornos` — a consulta de seguimento, append-only e imutável como `avaliacoes`
//     (sem coluna de UPDATE de conteúdo clínico; correção é linha nova). A regra RECIST
//     — resposta só existe com exame de imagem — é validada no DTO e também escrita no
//     banco como CHECK: sem imagem, resposta só pode ser 'nao_avaliada'. Uma trava que
//     não passa pela app é a que ainda vale quando alguém escreve por fora dela.
//  2) `avaliacoes.retorno_id` — o elo retorno → troca de protocolo: a avaliação nova
//     nasce apontando para o retorno que a motivou (conduta = troca_protocolo).
//  3) agenda de reestadiamento no paciente (`proximo_reestadiamento` +
//     `intervalo_reestadiamento_meses`, padrão 3). É LEMBRETE, estado mutável — não é
//     registro clínico e por isso mora no paciente, não numa tabela append-only.
export class RetornoTrilha1788739200000 implements MigrationInterface {
  name = 'RetornoTrilha1788739200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- 1) retornos ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "retornos" (
        "id" SERIAL PRIMARY KEY,
        "paciente_id" integer NOT NULL,
        "avaliacao_id" integer,
        "regimen_id" character varying(160),
        "data_agendada" date,
        "data_realizada" date NOT NULL,
        "com_imagem" boolean NOT NULL DEFAULT false,
        "resposta" character varying(20) NOT NULL DEFAULT 'nao_avaliada',
        "toxicidades" jsonb,
        "conduta" character varying(20) NOT NULL,
        "fonte_dados" character varying(160),
        "observacoes" text,
        "registrado_por" integer,
        "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_retornos_paciente" FOREIGN KEY ("paciente_id")
          REFERENCES "pacientes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_retornos_avaliacao" FOREIGN KEY ("avaliacao_id")
          REFERENCES "avaliacoes"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_retornos_usuario" FOREIGN KEY ("registrado_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_retornos_resposta" CHECK ("resposta" IN
          ('resposta_completa','resposta_parcial','doenca_estavel','progressao','nao_avaliada')),
        CONSTRAINT "CHK_retornos_conduta" CHECK ("conduta" IN
          ('mantem','troca_protocolo','suspende')),
        -- RECIST no banco: sem exame de imagem, resposta só pode ser 'nao_avaliada'.
        CONSTRAINT "CHK_retornos_recist" CHECK ("com_imagem" = true OR "resposta" = 'nao_avaliada')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_retornos_paciente_data" ON "retornos" ("paciente_id", "data_realizada")`,
    );

    // ---- 2) elo retorno → avaliação motivada por ele ----
    await queryRunner.query(`ALTER TABLE "avaliacoes" ADD COLUMN IF NOT EXISTS "retorno_id" integer`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "avaliacoes" ADD CONSTRAINT "FK_avaliacoes_retorno"
          FOREIGN KEY ("retorno_id") REFERENCES "retornos"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ---- 3) agenda de reestadiamento (lembrete, por paciente) ----
    await queryRunner.query(`
      ALTER TABLE "pacientes"
        ADD COLUMN IF NOT EXISTS "proximo_reestadiamento" date,
        ADD COLUMN IF NOT EXISTS "intervalo_reestadiamento_meses" integer NOT NULL DEFAULT 3
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "pacientes" ADD CONSTRAINT "CHK_pacientes_intervalo_reest"
          CHECK ("intervalo_reestadiamento_meses" BETWEEN 1 AND 24);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP CONSTRAINT IF EXISTS "FK_avaliacoes_retorno"`);
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP COLUMN IF EXISTS "retorno_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "retornos"`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP CONSTRAINT IF EXISTS "CHK_pacientes_intervalo_reest"`);
    await queryRunner.query(`
      ALTER TABLE "pacientes"
        DROP COLUMN IF EXISTS "proximo_reestadiamento",
        DROP COLUMN IF EXISTS "intervalo_reestadiamento_meses"
    `);
  }
}
