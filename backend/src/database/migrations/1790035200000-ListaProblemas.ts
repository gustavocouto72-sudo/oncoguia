import { MigrationInterface, QueryRunner } from 'typeorm';

// LISTA DE PROBLEMAS — comorbidades, medicações em uso e alergias do paciente, visíveis de
// relance na ficha. Até aqui esses fatos só existiam dentro da nota de importação (a
// "nota-parede" em detalhe_semaforo.ressalva / observacoes do retorno), onde o oncologista
// assistencial não os acha na hora da consulta.
//
// Três colunas jsonb em `pacientes`, cada uma uma LISTA de itens
//   {texto, origem, registrado_por:{id,nome}, em}
// — `origem` diz de onde o item veio ("registro manual" na ficha, ou "importação (evolução
// de dd/mm/aaaa)" quando a validação de uma proposta o gravou). Default [] e NOT NULL: a
// ficha nunca precisa distinguir "sem lista" de "lista vazia".
//
// É ESTADO MUTÁVEL (item entra e sai), então o rastro fica na trilha: cada mudança grava um
// evento administrativo append-only de tipo novo, 'lista_problemas' — o CHECK da tabela
// ganha o valor. O evento carrega, na nota, o que entrou (+item) e o que saiu (−item).
export class ListaProblemas1790035200000 implements MigrationInterface {
  name = 'ListaProblemas1790035200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const col of ['comorbidades', 'medicacoes_uso', 'alergias']) {
      await queryRunner.query(`ALTER TABLE "pacientes" ADD COLUMN IF NOT EXISTS "${col}" jsonb NOT NULL DEFAULT '[]'::jsonb`);
    }
    await queryRunner.query(`ALTER TABLE "eventos_administrativos" DROP CONSTRAINT IF EXISTS "CHK_eventos_administrativos_tipo"`);
    await queryRunner.query(`
      ALTER TABLE "eventos_administrativos" ADD CONSTRAINT "CHK_eventos_administrativos_tipo"
        CHECK ("tipo" IN ('reagendamento','contato','lista_problemas'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volta ao CHECK de dois valores — falha se já houver evento 'lista_problemas', e é
    // para falhar: apagar rastro de trilha não é o que um down deve fazer em silêncio.
    await queryRunner.query(`ALTER TABLE "eventos_administrativos" DROP CONSTRAINT IF EXISTS "CHK_eventos_administrativos_tipo"`);
    await queryRunner.query(`
      ALTER TABLE "eventos_administrativos" ADD CONSTRAINT "CHK_eventos_administrativos_tipo"
        CHECK ("tipo" IN ('reagendamento','contato'))`);
    for (const col of ['comorbidades', 'medicacoes_uso', 'alergias']) {
      await queryRunner.query(`ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
