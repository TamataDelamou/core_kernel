import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * KER-PROD-01 : un catalogue commercial référence désormais obligatoirement un produit du
 * portefeuille GSG. Aucune donnée en production sur le noyau à ce jour (cf. Cahier v3.0,
 * note de version) — colonne ajoutée directement en NOT NULL, sans backfill nécessaire.
 * Aucune contrainte de clé étrangère physique vers `produit_portefeuille` (service distinct,
 * KER-VIS-03) : la validation se fait exclusivement via ProductLookupPort, à l'écriture.
 */
export class AddProduitIdToCatalogue1756742400000 implements MigrationInterface {
  name = 'AddProduitIdToCatalogue1756742400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Aucune ligne existante à ce jour (cf. Cahier v3.0) — NOT NULL direct, sans backfill,
    // qui aurait de toute façon nécessité une valeur random ne correspondant à aucun produit
    // réel du registre, contredisant l'intégrité référentielle même qu'on cherche à établir.
    await queryRunner.query(`ALTER TABLE "catalogue" ADD COLUMN "produit_id" uuid NOT NULL;`);
    await queryRunner.query(`CREATE INDEX "IDX_catalogue_produit_id" ON "catalogue" ("produit_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_catalogue_produit_id";`);
    await queryRunner.query(`ALTER TABLE "catalogue" DROP COLUMN IF EXISTS "produit_id";`);
  }
}
