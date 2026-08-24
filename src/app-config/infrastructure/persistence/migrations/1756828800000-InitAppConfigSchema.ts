import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAppConfigSchema1756828800000 implements MigrationInterface {
  name = 'InitAppConfigSchema1756828800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "configuration_globale" (
        "id" uuid NOT NULL,
        "devise_id" uuid,
        "langue_id" uuid,
        "fuseau_horaire" varchar(100) NOT NULL DEFAULT 'UTC',
        "format_date" varchar(50) NOT NULL DEFAULT 'DD/MM/YYYY',
        "format_nombre" varchar(50) NOT NULL DEFAULT '#,##0.00',
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_configuration_globale" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      INSERT INTO "configuration_globale" ("id") VALUES ('00000000-0000-0000-0000-000000000001');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "configuration_globale";`);
  }
}
