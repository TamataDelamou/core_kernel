import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schéma initial du Registre Central des Produits (KER-PROD-01/02). Aucune contrainte de clé
 * étrangère vers `pays` (GSG Referential) : service distinct, découplage strict (KER-VIS-03).
 */
export class InitProductRegistrySchema1756656000000 implements MigrationInterface {
  name = 'InitProductRegistrySchema1756656000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "produit_portefeuille" (
        "id" uuid NOT NULL,
        "code" varchar(50) NOT NULL,
        "nom" varchar(150) NOT NULL,
        "briques_consommees" jsonb NOT NULL DEFAULT '[]',
        "est_actif" boolean NOT NULL DEFAULT true,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_produit_portefeuille" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_produit_portefeuille_code" ON "produit_portefeuille" ("code");`);

    await queryRunner.query(`
      CREATE TABLE "produit_pays_deploiement" (
        "id" uuid NOT NULL,
        "produit_id" uuid NOT NULL,
        "pays_id" uuid NOT NULL,
        "statut" varchar(20) NOT NULL,
        "phase" varchar(100) NOT NULL,
        "date_statut" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_produit_pays_deploiement" PRIMARY KEY ("id"),
        CONSTRAINT "FK_produit_pays_deploiement_produit" FOREIGN KEY ("produit_id")
          REFERENCES "produit_portefeuille" ("id") ON DELETE CASCADE,
        CONSTRAINT "CK_produit_pays_deploiement_statut" CHECK
          ("statut" IN ('lance', 'en_test', 'planifie', 'non_prioritaire'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_produit_pays_deploiement" ON "produit_pays_deploiement" ("produit_id", "pays_id");`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_produit_pays_deploiement_produit_id" ON "produit_pays_deploiement" ("produit_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_produit_pays_deploiement_pays_id" ON "produit_pays_deploiement" ("pays_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "produit_pays_deploiement";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "produit_portefeuille";`);
  }
}
