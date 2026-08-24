import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * KER-ADM-04, volet "villes rattachées" : table d'indexation locale, alimentée par
 * VilleRattacheeConsumerService (Redis Streams). Aucune clé étrangère physique vers
 * `noeud_hierarchique.id` : cette table est alimentée par un ÉVÉNEMENT en provenance de
 * `referential` (un autre module), pas par une écriture transactionnelle conjointe avec
 * `noeud_hierarchique` — une FK ici créerait une dépendance d'écriture entre deux flux qui
 * doivent rester indépendants (KER-VIS-03).
 */
export class InitCompteurVillesRattacheesSchema1757001600000 implements MigrationInterface {
  name = 'InitCompteurVillesRattacheesSchema1757001600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "compteur_villes_rattachees" (
        "noeud_id" uuid NOT NULL,
        "nombre_villes" int NOT NULL DEFAULT 0,
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_compteur_villes_rattachees" PRIMARY KEY ("noeud_id"),
        CONSTRAINT "CK_compteur_villes_rattachees_non_negatif" CHECK ("nombre_villes" >= 0)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "compteur_villes_rattachees";`);
  }
}
