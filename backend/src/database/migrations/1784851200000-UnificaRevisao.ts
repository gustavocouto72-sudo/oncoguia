import { MigrationInterface, QueryRunner } from 'typeorm';

// Unifica a persistência de parecer numa tabela só: `revisoes` (Revisão clínica).
// A Mesa de Revisão antiga (tabela `revisao_decisoes`, POST /revisao/decisoes) foi
// aposentada — a partir daqui existe UM caminho de escrita de parecer.
//
// 1) `revisoes.natureza` — marcador da contestação/ajuste:
//      'dado'    = fonte/DOI/critério não computável errado → o squad deve REFAZER o regime
//      'clinico' = discordância de nota/magnitude → fica como registro clínico (não reprocessa)
//    Obrigatório só para contestado/ajuste_solicitado (validado no DTO; aqui fica nullable).
// 2) Cópia defensiva: se `revisao_decisoes` ainda tiver pareceres (na prática está vazia —
//    verificado em 2026-07-24), eles são preservados em `revisoes` com decisão mapeada para o
//    vocabulário novo e a decisão original registrada na justificativa. content_hash sintético
//    `legado:<run_id>` — nunca casa com um hash atual, então esses pareceres aparecem como
//    pendente_re_revisao (correto: são de um run anterior).
// 3) DROP da tabela antiga.
export class UnificaRevisao1784851200000 implements MigrationInterface {
  name = 'UnificaRevisao1784851200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "revisoes" ADD COLUMN IF NOT EXISTS "natureza" character varying(20)`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "revisoes" ADD CONSTRAINT "CHK_revisoes_natureza"
          CHECK ("natureza" IS NULL OR "natureza" IN ('dado','clinico'));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    const temAntiga: Array<{ existe: boolean }> = await queryRunner.query(
      `SELECT to_regclass('revisao_decisoes') IS NOT NULL AS existe`,
    );
    if (temAntiga[0] && temAntiga[0].existe) {
      const migradas: Array<{ id: number }> = await queryRunner.query(`
        INSERT INTO "revisoes" ("regimen_id", "content_hash", "revisor_id", "decisao", "natureza", "justificativa", "eixo", "criado_em")
        SELECT
          d."regimen_id",
          LEFT(COALESCE(d."contexto"->>'content_hash', 'legado:' || COALESCE(d."contexto"->>'run_id', 'mesa-revisao')), 64),
          d."revisor_id",
          CASE WHEN d."decisao" IN ('contestacao', 'manter', 'escalar', 'adiar') THEN 'contestado' ELSE 'ajuste_solicitado' END,
          CASE WHEN d."decisao" IN ('contestacao', 'aceitar', 'reprocessar', 'estruturar') THEN 'dado' ELSE 'clinico' END,
          '[migrado da Mesa de Revisão — decisão original: ' || d."decisao" ||
            COALESCE(', pendência ' || (d."contexto"->>'pendencia_id'), '') || '] ' || COALESCE(d."comentario", ''),
          CASE COALESCE(d."contexto"->>'eixo', '')
            WHEN 'grade' THEN 'grade' WHEN 'esmo_mcbs' THEN 'esmo'
            WHEN 'nccn_affordability' THEN 'custo' WHEN 'elegibilidade' THEN 'elegibilidade'
            WHEN '' THEN NULL ELSE 'geral' END,
          d."criado_em"
        FROM "revisao_decisoes" d
        RETURNING "id"
      `);
      if (migradas.length) {
        console.log(`[UnificaRevisao] ${migradas.length} parecer(es) da Mesa antiga migrados para "revisoes".`);
      }
      await queryRunner.query(`DROP TABLE "revisao_decisoes"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A tabela antiga não é recriada (a Mesa foi aposentada); só desfaz a coluna nova.
    await queryRunner.query(`ALTER TABLE "revisoes" DROP CONSTRAINT IF EXISTS "CHK_revisoes_natureza"`);
    await queryRunner.query(`ALTER TABLE "revisoes" DROP COLUMN IF EXISTS "natureza"`);
  }
}
