import { MigrationInterface, QueryRunner } from 'typeorm';

// IMPORTAÇÃO DE PACIENTES — proposta pendente de validação clínica.
//
// `importacao_propostas` é o envelope administrativo dos dados clínicos que a secretaria
// transcreve do prontuário: fica PENDENTE até um oncologista (ou admin) validar ou
// descartar. Não é registro clínico — nada aqui é lido por motor, snapshot ou trilha
// clínica; o que vira registro é o que a VALIDAÇÃO grava nas tabelas de sempre
// (pacientes.valores_estaveis, avaliacoes, retornos), assinado pelo validador.
//
// Invariantes escritos no banco, não só no serviço:
//  • `estado` fechado em ('pendente','validada','descartada') — CHECK literal;
//  • no máximo UMA proposta pendente por paciente — índice ÚNICO PARCIAL. O serviço
//    também checa (para devolver 409 legível), mas a trava que vale é esta: uma segunda
//    proposta pendente escrita por fora da app não entra.
//  • cascata no paciente (some com ele, como avaliações e retornos), SET NULL nos autores
//    (o registro sobrevive à conta).
export class ImportacaoPropostas1789776000000 implements MigrationInterface {
  name = 'ImportacaoPropostas1789776000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "importacao_propostas" (
        "id" SERIAL NOT NULL,
        "paciente_id" integer NOT NULL,
        "payload" jsonb NOT NULL,
        "estado" varchar(20) NOT NULL DEFAULT 'pendente',
        "criada_por" integer,
        "perfil_ativo" varchar(20),
        "criada_em" timestamptz NOT NULL DEFAULT now(),
        "validada_por" integer,
        "validada_em" timestamptz,
        "motivo_descarte" text,
        "resultado" jsonb,
        CONSTRAINT "PK_importacao_propostas" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_importacao_propostas_estado" CHECK ("estado" IN ('pendente','validada','descartada')),
        CONSTRAINT "FK_importacao_propostas_paciente" FOREIGN KEY ("paciente_id")
          REFERENCES "pacientes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_importacao_propostas_criada_por" FOREIGN KEY ("criada_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_importacao_propostas_validada_por" FOREIGN KEY ("validada_por")
          REFERENCES "usuarios"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_importacao_propostas_paciente_criada"
        ON "importacao_propostas" ("paciente_id", "criada_em")`);
    // Uma pendente por paciente — a trava é do banco.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_importacao_propostas_pendente"
        ON "importacao_propostas" ("paciente_id") WHERE "estado" = 'pendente'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "importacao_propostas"`);
  }
}
