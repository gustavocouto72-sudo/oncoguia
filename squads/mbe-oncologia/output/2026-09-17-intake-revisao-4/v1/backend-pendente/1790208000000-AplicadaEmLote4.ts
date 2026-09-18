import { MigrationInterface, QueryRunner } from 'typeorm';

// FECHAMENTO DO CICLO do lote 4 (run 2026-09-17-intake-revisao-4/v1). SÓ RODAR DEPOIS DA
// PUBLICAÇÃO CONFERIDA desse run (RUN_ATIVO + build-data + deploy + Portão A/B): aplicada_em
// atesta que a execução está NO AR, não que está num run em disco. Regra 4 do Portão A.
//
// O que o intake executou (relatorio-intake-lote4.json): os 9 pareceres de 16/09/2026 —
// 4 manter_anotar (nota no card, hash intacto), 1 ajustar_elegibilidade (KEYNOTE-A18),
// 2 corrigir_referencia (PATTERN; BCIRG-006), 1 corrigir_referencia executado como complementar
// (abstract ASCO 2026, política D2/D3) e 1 refutar executado como "manter fora + atualizar card"
// (toripalimabe, decisão humana D1 caminho A). Os 4 cujo hash mudou expiram pela própria
// execução (mecânica ASCENT/drivers). A pendência do dostarlimabe MSS (14/09) fica NULL.
// Os 3 regimes salivar (D7) não têm parecer na Mesa — nada a marcar.
const INTAKE = '2026-09-18';

// data = dia UTC do criado_em (como o export calcula `data`): janela explícita em UTC.
const LOTE4: Array<[string, string, string]> = [ // [regimen_id, acao, data do parecer (UTC)]
  ['ovario-recidiva-platina-resistente-monoterapia', 'manter_anotar', '2026-09-16'],
  ['sarcoma-ntrk-larotrectinibe-nao-incorporado', 'manter_anotar', '2026-09-16'],
  ['mama-adj-her2neg-act-docetaxel', 'manter_anotar', '2026-09-16'],
  ['cp-cec-def-cetuximabe-rt', 'manter_anotar', '2026-09-16'],
  ['colo-qrt-io-keynote-a18', 'ajustar_elegibilidade', '2026-09-16'],
  ['mama-adj-her2neg-carbo-paclitaxel', 'corrigir_referencia', '2026-09-16'],
  ['mama-neo-her2pos-ct1c-tch', 'corrigir_referencia', '2026-09-16'],
  ['ovario-resistente-bevacizumabe-nao-incluido', 'corrigir_referencia', '2026-09-16'],
  ['cp-naso-toripalimabe-nao-incluido', 'refutar', '2026-09-16'],
];

export class AplicadaEmLote41790208000000 implements MigrationInterface {
  name = 'AplicadaEmLote41790208000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [regimenId, acao, data] of LOTE4) {
      await queryRunner.query(
        `UPDATE "revisoes"
            SET "aplicada_em" = $1
          WHERE "regimen_id" = $2
            AND "decisao" IN ('contestado','ajuste_solicitado')
            AND "acao" = $3
            AND "aplicada_em" IS NULL
            AND "criado_em" >= ($4::date::timestamp) AT TIME ZONE 'UTC'
            AND "criado_em" <  (($4::date + 1)::timestamp) AT TIME ZONE 'UTC'`,
        [INTAKE, regimenId, acao, data],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [regimenId, acao, data] of LOTE4) {
      await queryRunner.query(
        `UPDATE "revisoes"
            SET "aplicada_em" = NULL
          WHERE "regimen_id" = $1
            AND "decisao" IN ('contestado','ajuste_solicitado')
            AND "acao" = $2
            AND "aplicada_em" = $3
            AND "criado_em" >= ($4::date::timestamp) AT TIME ZONE 'UTC'
            AND "criado_em" <  (($4::date + 1)::timestamp) AT TIME ZONE 'UTC'`,
        [regimenId, acao, INTAKE, data],
      );
    }
  }
}
