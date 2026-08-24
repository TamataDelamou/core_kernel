import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * KER-ENG-08 : complète le méta-modèle générique au-delà de la seule hiérarchie
 * administrative (`noeud_hierarchique`, déjà en place). Les FK physiques vers
 * `noeud_hierarchique`/`corpus_versionne` restent INTERNES au Referential Engine — elles ne
 * violent pas KER-VIS-03, qui s'applique aux frontières INTER-modules, pas à l'intérieur d'un
 * même service.
 */
export class InitReferentielRegleAndCorpusSchema1756915200000 implements MigrationInterface {
  name = 'InitReferentielRegleAndCorpusSchema1756915200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "referentiel_regle" (
        "id" uuid NOT NULL,
        "referentiel_hierarchique_id" uuid NOT NULL,
        "code_domaine" varchar(50) NOT NULL,
        "nom" varchar(200) NOT NULL,
        "sigle" varchar(50),
        "valeur" varchar(500) NOT NULL,
        "metadata" jsonb,
        "organisme_certificateur" varchar(200) NOT NULL,
        "statut_confiance" varchar(20) NOT NULL,
        "source" varchar(500) NOT NULL,
        "date_derniere_verification" timestamptz NOT NULL,
        "statut_workflow" varchar(20) NOT NULL DEFAULT 'brouillon',
        "est_actif" boolean NOT NULL DEFAULT true,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referentiel_regle" PRIMARY KEY ("id"),
        CONSTRAINT "FK_referentiel_regle_noeud" FOREIGN KEY ("referentiel_hierarchique_id")
          REFERENCES "noeud_hierarchique" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CK_referentiel_regle_statut_confiance" CHECK
          ("statut_confiance" IN ('ELEVE', 'MOYEN', 'A_VERIFIER')),
        CONSTRAINT "CK_referentiel_regle_statut_workflow" CHECK
          ("statut_workflow" IN ('brouillon', 'en_revision', 'valide', 'publie'))
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_referentiel_regle_noeud" ON "referentiel_regle" ("referentiel_hierarchique_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_referentiel_regle_code_domaine" ON "referentiel_regle" ("code_domaine");`);
    await queryRunner.query(`CREATE INDEX "IDX_referentiel_regle_statut_confiance" ON "referentiel_regle" ("statut_confiance");`);
    await queryRunner.query(`CREATE INDEX "IDX_referentiel_regle_statut_workflow" ON "referentiel_regle" ("statut_workflow");`);
    await queryRunner.query(
      `CREATE INDEX "IDX_referentiel_regle_lookup" ON "referentiel_regle" ("referentiel_hierarchique_id", "statut_workflow", "est_actif", "statut_confiance");`,
    );

    await queryRunner.query(`
      CREATE TABLE "corpus_versionne" (
        "id" uuid NOT NULL,
        "pays_id" uuid NOT NULL,
        "code_domaine" varchar(50) NOT NULL,
        "libelle_version" varchar(200) NOT NULL,
        "statut" varchar(20) NOT NULL DEFAULT 'brouillon',
        "date_publication" timestamptz,
        "organisme_certificateur" varchar(200) NOT NULL,
        "statut_confiance" varchar(20) NOT NULL,
        "source" varchar(500) NOT NULL,
        "date_derniere_verification" timestamptz NOT NULL,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_corpus_versionne" PRIMARY KEY ("id"),
        CONSTRAINT "CK_corpus_versionne_statut_confiance" CHECK
          ("statut_confiance" IN ('ELEVE', 'MOYEN', 'A_VERIFIER')),
        CONSTRAINT "CK_corpus_versionne_statut" CHECK
          ("statut" IN ('brouillon', 'publie', 'archive'))
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_corpus_versionne_pays_id" ON "corpus_versionne" ("pays_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_corpus_versionne_code_domaine" ON "corpus_versionne" ("code_domaine");`);
    await queryRunner.query(`CREATE INDEX "IDX_corpus_versionne_statut" ON "corpus_versionne" ("statut");`);
    await queryRunner.query(
      `CREATE INDEX "IDX_corpus_versionne_lookup" ON "corpus_versionne" ("pays_id", "code_domaine", "statut");`,
    );

    await queryRunner.query(`
      CREATE TABLE "corpus_element" (
        "id" uuid NOT NULL,
        "corpus_versionne_id" uuid NOT NULL,
        "referentiel_hierarchique_id" uuid NOT NULL,
        "parent_id" uuid,
        "nom" varchar(200) NOT NULL,
        "valeur_ou_coefficient" varchar(200),
        "metadata" jsonb,
        "ordre" int NOT NULL DEFAULT 0,
        "cree_le" timestamptz NOT NULL DEFAULT now(),
        "modifie_le" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_corpus_element" PRIMARY KEY ("id"),
        CONSTRAINT "FK_corpus_element_corpus" FOREIGN KEY ("corpus_versionne_id")
          REFERENCES "corpus_versionne" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_corpus_element_noeud" FOREIGN KEY ("referentiel_hierarchique_id")
          REFERENCES "noeud_hierarchique" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_corpus_element_parent" FOREIGN KEY ("parent_id")
          REFERENCES "corpus_element" ("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_corpus_element_corpus_versionne_id" ON "corpus_element" ("corpus_versionne_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_corpus_element_referentiel_hierarchique_id" ON "corpus_element" ("referentiel_hierarchique_id");`);
    await queryRunner.query(`CREATE INDEX "IDX_corpus_element_parent_id" ON "corpus_element" ("parent_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "corpus_element";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "corpus_versionne";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "referentiel_regle";`);
  }
}
