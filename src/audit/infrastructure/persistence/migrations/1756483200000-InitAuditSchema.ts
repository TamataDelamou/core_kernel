import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuditSchema1756483200000 implements MigrationInterface {
  name = 'InitAuditSchema1756483200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "audit_evenement" (
        "id" uuid NOT NULL,
        "evenement_id" uuid NOT NULL,
        "type" varchar(150) NOT NULL,
        "gsg_org_id" uuid,
        "produit_source" varchar(100) NOT NULL,
        "horodatage" timestamptz NOT NULL,
        "charge_utile" jsonb NOT NULL,
        "traite_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_evenement" PRIMARY KEY ("id")
      );
    `);
    // Contrainte d'unicité = mécanisme d'idempotence lui-même, pas seulement un index de perf.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_audit_evenement_evenement_id" ON "audit_evenement" ("evenement_id");`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_audit_evenement_type" ON "audit_evenement" ("type");`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_evenement_gsg_org_id" ON "audit_evenement" ("gsg_org_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_evenement_horodatage" ON "audit_evenement" ("horodatage");`);
    // Index composite couvrant la requête KER-AUD-01 la plus fréquente : par organisation, triée par date.
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_evenement_gsg_org_id_horodatage" ON "audit_evenement" ("gsg_org_id", "horodatage" DESC);`,
    );

    await queryRunner.query(`
      CREATE TABLE "evenement_en_echec" (
        "id" uuid NOT NULL,
        "evenement_id" uuid NOT NULL,
        "type" varchar(150) NOT NULL,
        "gsg_org_id" uuid,
        "produit_source" varchar(100) NOT NULL,
        "horodatage" timestamptz NOT NULL,
        "charge_utile" jsonb NOT NULL,
        "tentatives" int NOT NULL,
        "derniere_erreur" text NOT NULL,
        "mis_en_echec_le" timestamptz NOT NULL DEFAULT now(),
        "rejoue_le" timestamptz,
        CONSTRAINT "PK_evenement_en_echec" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_evenement_en_echec_evenement_id" ON "evenement_en_echec" ("evenement_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_evenement_en_echec_mis_en_echec_le" ON "evenement_en_echec" ("mis_en_echec_le");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "evenement_en_echec";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_evenement";`);
  }
}
