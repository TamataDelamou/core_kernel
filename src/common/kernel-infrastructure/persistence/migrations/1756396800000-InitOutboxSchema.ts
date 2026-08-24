import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table partagée du noyau (KER-VIS-05), unique source du Transactional Outbox pour les 4
 * modules existants (identity, referential, org, product) et toute brique future qui
 * consommera EVENT_PUBLISHER. Aucune contrainte de clé étrangère : cette table est
 * intentionnellement découplée du schéma métier de chaque module (l'outbox ne doit jamais
 * bloquer ni être bloqué par une contrainte référentielle d'un module en particulier).
 */
export class InitOutboxSchema1756396800000 implements MigrationInterface {
  name = 'InitOutboxSchema1756396800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "evenement_outbox" (
        "id" uuid NOT NULL,
        "type" varchar(150) NOT NULL,
        "gsg_org_id" uuid,
        "horodatage" timestamptz NOT NULL,
        "produit_source" varchar(100) NOT NULL,
        "charge_utile" jsonb NOT NULL,
        "statut" varchar(20) NOT NULL DEFAULT 'en_attente',
        "tentatives" int NOT NULL DEFAULT 0,
        "derniere_erreur" text,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "publie_le" timestamptz,
        CONSTRAINT "PK_evenement_outbox" PRIMARY KEY ("id"),
        CONSTRAINT "CK_evenement_outbox_statut" CHECK
          ("statut" IN ('en_attente', 'publie', 'echec'))
      );
    `);

    await queryRunner.query(`CREATE INDEX "IDX_evenement_outbox_type" ON "evenement_outbox" ("type");`);
    await queryRunner.query(`CREATE INDEX "IDX_evenement_outbox_gsg_org_id" ON "evenement_outbox" ("gsg_org_id");`);
    // Index composite couvrant la requête la plus fréquente du relais : lot en attente, FIFO.
    await queryRunner.query(
      `CREATE INDEX "IDX_evenement_outbox_statut_cree_le" ON "evenement_outbox" ("statut", "cree_le");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "evenement_outbox";`);
  }
}
