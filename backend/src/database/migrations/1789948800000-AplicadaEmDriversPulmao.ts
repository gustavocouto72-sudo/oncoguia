import { MigrationInterface, QueryRunner } from 'typeorm';

// FECHAMENTO DO CICLO do ajuste dos drivers de pulmão (run 2026-09-16-drivers-pulmao/v1). SÓ
// RODAR DEPOIS DA PUBLICAÇÃO CONFERIDA desse run (RUN_ATIVO + build-data + deploy do backend e do
// app + Portão A + portao-drivers-pulmao em produção): aplicada_em atesta que a execução está NO
// AR, não que está num run em disco.
//
// O que o intake executou (relatorio-intake-drivers-pulmao.json): os 6 pareceres
// ajuste_solicitado/ajustar_elegibilidade de 16/09/2026 (decisão do revisor via WhatsApp,
// transmitida; Fase B aprovada) — regras reescritas por marcador (egfr/alk/ros1_status +
// histologia), KEYNOTE-407 separado do 189. Os hashes mudaram: os pareceres expiram pela própria
// execução (mesmo caso do ASCENT no lote 3), e as aprovações de 14/09 voltam a re-revisão.
const INTAKE = '2026-09-16';

// data = dia UTC do criado_em (como o export calcula `data`): janela explícita em UTC.
const DRIVERS: Array<[string, string, string]> = [ // [regimen_id, acao, data do parecer (UTC)]
  ['nsclc-neoadj-nivolumabe-qt', 'ajustar_elegibilidade', '2026-09-16'],
  ['nsclc-periop-pembrolizumabe-qt', 'ajustar_elegibilidade', '2026-09-16'],
  ['nsclc-def-crt-durvalumab', 'ajustar_elegibilidade', '2026-09-16'],
  ['nsclc-adj-atezolizumabe-pdl1', 'ajustar_elegibilidade', '2026-09-16'],
  ['nsclc-met-io-mono-pdl1alto', 'ajustar_elegibilidade', '2026-09-16'],
  ['nsclc-met-io-qt-pdl1baixo', 'ajustar_elegibilidade', '2026-09-16'],
];

export class AplicadaEmDriversPulmao1789948800000 implements MigrationInterface {
  name = 'AplicadaEmDriversPulmao1789948800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [regimenId, acao, data] of DRIVERS) {
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
    for (const [regimenId, acao, data] of DRIVERS) {
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
