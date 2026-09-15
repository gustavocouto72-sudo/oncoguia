import { MigrationInterface, QueryRunner } from 'typeorm';

// FECHAMENTO DO CICLO do lote 2 (`revisoes.aplicada_em`) — mesmo mecanismo do lote 1
// (1788566400000-AplicadaEm.ts). O lote 2 (run 2026-09-13-intake-revisao-2/v1, publicado em
// 743426b) EXECUTOU as 27 decisões críticas de 12–13/09 mas ninguém carimbou aplicada_em: o
// export de 15/09 saiu com 17 delas em triada_pendente_execucao (e as 10 que mudaram hash em
// aguardando_re_revisao, também sem aplicada_em). A reconciliação do lote 3 (2026-09-15)
// conferiu cada uma no corpus ativo — hash, notas_revisao[lote=2], historico intake-lote2 e a
// prova por ação — antes de listar aqui. NADA é re-executado: só o fato administrativo.
//
// Regra nova no PORTAO-VERIFICACAO: intake só termina quando o backend marca aplicadas.
//
// Onde este arquivo mora: nasceu em squads/.../2026-09-15-intake-revisao-3/v1/backend-pendente/
// porque a frente da secretária estava deployando o backend. Copiar para
// backend/src/database/migrations/ (ajustar o timestamp se outra migration já usou este) e
// rodar com o próximo deploy — pode ir ANTES da publicação do lote 3, porque o lote 2 já está
// no ar.
//
// Parecer do revisor (decisao, justificativa, natureza, revisor, data) NÃO é tocado; a acao já
// foi gravada pelo DTO quando o parecer nasceu — aqui só entra aplicada_em. Idempotente:
// só encosta em linha crítica, com acao igual à esperada, aplicada_em ainda NULL e criada na
// janela do lote (12–13/09/2026).
const INTAKE = '2026-09-13';

// regimen_id → acao registrada no parecer (a que o intake executou)
// Bloco A — as 17 que o export mostra em triada_pendente_execucao (hash inalterado)
const BLOCO_A: Array<[string, string]> = [
  ['bexiga-met-1l-enfortumab-pembrolizumabe', 'manter_anotar'],
  ['bexiga-met-1l-gc-nivolumabe', 'manter_anotar'],
  ['bexiga-mibc-tmt-5fu-mitomicina', 'manter_anotar'],
  ['bexiga-mibc-tmt-cisplatina', 'manter_anotar'],
  ['biliares-1l-5fu', 'outro'],
  ['gastrico-met-her2-pembro-tras-qt', 'ajustar_elegibilidade'], // já satisfeita
  ['hcc-1l-tremelimumabe-durvalumabe', 'manter_anotar'],
  ['penis-met-2l-paclitaxel', 'outro'], // + regime novo penis-met-1l-paclitaxel-carboplatina
  ['prostata-mcrpc-1l-parp-nao-incorporado', 'refutar'],
  ['prostata-mcrpc-2l-cabazitaxel-nao-incorporado', 'ajustar_elegibilidade'], // executada como refutar (balde confirmado 13/09)
  ['prostata-mcrpc-terapia-ossea-zoledronico', 'ajustar_elegibilidade'], // já satisfeita
  ['renal-met-2l-pos-io-cabozantinibe', 'corrigir_referencia'], // triagem resolvida por mensagem: manter METEOR
  ['renal-met-favoravel-ipilimumabe-nivolumabe', 'manter_anotar'],
  ['renal-met-intalto-nivolumabe-cabozantinibe', 'manter_anotar'],
  ['testiculo-avancado-baixorisco-bep3-ep4', 'manter_anotar'],
  ['testiculo-avancado-intalto-bep4-vip4', 'manter_anotar'],
  ['testiculo-recidiva-tip-veip', 'manter_anotar'],
];
// Bloco B — as 10 que a execução mudou de hash (export: aguardando_re_revisao). Também
// executadas e também sem aplicada_em; o lote 1 carimbou as suas equivalentes (mama, 7).
// Riscar este bloco se o humano quiser marcar SÓ as 17.
const BLOCO_B: Array<[string, string]> = [
  ['bexiga-met-1l-io-isolada-cisplatina-inelegivel', 'ajustar_elegibilidade'],
  ['bexiga-met-erdafitinibe-fgfr', 'ajustar_elegibilidade'],
  ['bexiga-mibc-adj-nivolumabe', 'ajustar_elegibilidade'],
  ['bexiga-nmibc-bcg-unresponsive-gem-docetaxel', 'corrigir_referencia'],
  ['gastrico-met-1l-io-qt-cps', 'ajustar_elegibilidade'],
  ['penis-adj-tip', 'ajustar_elegibilidade'],
  ['prostata-mcrpc-1l-abiraterona-prednisona', 'corrigir_referencia'],
  ['renal-adj-pembrolizumab', 'ajustar_elegibilidade'],
  ['testiculo-nsgct-eI-bep1', 'corrigir_referencia'],
  ['testiculo-refrataria-paliativo-gemox', 'corrigir_referencia'],
];
const TODAS = [...BLOCO_A, ...BLOCO_B];

export class AplicadaEmLote21789603200000 implements MigrationInterface {
  name = 'AplicadaEmLote21789603200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [regimenId, acao] of TODAS) {
      await queryRunner.query(
        `UPDATE "revisoes"
            SET "aplicada_em" = $1
          WHERE "regimen_id" = $2
            AND "decisao" IN ('contestado','ajuste_solicitado')
            AND "acao" = $3
            AND "aplicada_em" IS NULL
            AND "criado_em" >= '2026-09-12 00:00:00+00'
            AND "criado_em" <  '2026-09-14 00:00:00+00'`,
        [INTAKE, regimenId, acao],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [regimenId, acao] of TODAS) {
      await queryRunner.query(
        `UPDATE "revisoes"
            SET "aplicada_em" = NULL
          WHERE "regimen_id" = $1
            AND "decisao" IN ('contestado','ajuste_solicitado')
            AND "acao" = $2
            AND "aplicada_em" = $3
            AND "criado_em" >= '2026-09-12 00:00:00+00'
            AND "criado_em" <  '2026-09-14 00:00:00+00'`,
        [regimenId, acao, INTAKE],
      );
    }
  }
}
