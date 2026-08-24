import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schéma initial d'Org Registry (KER-ORG-01..04). Aucune contrainte de clé étrangère vers
 * `pays`/`devise`/`langue` (GSG Referential) ni vers `utilisateur` (GSG ID) : services
 * distincts, découplage strict par API (KER-VIS-03). `organisation_mere_id` est une
 * auto-référence interne à cette même table, seule exception légitime.
 */
export class InitOrgSchema1756051200000 implements MigrationInterface {
  name = 'InitOrgSchema1756051200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "organisation" (
        "id" uuid NOT NULL,
        "nom" varchar(200) NOT NULL,
        "organisation_mere_id" uuid,
        "pays_id" uuid,
        "unite_administrative_id" uuid,
        "ville_id" uuid,
        "devise_id" uuid,
        "langue_id" uuid,
        "fuseau_horaire" varchar(64),
        "est_actif" boolean NOT NULL DEFAULT true,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organisation" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organisation_mere" FOREIGN KEY ("organisation_mere_id")
          REFERENCES "organisation" ("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_organisation_mere_id" ON "organisation" ("organisation_mere_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "unite_operationnelle" (
        "id" uuid NOT NULL,
        "organisation_id" uuid NOT NULL,
        "nom" varchar(200) NOT NULL,
        "pays_id" uuid,
        "unite_administrative_id" uuid,
        "ville_id" uuid,
        "devise_id" uuid,
        "langue_id" uuid,
        "fuseau_horaire" varchar(64),
        "est_actif" boolean NOT NULL DEFAULT true,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_unite_operationnelle" PRIMARY KEY ("id"),
        CONSTRAINT "FK_unite_operationnelle_organisation" FOREIGN KEY ("organisation_id")
          REFERENCES "organisation" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_unite_operationnelle_organisation_id" ON "unite_operationnelle" ("organisation_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "abonnement_produit" (
        "id" uuid NOT NULL,
        "organisation_id" uuid NOT NULL,
        "produit_id" uuid NOT NULL,
        "statut" varchar(20) NOT NULL DEFAULT 'actif',
        "date_debut" date NOT NULL,
        "date_fin" date,
        CONSTRAINT "PK_abonnement_produit" PRIMARY KEY ("id"),
        CONSTRAINT "FK_abonnement_produit_organisation" FOREIGN KEY ("organisation_id")
          REFERENCES "organisation" ("id") ON DELETE CASCADE,
        CONSTRAINT "CK_abonnement_produit_statut" CHECK
          ("statut" IN ('actif', 'suspendu', 'resilie'))
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_abonnement_produit_organisation_id" ON "abonnement_produit" ("organisation_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_abonnement_produit_produit_id" ON "abonnement_produit" ("produit_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "abonnement_produit";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "unite_operationnelle";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organisation";`);
  }
}
