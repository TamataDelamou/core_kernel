import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schéma initial du Referential Engine (KER-ADM-01, section 8 du Cahier — périmètre
 * administratif de cette passe). Aucune contrainte de clé étrangère vers `pays` (GSG
 * Referential) : service distinct, découplage strict (KER-VIS-03). `parent_id` est une
 * auto-référence interne à `noeud_hierarchique`, seule exception légitime.
 */
export class InitReferentialEngineSchema1756569600000 implements MigrationInterface {
  name = 'InitReferentialEngineSchema1756569600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "niveau_administratif" (
        "id" uuid NOT NULL,
        "pays_id" uuid NOT NULL,
        "rang" int NOT NULL,
        "nom" varchar(100) NOT NULL,
        "est_actif" boolean NOT NULL DEFAULT true,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_niveau_administratif" PRIMARY KEY ("id"),
        CONSTRAINT "CK_niveau_administratif_rang" CHECK ("rang" >= 1)
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_niveau_administratif_pays_rang" ON "niveau_administratif" ("pays_id", "rang");`,
    );

    await queryRunner.query(`
      CREATE TABLE "noeud_hierarchique" (
        "id" uuid NOT NULL,
        "pays_id" uuid NOT NULL,
        "code_domaine" varchar(50) NOT NULL,
        "parent_id" uuid,
        "chemin" varchar(2000) NOT NULL,
        "appellation_locale" varchar(200) NOT NULL,
        "rang_normalise" int NOT NULL,
        "ordre" int NOT NULL DEFAULT 0,
        "est_noeud_terminal" boolean NOT NULL DEFAULT false,
        "est_actif" boolean NOT NULL DEFAULT true,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_noeud_hierarchique" PRIMARY KEY ("id"),
        CONSTRAINT "FK_noeud_hierarchique_parent" FOREIGN KEY ("parent_id")
          REFERENCES "noeud_hierarchique" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CK_noeud_hierarchique_rang" CHECK ("rang_normalise" >= 1),
        CONSTRAINT "CK_noeud_hierarchique_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'en_revision', 'valide', 'publie'))
      );
    `);
    // ON DELETE RESTRICT sur parent_id : une suppression physique d'un nœud parent avec des
    // enfants existants échoue explicitement plutôt que de casser silencieusement le
    // Materialized Path de ses descendants — cohérent avec KER-ADM-04 (désactivation plutôt
    // que suppression), la suppression physique n'étant de toute façon jamais exposée en API.
    await queryRunner.query(`CREATE INDEX "IDX_noeud_hierarchique_pays_id" ON "noeud_hierarchique" ("pays_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_noeud_hierarchique_code_domaine" ON "noeud_hierarchique" ("code_domaine");`);
    await queryRunner.query(`CREATE INDEX "IDX_noeud_hierarchique_parent_id" ON "noeud_hierarchique" ("parent_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_noeud_hierarchique_chemin" ON "noeud_hierarchique" ("chemin");`);
    await queryRunner.query(`CREATE INDEX "IDX_noeud_hierarchique_statut_workflow" ON "noeud_hierarchique" ("statut_workflow");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "noeud_hierarchique";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "niveau_administratif";`);
  }
}
