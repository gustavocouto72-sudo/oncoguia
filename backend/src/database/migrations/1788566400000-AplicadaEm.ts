import { MigrationInterface, QueryRunner } from 'typeorm';

// FECHAMENTO DO CICLO das decisões que o intake já executou (`revisoes.aplicada_em`).
// Antes desta coluna, o export só sabia dizer "tem acao" ou "não tem acao": as 31 decisões
// críticas de 2026-08-15/16 tinham acao NULL (o campo nasceu depois delas) e saíam eternamente
// com triagem_manual=true — mesmo depois de o run 2026-08-18-intake-revisao ter triado cada
// uma com o revisor e EXECUTADO 29 delas. A fila manual ficava indistinguível do já feito.
//
// Duas coisas acontecem aqui:
//  1) coluna `aplicada_em` (date): quando o intake do squad EXECUTOU aquela ação. NULL = ainda
//     não executada (é a fila de trabalho real).
//  2) backfill das 31 decisões daquele run: grava a acao CONFIRMADA na triagem (balde_confirmado
//     em meta.revisao_humana.triagem_legado do run 2026-08-18-intake-revisao/v1) e carimba
//     aplicada_em = 2026-08-18 nas 29 que o run aplicou. As 2 que ficaram em 'outro' sem execução
//     (ht-isolada, ascent — decisao_revisao='triagem_manual' no consolidado) recebem a acao mas
//     NÃO recebem aplicada_em: são a fila manual de verdade.
//
// Sobre a imutabilidade da tabela (append-only): o parecer do revisor — decisao, justificativa,
// natureza, revisor, data — NÃO é tocado. O que se grava é o roteamento que o humano confirmou
// para AQUELE mesmo parecer e o fato administrativo de o squad tê-lo executado. Nada aqui muda
// opinião clínica, corpus ou RUN_ATIVO.
//
// O backfill é idempotente e conservador: só encosta em linha crítica, com acao ainda NULL e
// anterior ao intake. Uma decisão nova sobre o mesmo regime (que já nasce com acao pelo DTO)
// nunca é alcançada.
const INTAKE = '2026-08-18';

// regimen_id → [acao confirmada na triagem, executada pelo run?]
const TRIAGEM: Array<[string, string, boolean]> = [
  ['mama-adj-her2neg-carbo-paclitaxel', 'ajustar_elegibilidade', true],
  ['mama-neo-her2pos-phesgo-nao-incorporado', 'manter_anotar', true],
  ['mama-neo-tnbc-pembro-keynote522', 'outro', true], // composição corrigida no Step 08
  ['mama-adj-her2neg-act-docetaxel', 'ajustar_elegibilidade', true],
  ['mama-adj-tnbc-capecitabina', 'ajustar_elegibilidade', true],
  ['mama-adj-her2pos-tp-aphinity', 'ajustar_elegibilidade', true],
  ['mama-adj-her2pos-tdm1-katherine', 'ajustar_elegibilidade', true],
  ['mama-adj-ht-tam-ia-switch-pos', 'manter_anotar', true],
  ['mama-adj-rhpos-abemaciclibe-monarche', 'ajustar_elegibilidade', true],
  ['mama-neo-her2pos-ct1c-acth', 'corrigir_referencia', true],
  ['mama-neo-her2pos-ct1c-tch', 'corrigir_referencia', true],
  ['mama-neo-her2pos-gtct1c-acthp', 'manter_anotar', true],
  ['mama-neo-her2pos-gtct1c-tchp', 'manter_anotar', true],
  ['mama-neo-her2pos-gtct1c-thp', 'manter_anotar', true],
  ['mama-neo-tnbc-acdd-ct', 'ajustar_elegibilidade', true],
  ['mama-neo-rhpos-act-acddt', 'manter_anotar', true],
  ['mama-met-hrpos-1l-ia-cdk46', 'manter_anotar', true],
  ['mama-met-hrpos-1l-ia-abemaciclibe', 'manter_anotar', true],
  ['mama-met-hrpos-1l-ht-isolada', 'outro', false], // fila manual: nada executado
  ['mama-met-hrpos-2l-seq-cdk46-nao-incorporado', 'refutar', true],
  ['mama-met-hrpos-2l-capivasertibe-nao-incorporado', 'refutar', true],
  ['mama-met-hrpos-2l-alpelisibe-nao-incorporado', 'refutar', true],
  ['mama-met-hrpos-2l-tdxd-db06-nao-incorporado', 'refutar', true],
  ['mama-met-hrpos-2l-sacituzumab-govitecan', 'ajustar_elegibilidade', true],
  ['mama-met-tnbc-bevacizumabe-nao-incorporado', 'refutar', true],
  ['mama-met-tnbc-1l-atezolizumabe-nao-incorporado', 'refutar', true],
  ['mama-met-her2pos-3l-trastuzumabe-citotoxico', 'ajustar_elegibilidade', true],
  ['mama-met-her2pos-3l-tdm1-th3resa', 'manter_anotar', true],
  ['mama-met-her2pos-2l-tdxd-db03', 'manter_anotar', true],
  ['mama-met-tnbc-3l-tdxd-nao-incorporado', 'manter_anotar', true],
  ['mama-met-tnbc-3l-sacituzumab-ascent', 'outro', false], // fila manual: nada executado
];

export class AplicadaEm1788566400000 implements MigrationInterface {
  name = 'AplicadaEm1788566400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "revisoes" ADD COLUMN IF NOT EXISTS "aplicada_em" date`);
    // aplicada_em só existe onde existe ação: sem roteamento confirmado nada pôde ser executado.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "revisoes" ADD CONSTRAINT "CHK_revisoes_aplicada_em"
          CHECK ("aplicada_em" IS NULL OR "acao" IS NOT NULL);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    for (const [regimenId, acao, executada] of TRIAGEM) {
      await queryRunner.query(
        `UPDATE "revisoes"
            SET "acao" = $1, "aplicada_em" = $2
          WHERE "regimen_id" = $3
            AND "decisao" IN ('contestado','ajuste_solicitado')
            AND "acao" IS NULL
            AND "criado_em" < $4`,
        [acao, executada ? INTAKE : null, regimenId, `${INTAKE} 00:00:00+00`],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Desfaz apenas o que o up gravou: as ações do backfill voltam a NULL (legado sem ação).
    for (const [regimenId, acao] of TRIAGEM) {
      await queryRunner.query(
        `UPDATE "revisoes"
            SET "acao" = NULL, "aplicada_em" = NULL
          WHERE "regimen_id" = $1
            AND "decisao" IN ('contestado','ajuste_solicitado')
            AND "acao" = $2
            AND "criado_em" < $3`,
        [regimenId, acao, `${INTAKE} 00:00:00+00`],
      );
    }
    await queryRunner.query(`ALTER TABLE "revisoes" DROP CONSTRAINT IF EXISTS "CHK_revisoes_aplicada_em"`);
    await queryRunner.query(`ALTER TABLE "revisoes" DROP COLUMN IF EXISTS "aplicada_em"`);
  }
}
