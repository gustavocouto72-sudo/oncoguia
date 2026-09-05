import { MigrationInterface, QueryRunner } from 'typeorm';

// GESTÃO DE RECURSOS — os dois lados do dinheiro, no nível do INSUMO.
//
// O que muda em relação a `custos_regime`: lá existe um preço por PROTOCOLO, cadastrado à
// mão, que responde "quanto custa um ciclo deste esquema". Aqui a pergunta é outra e mais
// operacional: "quantos frascos de qual fármaco o hospital precisa comprar, e quanto ele
// cobra da operadora por isso". `custos_regime` NÃO sai de cena — vira o FALLBACK, e a
// tela diz sempre qual dos dois produziu cada número.
//
// Três tabelas:
//   • insumos          — o fármaco canônico (o mesmo nome que a `composicao` do corpus usa).
//   • apresentacoes    — o que se compra de verdade: "frasco 150 mg", com preço de COMPRA
//                        em faixa (tabela x negociado) e preço de FATURAMENTO.
//   • premissas_recursos — o paciente-padrão declarado (SC, peso, clearance de Calvert).
//
// `preco_faturamento` é NULLABLE de propósito, e essa é a decisão de modelagem mais
// importante do arquivo: sem contrato cadastrado NÃO HÁ projeção de receita. Herdar o
// preço de compra produziria margem zero — um número que parece resposta e é a ausência
// de resposta. Ausente significa ausente, e a tela mostra "sem dado".
//
// `numeric(12,2)` e não float, pelo mesmo motivo de `custos_regime`: dinheiro em ponto
// flutuante acumula erro na multiplicação, e aqui multiplica-se por frascos, por ciclos e
// por pacientes.
export class Recursos1789171200000 implements MigrationInterface {
  name = 'Recursos1789171200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- perfil 'gestor' -----------------------------------------------------------
    // `usuarios.perfil` TEM um CHECK (CHK_usuarios_perfil, criado junto com o perfil
    // auditor em SolicitacaoExcecao), então o vocabulário novo precisa entrar aqui — e
    // ANTES de qualquer linha poder recebê-lo. Sem isto o cadastro de um gestor volta
    // como 500 com "violates check constraint", que foi exatamente o que aconteceu.
    //
    // A migration antiga não se edita: ela já rodou, e editá-la deixaria quem já a
    // aplicou sem a mudança. Drop-and-add com o mesmo nome, aqui, é a forma correta.
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfil"`);
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD CONSTRAINT "CHK_usuarios_perfil"
        CHECK ("perfil" IN ('oncologista','revisor','auditor','admin','gestor'))`);

    // ---- medidas reais do paciente (opcionais) -------------------------------------
    // Refinam a dose do paciente-padrão quando existem. Opcionais porque cadastro
    // incompleto é estado legítimo: sem elas, o cálculo usa o padrão DECLARADO e a tela
    // diz que está usando o padrão.
    await queryRunner.query(`ALTER TABLE "pacientes" ADD COLUMN IF NOT EXISTS "peso_kg" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "pacientes" ADD COLUMN IF NOT EXISTS "altura_cm" numeric(5,1)`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP CONSTRAINT IF EXISTS "CK_pacientes_medidas"`);
    await queryRunner.query(`
      ALTER TABLE "pacientes" ADD CONSTRAINT "CK_pacientes_medidas"
        CHECK (("peso_kg" IS NULL OR ("peso_kg" > 0 AND "peso_kg" <= 400))
           AND ("altura_cm" IS NULL OR ("altura_cm" >= 30 AND "altura_cm" <= 250)))`);

    // ---- insumos -------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "insumos" (
        "id" SERIAL NOT NULL,
        "farmaco" character varying(120) NOT NULL,
        "ativo" boolean NOT NULL DEFAULT true,
        "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "atualizado_por" integer,
        CONSTRAINT "PK_insumos" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_insumos_farmaco" UNIQUE ("farmaco"),
        CONSTRAINT "FK_insumos_usuario" FOREIGN KEY ("atualizado_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL
      )`);

    // ---- apresentações -------------------------------------------------------------
    // `conteudo_valor` + `conteudo_unidade` são o que permite a conta: a dose sai em mg
    // (ou UI, ou GBq) e o frasco também, então frascos = ceil(dose / conteúdo). O rótulo
    // `conteudo` é texto humano ("frasco-ampola 150 mg") e não entra em conta nenhuma.
    //
    // `padrao`: qual apresentação o cálculo usa quando o insumo tem mais de uma. Sem
    // marcação e com mais de uma, o servidor devolve "sem dado" em vez de escolher — a
    // apresentação muda o desperdício e, com ele, o custo.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "apresentacoes" (
        "id" SERIAL NOT NULL,
        "insumo_id" integer NOT NULL,
        "conteudo" character varying(120) NOT NULL,
        "conteudo_valor" numeric(12,3) NOT NULL,
        "conteudo_unidade" character varying(10) NOT NULL,
        "padrao" boolean NOT NULL DEFAULT false,
        "preco_compra_tabela" numeric(12,2) NOT NULL,
        "preco_compra_negociado" numeric(12,2) NOT NULL,
        "preco_faturamento" numeric(12,2),
        "fonte_compra_tabela" character varying(200) NOT NULL,
        "fonte_compra_negociado" character varying(200) NOT NULL,
        "fonte_faturamento" character varying(200),
        "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "atualizado_por" integer,
        CONSTRAINT "PK_apresentacoes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_apresentacoes_insumo" FOREIGN KEY ("insumo_id")
          REFERENCES "insumos"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_apresentacoes_usuario" FOREIGN KEY ("atualizado_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL,
        CONSTRAINT "CK_apresentacoes_conteudo" CHECK ("conteudo_valor" > 0),
        CONSTRAINT "CK_apresentacoes_unidade"
          CHECK ("conteudo_unidade" IN ('mg','g','mcg','UI','GBq')),
        -- Preço negativo é erro de digitação, não desconto. E negociado acima da tabela
        -- inverteria a faixa: a tela mostraria o intervalo de trás para frente.
        CONSTRAINT "CK_apresentacoes_precos"
          CHECK ("preco_compra_tabela" >= 0 AND "preco_compra_negociado" >= 0
             AND "preco_compra_negociado" <= "preco_compra_tabela"
             AND ("preco_faturamento" IS NULL OR "preco_faturamento" >= 0)),
        -- Preço de faturamento sem fonte é número sem rastro. Os dois entram juntos ou
        -- nenhum entra.
        CONSTRAINT "CK_apresentacoes_faturamento_com_fonte"
          CHECK (("preco_faturamento" IS NULL) = ("fonte_faturamento" IS NULL))
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_apresentacoes_insumo" ON "apresentacoes" ("insumo_id")`);
    // Uma apresentação padrão por insumo, no máximo — a trava no banco, não só no DTO.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_apresentacoes_padrao"
        ON "apresentacoes" ("insumo_id") WHERE "padrao"`);

    // ---- premissas do paciente-padrão ----------------------------------------------
    // Linha única (id fixo em 1). São DECLARAÇÕES administrativas, não medidas: existem
    // para que o cálculo tenha um corpo quando o paciente não tem peso/altura no
    // cadastro, e para que a tela possa mostrar de onde saiu cada mg.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "premissas_recursos" (
        "id" integer NOT NULL,
        "sc_m2" numeric(4,2) NOT NULL,
        "peso_kg" numeric(5,2) NOT NULL,
        "clearance_ml_min" numeric(5,1) NOT NULL,
        "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "atualizado_por" integer,
        CONSTRAINT "PK_premissas_recursos" PRIMARY KEY ("id"),
        CONSTRAINT "CK_premissas_recursos_linha_unica" CHECK ("id" = 1),
        CONSTRAINT "CK_premissas_recursos_faixas"
          CHECK ("sc_m2" > 0 AND "sc_m2" <= 3 AND "peso_kg" > 0 AND "peso_kg" <= 400
             AND "clearance_ml_min" > 0 AND "clearance_ml_min" <= 200),
        CONSTRAINT "FK_premissas_recursos_usuario" FOREIGN KEY ("atualizado_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL
      )`);
    // Os valores de partida são os DECLARADOS na especificação da fase: SC 1,75 m²,
    // 70 kg, clearance 100 mL/min para o Calvert. Ficam aqui como semente editável pelo
    // admin — não como constante escondida no código.
    await queryRunner.query(`
      INSERT INTO "premissas_recursos" ("id","sc_m2","peso_kg","clearance_ml_min")
      VALUES (1, 1.75, 70, 100) ON CONFLICT ("id") DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volta o CHECK ao vocabulário anterior. Se sobrar algum usuário 'gestor', o ADD
    // falha — e falhar é o certo: reverter o schema com dado que ele não admite deixaria
    // a base num estado que nenhuma versão do código descreve.
    await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "CHK_usuarios_perfil"`);
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD CONSTRAINT "CHK_usuarios_perfil"
        CHECK ("perfil" IN ('oncologista','revisor','auditor','admin'))`);
    await queryRunner.query(`DROP TABLE IF EXISTS "premissas_recursos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "apresentacoes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "insumos"`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP CONSTRAINT IF EXISTS "CK_pacientes_medidas"`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "altura_cm"`);
    await queryRunner.query(`ALTER TABLE "pacientes" DROP COLUMN IF EXISTS "peso_kg"`);
  }
}
