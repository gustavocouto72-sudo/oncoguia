import { MigrationInterface, QueryRunner } from 'typeorm';

// FECHAMENTO DO CICLO do lote 3 (run 2026-09-15-intake-revisao-3/v1). SÓ RODAR JUNTO COM A
// PUBLICAÇÃO desse run (RUN_ATIVO → 2026-09-15-intake-revisao-3/v1 + build-data + restart):
// aplicada_em atesta que a execução está NO AR, não que está num run em disco.
//
// O que o lote 3 executou (relatorio-intake-lote3.json):
//   • 7 manter_anotar de 14/09 — nota visível no card, hash intacto;
//   • as 2 pendências de 16/08 (acao=outro): ht-isolada → 4 regimes novos; ascent → eixo
//     elegibilidade re-derivado (hash mudou: o parecer expira pela própria execução — mesmo
//     caso das 7 de mama no lote 1, que receberam aplicada_em).
// O que NÃO executou (fica sem aplicada_em, é a fila manual de verdade):
//   • endometrio-met-dostarlimabe-mss-nao-incluido (refutar, 14/09) — contradição interna;
//     triagem_manual com pergunta ao revisor.
const INTAKE = '2026-09-15';

// data = dia UTC do criado_em (é assim que o export calcula `data`: toISOString) — por isso a
// janela abaixo é explícita em UTC e não usa ::date (dependeria do timezone do servidor).
const LOTE3: Array<[string, string, string]> = [ // [regimen_id, acao, data do parecer (UTC)]
  ['pancreas-adj-gem-cape-nao-incorporado', 'manter_anotar', '2026-09-14'],
  ['crc-met-bevacizumabe-1l-nao-incorporado', 'manter_anotar', '2026-09-14'],
  ['crc-met-regorafenibe-nao-incorporado', 'manter_anotar', '2026-09-14'],
  ['net-altograu-platina-etoposideo', 'manter_anotar', '2026-09-14'],
  ['nsclc-adj-io-estagioI-nao-incluido', 'manter_anotar', '2026-09-14'],
  ['sclc-retratamento-mesmo-esquema', 'manter_anotar', '2026-09-14'],
  ['sclc-2l-tarlatamabe-nao-incluido', 'manter_anotar', '2026-09-14'],
  ['mama-met-hrpos-1l-ht-isolada', 'outro', '2026-08-16'],
  ['mama-met-tnbc-3l-sacituzumab-ascent', 'outro', '2026-08-16'],
];

export class AplicadaEmLote31789689600000 implements MigrationInterface {
  name = 'AplicadaEmLote31789689600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [regimenId, acao, data] of LOTE3) {
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
    for (const [regimenId, acao, data] of LOTE3) {
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
