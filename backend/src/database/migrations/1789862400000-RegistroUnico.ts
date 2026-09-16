import { MigrationInterface, QueryRunner } from 'typeorm';

// REGISTRO ÚNICO — `pacientes.identificador` (nº de atendimento/registro do hospital) não
// pode se repetir. Motivo: testando a mesma evolução mais de uma vez, o mesmo paciente foi
// cadastrado duas vezes (produção, 2026-09-16: #80 e #82 com o registro 2525705) — e cada
// cópia vira um "branch" do mesmo doente, com trilha, agenda e protocolo próprios.
//
// Índice ÚNICO PARCIAL, no padrão da UQ das propostas: só quem TEM registro entra na
// unicidade; nulo e vazio continuam livres (paciente sem registro pode existir n vezes —
// os de seed, os de teste). A trava que vale é a do banco; o serviço devolve 409 legível
// antes de chegar nela ("Registro X já cadastrado: NOME (#id)").
//
// PRÉ-FLIGHT embutido (padrão PerfilSecretaria): se já houver duplicata, a migration
// ABORTA com a lista — e com ela o boot — em vez de o CREATE UNIQUE INDEX falhar com um
// erro genérico do Postgres no meio da subida. Em produção a duplicata #82 tem de ser
// removida ANTES do deploy (aprovada pelo oncologista); em dev não havia nenhuma.
export class RegistroUnico1789862400000 implements MigrationInterface {
  name = 'RegistroUnico1789862400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dup: { identificador: string; n: string; ids: number[] }[] = await queryRunner.query(`
      SELECT "identificador", count(*) AS n, array_agg("id" ORDER BY "id") AS ids
        FROM "pacientes"
       WHERE "identificador" IS NOT NULL AND "identificador" <> ''
       GROUP BY "identificador" HAVING count(*) > 1`);
    if (dup.length) {
      throw new Error(
        `RegistroUnico: ${dup.length} registro(s) duplicado(s) em pacientes — remova as cópias antes de migrar: `
        + dup.map((d) => `${d.identificador} → ids ${d.ids.join(', ')}`).join('; '),
      );
    }
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_pacientes_identificador"
        ON "pacientes" ("identificador")
        WHERE "identificador" IS NOT NULL AND "identificador" <> ''`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_pacientes_identificador"`);
  }
}
