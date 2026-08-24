import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schéma initial de GSG Product Catalog (KER-PRD). Aucune contrainte de clé étrangère vers
 * `pays`/`devise` (GSG Referential), `organisation` (Org Registry) ni `utilisateur` (GSG ID) :
 * services distincts, découplage strict par ports (KER-VIS-03). `catalogue.scope_cible_id`
 * référence soit un `gsg_org_id`, soit un `pays_id`, selon `scope_type` — jamais contraint
 * physiquement, validé applicativement via les ports au moment de la mutation.
 */
export class InitProductSchema1756137600000 implements MigrationInterface {
  name = 'InitProductSchema1756137600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "catalogue" (
        "id" uuid NOT NULL,
        "nom" varchar(200) NOT NULL,
        "scope_type" varchar(30) NOT NULL,
        "scope_cible_id" uuid,
        "est_actif" boolean NOT NULL DEFAULT true,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalogue" PRIMARY KEY ("id"),
        CONSTRAINT "CK_catalogue_scope_type" CHECK
          ("scope_type" IN ('portefeuille_global', 'organisation', 'zone_geographique')),
        CONSTRAINT "CK_catalogue_scope_cible_coherent" CHECK
          (("scope_type" = 'portefeuille_global' AND "scope_cible_id" IS NULL)
           OR ("scope_type" <> 'portefeuille_global' AND "scope_cible_id" IS NOT NULL)),
        CONSTRAINT "CK_catalogue_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'valide', 'publie', 'archive'))
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_catalogue_scope_cible_id" ON "catalogue" ("scope_cible_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_catalogue_statut_workflow" ON "catalogue" ("statut_workflow");`);

    await queryRunner.query(`
      CREATE TABLE "produit_catalogue" (
        "id" uuid NOT NULL,
        "catalogue_id" uuid NOT NULL,
        "code" varchar(64) NOT NULL,
        "nom" varchar(200) NOT NULL,
        "description" text,
        "est_actif" boolean NOT NULL DEFAULT true,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_produit_catalogue" PRIMARY KEY ("id"),
        CONSTRAINT "FK_produit_catalogue_catalogue" FOREIGN KEY ("catalogue_id")
          REFERENCES "catalogue" ("id") ON DELETE CASCADE,
        CONSTRAINT "CK_produit_catalogue_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'valide', 'publie', 'archive'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_produit_catalogue_code" ON "produit_catalogue" ("catalogue_id", "code");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_produit_catalogue_catalogue_id" ON "produit_catalogue" ("catalogue_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "offre" (
        "id" uuid NOT NULL,
        "produit_id" uuid NOT NULL,
        "code" varchar(64) NOT NULL,
        "nom" varchar(200) NOT NULL,
        "type" varchar(20) NOT NULL,
        "periode_facturation" varchar(20) NOT NULL,
        "est_actif" boolean NOT NULL DEFAULT true,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_offre" PRIMARY KEY ("id"),
        CONSTRAINT "FK_offre_produit" FOREIGN KEY ("produit_id")
          REFERENCES "produit_catalogue" ("id") ON DELETE CASCADE,
        CONSTRAINT "CK_offre_type" CHECK ("type" IN ('abonnement', 'usage', 'ponctuel')),
        CONSTRAINT "CK_offre_periode_facturation" CHECK
          ("periode_facturation" IN ('mensuelle', 'annuelle', 'unique')),
        CONSTRAINT "CK_offre_type_periode_coherents" CHECK
          (("type" = 'ponctuel' AND "periode_facturation" = 'unique')
           OR ("type" <> 'ponctuel' AND "periode_facturation" <> 'unique')),
        CONSTRAINT "CK_offre_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'valide', 'publie', 'archive'))
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_offre_code" ON "offre" ("produit_id", "code");`);
    await queryRunner.query(`CREATE INDEX "IDX_offre_produit_id" ON "offre" ("produit_id");`);

    await queryRunner.query(`
      CREATE TABLE "feature" (
        "id" uuid NOT NULL,
        "code" varchar(64) NOT NULL,
        "nom" varchar(200) NOT NULL,
        "description" text,
        "est_actif" boolean NOT NULL DEFAULT true,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_feature_code" ON "feature" ("code");`);

    await queryRunner.query(`
      CREATE TABLE "offre_entitlement" (
        "id" uuid NOT NULL,
        "offre_id" uuid NOT NULL,
        "feature_id" uuid NOT NULL,
        "limite" int,
        "unite" varchar(50),
        CONSTRAINT "PK_offre_entitlement" PRIMARY KEY ("id"),
        CONSTRAINT "FK_offre_entitlement_offre" FOREIGN KEY ("offre_id")
          REFERENCES "offre" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_offre_entitlement_feature" FOREIGN KEY ("feature_id")
          REFERENCES "feature" ("id") ON DELETE CASCADE,
        CONSTRAINT "CK_offre_entitlement_limite" CHECK ("limite" IS NULL OR "limite" >= 0)
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_offre_entitlement" ON "offre_entitlement" ("offre_id", "feature_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "grille_tarifaire" (
        "id" uuid NOT NULL,
        "offre_id" uuid NOT NULL,
        "version" int NOT NULL,
        "devise_id" uuid NOT NULL,
        "montant_minor_unit" integer NOT NULL,
        "periode_facturation" varchar(20) NOT NULL,
        "date_effective" timestamptz NOT NULL,
        "date_fin" timestamptz,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grille_tarifaire" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grille_tarifaire_offre" FOREIGN KEY ("offre_id")
          REFERENCES "offre" ("id") ON DELETE CASCADE,
        CONSTRAINT "CK_grille_tarifaire_montant" CHECK ("montant_minor_unit" >= 0),
        CONSTRAINT "CK_grille_tarifaire_version" CHECK ("version" >= 1),
        CONSTRAINT "CK_grille_tarifaire_fenetre" CHECK
          ("date_fin" IS NULL OR "date_fin" > "date_effective"),
        CONSTRAINT "CK_grille_tarifaire_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'valide', 'publie', 'archive'))
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_grille_tarifaire_version" ON "grille_tarifaire" ("offre_id", "version");`);
    await queryRunner.query(`CREATE INDEX "IDX_grille_tarifaire_offre_id" ON "grille_tarifaire" ("offre_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_grille_tarifaire_devise_id" ON "grille_tarifaire" ("devise_id");`);
    await queryRunner.query(
      `CREATE INDEX "IDX_grille_tarifaire_offre_devise_statut" ON "grille_tarifaire" ("offre_id", "devise_id", "statut_workflow");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "grille_tarifaire";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "offre_entitlement";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feature";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "offre";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "produit_catalogue";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalogue";`);
  }
}
