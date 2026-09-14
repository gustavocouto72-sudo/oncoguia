import { MigrationInterface, QueryRunner } from 'typeorm';

// PERFIL SECRETARIA — cadastro administrativo, sem dado clínico.
//
// Duas coisas, no mesmo passo:
//
// 1. Os DOIS CHECKs de vocabulário passam a aceitar 'secretaria' (6 perfis):
//    `CHK_usuarios_perfil` (a coluna do perfil ativo padrão — nasceu em SolicitacaoExcecao,
//    refeito em Recursos para o gestor) e `CHK_usuarios_perfis` (a lista, PerfisMultiplos).
//    São dois constraints com nomes quase iguais, e o primeiro portão desta feature caiu
//    exatamente nisso: o CHECK da lista aceitava, o do perfil não, e o cadastro voltava 500
//    ("violates check constraint CHK_usuarios_perfil"). O pré-flight abaixo confere a coluna
//    e a lista; o mesmo pré-flight roda à mão antes do deploy e lista os DOIS constraints.
//    Semântica inalterada: o token carrega UM perfil ativo, conferido contra a lista.
//
//    PRÉ-FLIGHT antes de trocar o constraint: se alguma linha de `usuarios` tiver um perfil
//    FORA do vocabulário novo, a migration aborta com a lista — em vez de o ADD CONSTRAINT
//    falhar com um erro genérico do Postgres no meio do boot. O vocabulário novo é
//    superconjunto do antigo, então no banco íntegro isto nunca dispara; existe para o
//    caso de alguém ter escrito por SQL direto. (O mesmo pré-flight roda à mão antes do
//    deploy — ver PORTAO-VERIFICACAO.md.)
//
// 2. `eventos_administrativos`: a tabela APPEND-ONLY do que a secretaria registra —
//    reagendamento da data do próximo retorno (de onde → para onde, motivo) e contato
//    com paciente faltoso (data, meio, nota curta). Sem UPDATE/DELETE por rota; correção
//    é linha nova, como avaliações e retornos. Cascata no paciente (some com ele, como os
//    retornos), SET NULL no autor (registro sobrevive à conta).
//
//    A coluna que a secretaria MEXE é `pacientes.proximo_retorno` — a agenda mutável que
//    já existia (ProximoRetorno1788912000000). A coluna que ela NUNCA toca é
//    `retornos.proximo_retorno`/`proximo_intervalo`: a decisão clínica congelada no
//    registro do médico. Nada nesta migration altera `retornos`.
export class PerfilSecretaria1789430400000 implements MigrationInterface {
  name = 'PerfilSecretaria1789430400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- pré-flight: nenhum perfil fora do vocabulário novo ----------------------
    const fora: { id: number; login: string; perfil: string; perfis: string[] }[] = await queryRunner.query(`
      SELECT "id", "login", "perfil", "perfis" FROM "usuarios"
       WHERE NOT ("perfis" <@ ARRAY['oncologista','revisor','auditor','admin','gestor','secretaria']::varchar(20)[])
          OR "perfil" NOT IN ('oncologista','revisor','auditor','admin','gestor','secretaria')`);
    if (fora.length) {
      throw new Error(
        `PerfilSecretaria: ${fora.length} usuário(s) com perfil fora do vocabulário — corrija antes de migrar: `
        + fora.map((u) => `#${u.id} ${u.login} perfil=${u.perfil} perfis=${JSON.stringify(u.perfis)}`).join('; '),
      );
    }

    // ---- CHECKs com os 6 perfis ---------------------------------------------------
    // A migration antiga não se edita (já rodou): drop-and-add com o mesmo nome, aqui.
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfil"`);
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD CONSTRAINT "CHK_usuarios_perfil"
        CHECK ("perfil" IN ('oncologista','revisor','auditor','admin','gestor','secretaria'))`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfis"`);
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD CONSTRAINT "CHK_usuarios_perfis" CHECK (
        array_length("perfis", 1) >= 1
        AND "perfis" <@ ARRAY['oncologista','revisor','auditor','admin','gestor','secretaria']::varchar(20)[]
        AND "perfil" = ANY("perfis")
      )`);

    // ---- eventos administrativos (append-only) -----------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "eventos_administrativos" (
        "id" SERIAL NOT NULL,
        "paciente_id" integer NOT NULL,
        "tipo" varchar(20) NOT NULL,
        "data" date NOT NULL,
        "data_anterior" date,
        "meio" varchar(20),
        "nota" varchar(280),
        "registrado_por" integer,
        "perfil_ativo" varchar(20),
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_eventos_administrativos" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_eventos_administrativos_tipo" CHECK ("tipo" IN ('reagendamento','contato')),
        CONSTRAINT "CHK_eventos_administrativos_meio" CHECK ("meio" IS NULL OR "meio" IN ('telefone','whatsapp','email','presencial','outro')),
        CONSTRAINT "FK_eventos_administrativos_paciente" FOREIGN KEY ("paciente_id")
          REFERENCES "pacientes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_eventos_administrativos_autor" FOREIGN KEY ("registrado_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_eventos_administrativos_paciente_criado"
        ON "eventos_administrativos" ("paciente_id", "criado_em")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "eventos_administrativos"`);
    // Volta ao vocabulário de 5. Falha se alguém já tiver 'secretaria' — e é para falhar:
    // rebaixar o CHECK com uma secretária cadastrada deixaria o banco inconsistente.
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfis"`);
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD CONSTRAINT "CHK_usuarios_perfis" CHECK (
        array_length("perfis", 1) >= 1
        AND "perfis" <@ ARRAY['oncologista','revisor','auditor','admin','gestor']::varchar(20)[]
        AND "perfil" = ANY("perfis")
      )`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfil"`);
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD CONSTRAINT "CHK_usuarios_perfil"
        CHECK ("perfil" IN ('oncologista','revisor','auditor','admin','gestor'))`);
  }
}
