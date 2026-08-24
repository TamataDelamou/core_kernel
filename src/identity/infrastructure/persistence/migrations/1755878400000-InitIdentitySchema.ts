import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schéma initial de GSG ID (KER-ID-01..06). Les colonnes de référence vers le GSG
 * Referential (pays_id, unite_administrative_id, ville_id, langue_id, devise_id) ne portent
 * volontairement aucune contrainte de clé étrangère physique inter-service : GSG Referential
 * est un service distinct (KER-VIS-03, accès exclusivement par API/événements, jamais par
 * accès direct inter-bases). L'intégrité référentielle est garantie applicativement.
 */
export class InitIdentitySchema1755878400000 implements MigrationInterface {
  name = 'InitIdentitySchema1755878400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "utilisateur" (
        "gsg_id" uuid NOT NULL,
        "email" varchar(254) NOT NULL,
        "email_verifie" boolean NOT NULL DEFAULT false,
        "phone" varchar(20),
        "phone_verifie" boolean NOT NULL DEFAULT false,
        "password_hash" varchar(255) NOT NULL,
        "nom_affichage" varchar(120) NOT NULL,
        "statut" varchar(20) NOT NULL DEFAULT 'actif',
        "mfa_active" boolean NOT NULL DEFAULT false,
        "pays_id" uuid,
        "unite_administrative_id" uuid,
        "ville_id" uuid,
        "langue_id" uuid,
        "devise_id" uuid,
        "fuseau_horaire" varchar(64),
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        "dernier_auth_le" timestamptz,
        "tentatives_echouees_consecutives" int NOT NULL DEFAULT 0,
        "verrouille_jusqua" timestamptz,
        CONSTRAINT "PK_utilisateur" PRIMARY KEY ("gsg_id"),
        CONSTRAINT "CK_utilisateur_statut" CHECK ("statut" IN ('actif', 'suspendu', 'desactive'))
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_utilisateur_email" ON "utilisateur" ("email");`,
    );

    await queryRunner.query(`
      CREATE TABLE "role" (
        "id" uuid NOT NULL,
        "code" varchar(100) NOT NULL,
        "nom" varchar(150) NOT NULL,
        "description" text NOT NULL,
        "gsg_org_id" uuid,
        "permissions" jsonb NOT NULL DEFAULT '[]',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_role_code_org" ON "role" ("code", COALESCE("gsg_org_id", '00000000-0000-0000-0000-000000000000'));`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_role_gsg_org_id" ON "role" ("gsg_org_id");`);

    await queryRunner.query(`
      CREATE TABLE "attribution_role_utilisateur" (
        "id" uuid NOT NULL,
        "gsg_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "gsg_org_id" uuid,
        "assigne_par" uuid NOT NULL,
        "assigne_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attribution_role_utilisateur" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attribution_role_utilisateur_gsg_id" FOREIGN KEY ("gsg_id")
          REFERENCES "utilisateur" ("gsg_id") ON DELETE CASCADE,
        CONSTRAINT "FK_attribution_role_utilisateur_role_id" FOREIGN KEY ("role_id")
          REFERENCES "role" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_attribution_role_gsg_id" ON "attribution_role_utilisateur" ("gsg_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "jeton_rafraichissement" (
        "id" uuid NOT NULL,
        "gsg_id" uuid NOT NULL,
        "token_hash" varchar(255) NOT NULL,
        "family_id" uuid NOT NULL,
        "emis_le" timestamptz NOT NULL DEFAULT now(),
        "expire_le" timestamptz NOT NULL,
        "consomme_le" timestamptz,
        "revoque_le" timestamptz,
        "ip_emission" varchar(45) NOT NULL,
        "user_agent" text NOT NULL,
        CONSTRAINT "PK_jeton_rafraichissement" PRIMARY KEY ("id"),
        CONSTRAINT "FK_jeton_rafraichissement_gsg_id" FOREIGN KEY ("gsg_id")
          REFERENCES "utilisateur" ("gsg_id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_jeton_rafraichissement_gsg_id" ON "jeton_rafraichissement" ("gsg_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_jeton_rafraichissement_family_id" ON "jeton_rafraichissement" ("family_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE "facteur_mfa" (
        "id" uuid NOT NULL,
        "gsg_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL DEFAULT 'totp',
        "secret_chiffre" text NOT NULL,
        "statut" varchar(30) NOT NULL DEFAULT 'en_attente_activation',
        "codes_recuperation_hashes" jsonb NOT NULL DEFAULT '[]',
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "active_le" timestamptz,
        CONSTRAINT "PK_facteur_mfa" PRIMARY KEY ("id"),
        CONSTRAINT "FK_facteur_mfa_gsg_id" FOREIGN KEY ("gsg_id")
          REFERENCES "utilisateur" ("gsg_id") ON DELETE CASCADE,
        CONSTRAINT "CK_facteur_mfa_statut" CHECK
          ("statut" IN ('en_attente_activation', 'actif', 'revoque'))
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_facteur_mfa_gsg_id" ON "facteur_mfa" ("gsg_id");`);

    await queryRunner.query(`
      CREATE TABLE "correspondance_identite_externe" (
        "id" uuid NOT NULL,
        "gsg_id" uuid NOT NULL,
        "produit_id" uuid NOT NULL,
        "external_user_id" varchar(255) NOT NULL,
        "lie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_correspondance_identite_externe" PRIMARY KEY ("id"),
        CONSTRAINT "FK_correspondance_identite_externe_gsg_id" FOREIGN KEY ("gsg_id")
          REFERENCES "utilisateur" ("gsg_id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_correspondance_produit_external_id" ON "correspondance_identite_externe" ("produit_id", "external_user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_correspondance_gsg_id" ON "correspondance_identite_externe" ("gsg_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "correspondance_identite_externe";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "facteur_mfa";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jeton_rafraichissement";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attribution_role_utilisateur";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "utilisateur";`);
  }
}
