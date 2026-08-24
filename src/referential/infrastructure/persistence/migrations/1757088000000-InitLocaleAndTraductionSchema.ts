import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * KER-NOM-04 : locale (BCP 47) et traduction, internationalisation logicielle distincte du
 * référentiel métier pays/devise/langue. L'index unique partiel sur `est_par_defaut` est le
 * filet de sécurité ultime de l'invariant "au plus une locale par défaut" — garanti au niveau
 * base de données, pas seulement par SetLocaleParDefautUseCase.
 */
export class InitLocaleAndTraductionSchema1757088000000 implements MigrationInterface {
  name = 'InitLocaleAndTraductionSchema1757088000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "locale" (
        "id" uuid NOT NULL,
        "code" varchar(20) NOT NULL,
        "libelle" varchar(150) NOT NULL,
        "est_par_defaut" boolean NOT NULL DEFAULT false,
        "est_actif" boolean NOT NULL DEFAULT true,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_locale" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_locale_code" ON "locale" ("code");`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_locale_une_seule_par_defaut" ON "locale" ("est_par_defaut") WHERE "est_par_defaut" = true;`,
    );

    await queryRunner.query(`
      CREATE TABLE "traduction" (
        "id" uuid NOT NULL,
        "locale_id" uuid NOT NULL,
        "cle" varchar(200) NOT NULL,
        "valeur" text NOT NULL,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_traduction" PRIMARY KEY ("id"),
        CONSTRAINT "FK_traduction_locale" FOREIGN KEY ("locale_id")
          REFERENCES "locale" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_traduction_locale_id" ON "traduction" ("locale_id");`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_traduction_locale_cle" ON "traduction" ("locale_id", "cle");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "traduction";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locale";`);
  }
}
