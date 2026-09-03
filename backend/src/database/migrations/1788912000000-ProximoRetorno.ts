import { MigrationInterface, QueryRunner } from 'typeorm';

// PRÓXIMO RETORNO — agenda do seguimento, e a base do "quem não veio".
//
// Modelagem, na mesma linha do reestadiamento: o que ACONTECEU é append-only e imutável
// (`retornos`); o que está MARCADO PARA A FRENTE é estado mutável e descartável, e mora
// no paciente. Por isso duas colunas com o mesmo nome em tabelas diferentes, e não é
// duplicação:
//
//   • `pacientes.proximo_retorno` — a AGENDA. Uma data só, sobrescrita a cada retorno.
//     Responde "quando é o próximo?" e, se já passou, "este paciente não veio".
//   • `retornos.proximo_retorno` + `retornos.proximo_intervalo` — a DECISÃO tomada
//     naquela consulta, congelada junto com o resto do registro. É o que permite dizer
//     "para quando ele foi remarcado em março" mesmo depois de a agenda ter mudado três
//     vezes, e é de onde sai a sugestão de intervalo do próximo retorno (o "último
//     ciclo"). Sem ela, a única forma de saber o intervalo seria subtrair datas e torcer.
//
// `retornos.data_agendada` já existia e passa a ter dono: é preenchida pelo SERVIDOR com
// a agenda vigente no momento do registro ("para quando este retorno estava previsto").
// Deixou de ser campo digitável — cliente não deve poder declarar um agendamento que a
// agenda não tinha.
export class ProximoRetorno1788912000000 implements MigrationInterface {
  name = 'ProximoRetorno1788912000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pacientes" ADD COLUMN IF NOT EXISTS "proximo_retorno" date`);
    await queryRunner.query(`ALTER TABLE "retornos" ADD COLUMN IF NOT EXISTS "proximo_retorno" date`);
    await queryRunner.query(`ALTER TABLE "retornos" ADD COLUMN IF NOT EXISTS "proximo_intervalo" character varying(16)`);
    // A lista de pacientes filtra por "retorno atrasado" — é varredura por data, não por id.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pacientes_proximo_retorno" ON "pacientes" ("proximo_retorno")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pacientes_proximo_retorno"`);
    await queryRunner.query(`ALTER TABLE "retornos" DROP COLUMN IF EXISTS "proximo_intervalo"`);
    await queryRunner.query(`ALTER TABLE "retornos" DROP COLUMN IF EXISTS "proximo_retorno"`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "proximo_retorno"`);
  }
}
