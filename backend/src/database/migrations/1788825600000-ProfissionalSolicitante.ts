import { MigrationInterface, QueryRunner } from 'typeorm';

// DADOS DE CONSELHO DO PROFISSIONAL (bloco "Profissional Solicitante" da guia TISS
// SP/SADT). São campos de IDENTIFICAÇÃO ADMINISTRATIVA do usuário, não dado clínico:
// entram no cadastro para que a guia saia preenchida no lugar de o médico reescrever
// CRM/UF/CBO em toda solicitação. Todos OPCIONAIS — quem não preencher imprime a guia
// com esses campos em branco, que é o comportamento correto de um formulário.
export class ProfissionalSolicitante1788825600000 implements MigrationInterface {
  name = 'ProfissionalSolicitante1788825600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "conselho" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "numero_conselho" character varying(30)`);
    await queryRunner.query(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "uf_conselho" character varying(2)`);
    await queryRunner.query(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "cbos" character varying(10)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "cbos"`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "uf_conselho"`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "numero_conselho"`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "conselho"`);
  }
}
