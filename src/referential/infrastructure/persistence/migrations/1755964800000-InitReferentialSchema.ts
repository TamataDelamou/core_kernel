import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schéma initial de GSG Referential (KER-REF-01..09, KER-ADM-03/04). Nommage en français
 * conformément à KER-NOM-01 (référentiel métier partagé). Aucune contrainte de clé étrangère
 * vers `utilisateur` (module GSG ID) : services distincts, découplage strict (KER-VIS-03).
 */
export class InitReferentialSchema1755964800000 implements MigrationInterface {
  name = 'InitReferentialSchema1755964800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "pays" (
        "id" uuid NOT NULL,
        "code_iso" varchar(2) NOT NULL,
        "nom" varchar(150) NOT NULL,
        "organisme_regional_principal" varchar(255),
        "notes_souverainete" text,
        "adresse_gabarit" text,
        "fuseau_horaire" varchar(64),
        "est_actif" boolean NOT NULL DEFAULT true,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pays" PRIMARY KEY ("id"),
        CONSTRAINT "CK_pays_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'en_revision', 'valide', 'publie'))
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_pays_code_iso" ON "pays" ("code_iso");`);
    await queryRunner.query(`CREATE INDEX "IDX_pays_statut_workflow" ON "pays" ("statut_workflow");`);

    await queryRunner.query(`
      CREATE TABLE "devise" (
        "id" uuid NOT NULL,
        "code_iso4217" varchar(3) NOT NULL,
        "nom" varchar(150) NOT NULL,
        "zone_monetaire" varchar(100),
        "decimales" int NOT NULL,
        "est_actif" boolean NOT NULL DEFAULT true,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_devise" PRIMARY KEY ("id"),
        CONSTRAINT "CK_devise_decimales" CHECK ("decimales" BETWEEN 0 AND 4),
        CONSTRAINT "CK_devise_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'en_revision', 'valide', 'publie'))
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_devise_code_iso4217" ON "devise" ("code_iso4217");`);

    await queryRunner.query(`
      CREATE TABLE "langue" (
        "id" uuid NOT NULL,
        "code_iso639" varchar(3) NOT NULL,
        "nom" varchar(150) NOT NULL,
        "est_actif" boolean NOT NULL DEFAULT true,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_langue" PRIMARY KEY ("id"),
        CONSTRAINT "CK_langue_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'en_revision', 'valide', 'publie'))
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_langue_code_iso639" ON "langue" ("code_iso639");`);

    await queryRunner.query(`
      CREATE TABLE "bloc_regional" (
        "id" uuid NOT NULL,
        "code" varchar(20) NOT NULL,
        "nom" varchar(150) NOT NULL,
        "type" varchar(20) NOT NULL,
        "est_actif" boolean NOT NULL DEFAULT true,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bloc_regional" PRIMARY KEY ("id"),
        CONSTRAINT "CK_bloc_regional_type" CHECK
          ("type" IN ('economique', 'juridique', 'monetaire', 'examinateur')),
        CONSTRAINT "CK_bloc_regional_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'en_revision', 'valide', 'publie'))
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_bloc_regional_code" ON "bloc_regional" ("code");`);

    await queryRunner.query(`
      CREATE TABLE "pays_devise" (
        "id" uuid NOT NULL,
        "pays_id" uuid NOT NULL,
        "devise_id" uuid NOT NULL,
        "date_debut" date NOT NULL,
        "date_fin" date,
        "devise_principale" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_pays_devise" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pays_devise_pays" FOREIGN KEY ("pays_id") REFERENCES "pays" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pays_devise_devise" FOREIGN KEY ("devise_id") REFERENCES "devise" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_pays_devise_pays_id" ON "pays_devise" ("pays_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_pays_devise_devise_id" ON "pays_devise" ("devise_id");`);

    await queryRunner.query(`
      CREATE TABLE "pays_langue" (
        "id" uuid NOT NULL,
        "pays_id" uuid NOT NULL,
        "langue_id" uuid NOT NULL,
        "statut" varchar(30) NOT NULL,
        "ordre" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_pays_langue" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pays_langue_pays" FOREIGN KEY ("pays_id") REFERENCES "pays" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pays_langue_langue" FOREIGN KEY ("langue_id") REFERENCES "langue" ("id") ON DELETE CASCADE,
        CONSTRAINT "CK_pays_langue_statut" CHECK
          ("statut" IN ('officielle', 'nationale', 'enseignement_initial', 'vehiculaire'))
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_pays_langue_pays_id" ON "pays_langue" ("pays_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_pays_langue_langue_id" ON "pays_langue" ("langue_id");`);

    await queryRunner.query(`
      CREATE TABLE "pays_bloc_regional" (
        "id" uuid NOT NULL,
        "pays_id" uuid NOT NULL,
        "bloc_regional_id" uuid NOT NULL,
        "date_adhesion" date NOT NULL,
        "date_retrait" date,
        "statut_actuel" varchar(20) NOT NULL DEFAULT 'membre',
        CONSTRAINT "PK_pays_bloc_regional" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pays_bloc_regional_pays" FOREIGN KEY ("pays_id") REFERENCES "pays" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pays_bloc_regional_bloc" FOREIGN KEY ("bloc_regional_id") REFERENCES "bloc_regional" ("id") ON DELETE CASCADE,
        CONSTRAINT "CK_pays_bloc_regional_statut" CHECK
          ("statut_actuel" IN ('membre', 'suspendu', 'retire'))
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_pays_bloc_regional_pays_id" ON "pays_bloc_regional" ("pays_id");`);
    await queryRunner.query(
      `CREATE INDEX "IDX_pays_bloc_regional_bloc_id" ON "pays_bloc_regional" ("bloc_regional_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "taux_change" (
        "id" uuid NOT NULL,
        "devise_base_id" uuid NOT NULL,
        "devise_cible_id" uuid NOT NULL,
        "taux" numeric(24,10) NOT NULL,
        "valid_du" timestamptz NOT NULL,
        "valid_au" timestamptz,
        "source" varchar(150) NOT NULL,
        CONSTRAINT "PK_taux_change" PRIMARY KEY ("id"),
        CONSTRAINT "FK_taux_change_devise_base" FOREIGN KEY ("devise_base_id") REFERENCES "devise" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_taux_change_devise_cible" FOREIGN KEY ("devise_cible_id") REFERENCES "devise" ("id") ON DELETE CASCADE,
        CONSTRAINT "CK_taux_change_positif" CHECK ("taux" > 0)
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_taux_change_base" ON "taux_change" ("devise_base_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_taux_change_cible" ON "taux_change" ("devise_cible_id");`);

    await queryRunner.query(`
      CREATE TABLE "ville" (
        "id" uuid NOT NULL,
        "pays_id" uuid NOT NULL,
        "nom" varchar(150) NOT NULL,
        "referentiel_hierarchique_id" uuid,
        "est_actif" boolean NOT NULL DEFAULT true,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ville" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ville_pays" FOREIGN KEY ("pays_id") REFERENCES "pays" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ville_pays_id" ON "ville" ("pays_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ville";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "taux_change";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pays_bloc_regional";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pays_langue";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pays_devise";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bloc_regional";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "langue";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "devise";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pays";`);
  }
}
