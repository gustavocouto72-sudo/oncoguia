import { MigrationInterface, QueryRunner } from 'typeorm';

// PERFIS MÚLTIPLOS — uma pessoa, vários chapéus, UM POR VEZ.
//
// O que muda: `usuarios.perfil` deixa de ser "o perfil da pessoa" e passa a ser o perfil
// ATIVO PADRÃO (o que o login entrega). Ao lado dele nasce `usuarios.perfis`, a LISTA do
// que aquela pessoa pode vestir. Trocar de chapéu = pedir um token novo com outro item
// DA LISTA (POST /auth/trocar-perfil).
//
// A decisão de desenho que sustenta tudo: **o token continua carregando UM perfil**.
// Guards, whitelists e a matriz do portão não mudam de lógica — continuam perguntando
// "qual é o perfil ativo?", exatamente como hoje. A alternativa (token com a lista, guard
// perguntando "tem algum que sirva?") transformaria cada guard num teste de interseção e
// faria o oncologista/auditor decidir a própria solicitação sem nunca trocar de chapéu —
// que é justamente o que a regra de conflito existe para impedir.
//
// CHECK em três partes, todas no mesmo constraint de propósito:
//   • lista não vazia          — conta sem nenhum acesso é conta quebrada, não estado;
//   • lista dentro do vocabulário dos 5 perfis;
//   • `perfil` (o ativo padrão) É MEMBRO de `perfis` — a coerência dos dois campos é
//     invariante do banco, não disciplina do service. Sem isso um UPDATE que troca a
//     lista e esquece o default deixa a pessoa com um chapéu que ela não tem mais.
//
// Unicidade dos itens não vai para o CHECK (SQL feio, ganho nenhum): quem deduplica é o
// UsuariosService, e lista com item repetido não muda permissão nenhuma.
//
// ---- perfil_ativo nos registros -------------------------------------------------------
// A partir daqui "quem escreveu" não determina mais "com que chapéu escreveu". As quatro
// ações gravadas passam a carimbar o perfil ATIVO no momento: avaliação, decisão de
// autorização, revisão e retorno. Backfill = o perfil único que o autor tinha (verdade
// histórica: antes desta migration ninguém tinha mais de um).
//
// Nullable porque o AUTOR é nullable (ON DELETE SET NULL): registro cujo autor sumiu
// perde o nome e perde o chapéu junto — inventar 'oncologista' ali seria pior que null.
export class PerfisMultiplos1789257600000 implements MigrationInterface {
  name = 'PerfisMultiplos1789257600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- usuarios.perfis ---------------------------------------------------------
    await queryRunner.query(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "perfis" varchar(20)[]`);
    // Backfill: todo mundo começa com exatamente o chapéu que já usava.
    await queryRunner.query(`UPDATE "usuarios" SET "perfis" = ARRAY["perfil"]::varchar(20)[] WHERE "perfis" IS NULL`);
    await queryRunner.query(`ALTER TABLE "usuarios" ALTER COLUMN "perfis" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfis"`);
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD CONSTRAINT "CHK_usuarios_perfis" CHECK (
        array_length("perfis", 1) >= 1
        AND "perfis" <@ ARRAY['oncologista','revisor','auditor','admin','gestor']::varchar(20)[]
        AND "perfil" = ANY("perfis")
      )`);

    // ---- perfil ativo carimbado em cada ação gravada -----------------------------
    await queryRunner.query(`ALTER TABLE "avaliacoes" ADD COLUMN IF NOT EXISTS "perfil_ativo" varchar(20)`);
    await queryRunner.query(`
      UPDATE "avaliacoes" a SET "perfil_ativo" = u."perfil"
        FROM "usuarios" u WHERE u."id" = a."avaliado_por" AND a."perfil_ativo" IS NULL`);

    // A DECISÃO do auditor mora na mesma linha da avaliação (não tem tabela própria),
    // então ganha coluna própria: quem pediu e quem decidiu são pessoas diferentes, com
    // chapéus diferentes, no mesmo registro.
    await queryRunner.query(`ALTER TABLE "avaliacoes" ADD COLUMN IF NOT EXISTS "autorizacao_perfil_ativo" varchar(20)`);
    await queryRunner.query(`
      UPDATE "avaliacoes" a SET "autorizacao_perfil_ativo" = u."perfil"
        FROM "usuarios" u WHERE u."id" = a."autorizacao_auditor_id" AND a."autorizacao_perfil_ativo" IS NULL`);

    await queryRunner.query(`ALTER TABLE "revisoes" ADD COLUMN IF NOT EXISTS "perfil_ativo" varchar(20)`);
    await queryRunner.query(`
      UPDATE "revisoes" r SET "perfil_ativo" = u."perfil"
        FROM "usuarios" u WHERE u."id" = r."revisor_id" AND r."perfil_ativo" IS NULL`);

    await queryRunner.query(`ALTER TABLE "retornos" ADD COLUMN IF NOT EXISTS "perfil_ativo" varchar(20)`);
    await queryRunner.query(`
      UPDATE "retornos" t SET "perfil_ativo" = u."perfil"
        FROM "usuarios" u WHERE u."id" = t."registrado_por" AND t."perfil_ativo" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "retornos" DROP COLUMN IF EXISTS "perfil_ativo"`);
    await queryRunner.query(`ALTER TABLE "revisoes" DROP COLUMN IF EXISTS "perfil_ativo"`);
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP COLUMN IF EXISTS "autorizacao_perfil_ativo"`);
    await queryRunner.query(`ALTER TABLE "avaliacoes" DROP COLUMN IF EXISTS "perfil_ativo"`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfis"`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "perfis"`);
  }
}
