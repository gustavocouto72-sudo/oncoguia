import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1784419200000 implements MigrationInterface {
  name = 'InitialSchema1784419200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "usuarios" (
        "id" SERIAL PRIMARY KEY,
        "nome" character varying(120) NOT NULL,
        "login" character varying(60) NOT NULL,
        "senha_hash" character varying(255) NOT NULL,
        "perfil" character varying(20) NOT NULL DEFAULT 'oncologista',
        "ativo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "UQ_usuarios_login" UNIQUE ("login")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "pacientes" (
        "id" SERIAL PRIMARY KEY,
        "nome" character varying(160) NOT NULL,
        "nasc" date,
        "sexo" character varying(1) NOT NULL DEFAULT 'F',
        "cidade" character varying(120),
        "operadora" character varying(80),
        "plano" character varying(120),
        "carteirinha" character varying(60)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "selecoes_protocolo" (
        "id" SERIAL PRIMARY KEY,
        "paciente_id" integer NOT NULL,
        "regimen_id" character varying(160) NOT NULL,
        "protocolo_nome" character varying(255) NOT NULL,
        "tumor" character varying(60),
        "dados_clinicos" jsonb,
        "justificativa" text,
        "selecionado_por" integer,
        "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_selecoes_paciente" FOREIGN KEY ("paciente_id")
          REFERENCES "pacientes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_selecoes_usuario" FOREIGN KEY ("selecionado_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_selecoes_paciente" ON "selecoes_protocolo" ("paciente_id", "criado_em")`,
    );

    await queryRunner.query(`
      CREATE TABLE "revisao_decisoes" (
        "id" SERIAL PRIMARY KEY,
        "regimen_id" character varying(160) NOT NULL,
        "pendencia_tipo" character varying(40),
        "categoria" character varying(20) NOT NULL DEFAULT 'clinica',
        "decisao" character varying(30) NOT NULL,
        "comentario" text,
        "contexto" jsonb,
        "revisor_id" integer,
        "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_revisao_usuario" FOREIGN KEY ("revisor_id")
          REFERENCES "usuarios"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_revisao_regimen" ON "revisao_decisoes" ("regimen_id", "criado_em")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "revisao_decisoes"`);
    await queryRunner.query(`DROP TABLE "selecoes_protocolo"`);
    await queryRunner.query(`DROP TABLE "pacientes"`);
    await queryRunner.query(`DROP TABLE "usuarios"`);
  }
}
