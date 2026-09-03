import { MigrationInterface, QueryRunner } from 'typeorm';

// PERÍODO COBERTO PELO PREÇO — destrava o custo dos orais contínuos.
//
// O problema que ela resolve: a conversão de tempo em ciclos precisa de um intervalo, e
// o servidor só aceita o intervalo que o ESQUEMA afirma. Oral diário contínuo não tem
// intervalo nenhum no texto ("Osimertinibe 80 mg VO 1x/dia até progressão/toxicidade"),
// então esses regimes ficavam sem custo mesmo com preço cadastrado — e são justamente os
// caros. Agora quem cadastra o preço declara o período que ele cobre.
//
// Migration SEPARADA da CustosRegime de propósito: aquela já está commitada e pode já ter
// rodado em produção. Migration que roda não se edita — se editasse, o ambiente que já
// aplicou não veria a mudança e os dois bancos divergiriam em silêncio.
//
// Nullable sem default: ausência aqui significa "preço por ciclo, intervalo vem do
// esquema". Um default de 30 dias seria o chute que o módulo inteiro existe para recusar.
export class CustoPeriodoDias1789084800000 implements MigrationInterface {
  name = 'CustoPeriodoDias1789084800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "custos_regime" ADD COLUMN IF NOT EXISTS "periodo_dias" integer`);
    // 1 a 365: menos de um dia não é período e mais de um ano não é preço de ciclo.
    // Erro de digitação aqui multiplica o custo total do paciente.
    await queryRunner.query(`
      ALTER TABLE "custos_regime" DROP CONSTRAINT IF EXISTS "CK_custos_regime_periodo"`);
    await queryRunner.query(`
      ALTER TABLE "custos_regime" ADD CONSTRAINT "CK_custos_regime_periodo"
        CHECK ("periodo_dias" IS NULL OR ("periodo_dias" >= 1 AND "periodo_dias" <= 365))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "custos_regime" DROP CONSTRAINT IF EXISTS "CK_custos_regime_periodo"`);
    await queryRunner.query(`ALTER TABLE "custos_regime" DROP COLUMN IF EXISTS "periodo_dias"`);
  }
}
