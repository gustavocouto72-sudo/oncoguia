import { MigrationInterface, QueryRunner } from 'typeorm';

// CABEÇALHO ONCOLÓGICO — a parte clínica da lista de problemas: título em caixa, subtítulo
// (marcadores que definiram o tratamento, data do dx), linhas tipadas com data parcial
// (apresentação · propedêutica · terapêutica, intercorrências como filhas da terapêutica),
// marcadores tumorais em série e status atual. A estrutura é a do guia de cabeçalho
// oncológico do revisor — o que ele escreve à mão no "Evoluções Anteriores" do TASY.
//
// Uma coluna jsonb em `pacientes`, NOT NULL DEFAULT '{}': a ficha nunca distingue "sem
// cabeçalho" de "cabeçalho vazio", e campo sem informação simplesmente não existe no
// objeto (omitir é preferível a inferir).
//
// O CHECK é LITERAL, no banco: nenhuma linha pode ter `tipo` fora do vocabulário — nem por
// um caminho de escrita que esqueça a validação do serviço. jsonb_path_exists procura uma
// linha ofensora: sem `tipo`, `tipo` que não é string, ou string fora dos três valores. Se
// achar uma, a constraint falha. `linhas` ausente = nada a procurar = passa.
//
// E o evento administrativo ganha um tipo novo, 'cabecalho_oncologico' (20 chars, cabe no
// varchar(20)): cada PATCH do cabeçalho deixa uma linha append-only na trilha com os +/−.
const CHECK_TIPO = `NOT jsonb_path_exists("cabecalho_oncologico", `
  + `'$.linhas[*] ? (!exists(@.tipo) || @.tipo.type() != "string" || (@.tipo != "apresentacao" && @.tipo != "propedeutica" && @.tipo != "terapeutica"))')`;

export class CabecalhoOncologico1790294400000 implements MigrationInterface {
  name = 'CabecalhoOncologico1790294400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pacientes" ADD COLUMN IF NOT EXISTS "cabecalho_oncologico" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP CONSTRAINT IF EXISTS "CHK_pacientes_cabecalho_objeto"`);
    await queryRunner.query(`ALTER TABLE "pacientes" ADD CONSTRAINT "CHK_pacientes_cabecalho_objeto" CHECK (jsonb_typeof("cabecalho_oncologico") = 'object')`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP CONSTRAINT IF EXISTS "CHK_pacientes_cabecalho_tipo_linha"`);
    await queryRunner.query(`ALTER TABLE "pacientes" ADD CONSTRAINT "CHK_pacientes_cabecalho_tipo_linha" CHECK (${CHECK_TIPO})`);
    await queryRunner.query(`ALTER TABLE "eventos_administrativos" DROP CONSTRAINT IF EXISTS "CHK_eventos_administrativos_tipo"`);
    await queryRunner.query(`
      ALTER TABLE "eventos_administrativos" ADD CONSTRAINT "CHK_eventos_administrativos_tipo"
        CHECK ("tipo" IN ('reagendamento','contato','lista_problemas','cabecalho_oncologico'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volta o CHECK de eventos a três valores — falha se já houver evento do cabeçalho, e é
    // para falhar: apagar rastro de trilha não é o que um down deve fazer em silêncio.
    await queryRunner.query(`ALTER TABLE "eventos_administrativos" DROP CONSTRAINT IF EXISTS "CHK_eventos_administrativos_tipo"`);
    await queryRunner.query(`
      ALTER TABLE "eventos_administrativos" ADD CONSTRAINT "CHK_eventos_administrativos_tipo"
        CHECK ("tipo" IN ('reagendamento','contato','lista_problemas'))`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP CONSTRAINT IF EXISTS "CHK_pacientes_cabecalho_tipo_linha"`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP CONSTRAINT IF EXISTS "CHK_pacientes_cabecalho_objeto"`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "cabecalho_oncologico"`);
  }
}
