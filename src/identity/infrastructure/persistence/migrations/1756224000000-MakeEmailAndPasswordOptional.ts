import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Support des comptes provisionnés par OTP (WhatsApp ou Email — modèle d'authentification
 * "Interface Utilisateur" intégré à GSG ID) : un utilisateur peut désormais exister sans
 * mot de passe (authentification exclusivement par OTP) et sans email (compte WhatsApp-only,
 * identifié uniquement par téléphone). L'unicité sur `phone` est ajoutée pour garantir la
 * déduplication déjà appliquée sur `email` (KER-ID — un même numéro ne peut correspondre
 * qu'à un seul profil GSG ID, symétrique à la contrainte existante sur l'email).
 */
export class MakeEmailAndPasswordOptional1756224000000 implements MigrationInterface {
  name = 'MakeEmailAndPasswordOptional1756224000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "utilisateur" ALTER COLUMN "email" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "utilisateur" ALTER COLUMN "password_hash" DROP NOT NULL;`);

    // Garde-fou métier : un profil doit toujours porter au moins un identifiant.
    await queryRunner.query(`
      ALTER TABLE "utilisateur"
      ADD CONSTRAINT "CK_utilisateur_au_moins_un_identifiant"
      CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_utilisateur_phone" ON "utilisateur" ("phone");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_utilisateur_phone";`);
    await queryRunner.query(
      `ALTER TABLE "utilisateur" DROP CONSTRAINT IF EXISTS "CK_utilisateur_au_moins_un_identifiant";`,
    );
    // NOTE : remettre les colonnes à NOT NULL en down() échouerait s'il existe déjà des
    // comptes OTP-only sans email/mot de passe — un down() de cette migration suppose que
    // ces comptes ont été traités (fusionnés ou supprimés) au préalable.
    await queryRunner.query(`ALTER TABLE "utilisateur" ALTER COLUMN "password_hash" SET NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "utilisateur" ALTER COLUMN "email" SET NOT NULL;`);
  }
}
