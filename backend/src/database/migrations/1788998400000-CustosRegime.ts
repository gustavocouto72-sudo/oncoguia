import { MigrationInterface, QueryRunner } from 'typeorm';

// CUSTOS POR REGIME — preço duplo (tabela CMED x negociado) para a expectativa de custo.
//
// Chave primária é o próprio regimen_id: um preço por protocolo, sobrescrito no cadastro.
// Sem histórico de versões de preço nesta fase — quando isso for preciso, vira tabela
// append-only com vigência, e esta passa a ser a materialização do preço corrente.
//
// `numeric(12,2)` e não float: dinheiro em ponto flutuante acumula erro na multiplicação
// por ciclos, e um total de carteira errado no centavo é um total errado.
export class CustosRegime1788998400000 implements MigrationInterface {
  name = 'CustosRegime1788998400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custos_regime" (
        "regimen_id" character varying(160) NOT NULL,
        "custo_ciclo_tabela" numeric(12,2) NOT NULL,
        "custo_ciclo_negociado" numeric(12,2) NOT NULL,
        "fonte_tabela" character varying(200) NOT NULL,
        "fonte_negociado" character varying(200) NOT NULL,
        "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "atualizado_por" integer,
        CONSTRAINT "PK_custos_regime" PRIMARY KEY ("regimen_id"),
        CONSTRAINT "FK_custos_regime_usuario" FOREIGN KEY ("atualizado_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL,
        -- Preço negativo é erro de digitação, não desconto.
        CONSTRAINT "CK_custos_regime_nao_negativo"
          CHECK ("custo_ciclo_tabela" >= 0 AND "custo_ciclo_negociado" >= 0)
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "custos_regime"`);
  }
}
