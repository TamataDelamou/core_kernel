import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'niveau_administratif' })
export class NiveauAdministratifOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'pays_id', type: 'uuid' })
  paysId!: string;

  @Column({ type: 'int' })
  rang!: number;

  @Column({ type: 'varchar', length: 100 })
  nom!: string;

  @Column({ name: 'est_actif', type: 'boolean', default: true })
  estActif!: boolean;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;
}

@Entity({ name: 'noeud_hierarchique' })
export class NoeudHierarchiqueOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'pays_id', type: 'uuid' })
  paysId!: string;

  @Index()
  @Column({ name: 'code_domaine', type: 'varchar', length: 50 })
  codeDomaine!: string;

  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  // Materialized Path — indexé pour accélérer `chemin LIKE :prefix || '%'` (recherche de
  // descendants). Un index B-tree standard sert déjà bien ce type de préfixe ; un index
  // spécialisé (ex. text_pattern_ops) resterait une optimisation ultérieure si le volume
  // de nœuds par pays devenait significativement plus grand qu'une hiérarchie administrative.
  @Index()
  @Column({ type: 'varchar', length: 2000 })
  chemin!: string;

  @Column({ name: 'appellation_locale', type: 'varchar', length: 200 })
  appellationLocale!: string;

  @Column({ name: 'rang_normalise', type: 'int' })
  rangNormalise!: number;

  @Column({ type: 'int', default: 0 })
  ordre!: number;

  @Column({ name: 'est_noeud_terminal', type: 'boolean', default: false })
  estNoeudTerminal!: boolean;

  @Column({ name: 'est_actif', type: 'boolean', default: true })
  estActif!: boolean;

  @Index()
  @Column({ name: 'statut_workflow', type: 'varchar', length: 20, default: 'brouillon' })
  statutWorkflow!: string;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'referentiel_regle' })
export class ReferentielRegleOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'referentiel_hierarchique_id', type: 'uuid' })
  referentielHierarchiqueId!: string;

  @Index()
  @Column({ name: 'code_domaine', type: 'varchar', length: 50 })
  codeDomaine!: string;

  @Column({ type: 'varchar', length: 200 })
  nom!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sigle!: string | null;

  @Column({ type: 'varchar', length: 500 })
  valeur!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'organisme_certificateur', type: 'varchar', length: 200 })
  organismeCertificateur!: string;

  @Index()
  @Column({ name: 'statut_confiance', type: 'varchar', length: 20 })
  statutConfiance!: string;

  @Column({ type: 'varchar', length: 500 })
  source!: string;

  @Column({ name: 'date_derniere_verification', type: 'timestamptz' })
  dateDerniereVerification!: Date;

  @Index()
  @Column({ name: 'statut_workflow', type: 'varchar', length: 20, default: 'brouillon' })
  statutWorkflow!: string;

  @Column({ name: 'est_actif', type: 'boolean', default: true })
  estActif!: boolean;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'corpus_versionne' })
export class CorpusVersionneOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'pays_id', type: 'uuid' })
  paysId!: string;

  @Index()
  @Column({ name: 'code_domaine', type: 'varchar', length: 50 })
  codeDomaine!: string;

  @Column({ name: 'libelle_version', type: 'varchar', length: 200 })
  libelleVersion!: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'brouillon' })
  statut!: string;

  @Column({ name: 'date_publication', type: 'timestamptz', nullable: true })
  datePublication!: Date | null;

  @Column({ name: 'organisme_certificateur', type: 'varchar', length: 200 })
  organismeCertificateur!: string;

  @Column({ name: 'statut_confiance', type: 'varchar', length: 20 })
  statutConfiance!: string;

  @Column({ type: 'varchar', length: 500 })
  source!: string;

  @Column({ name: 'date_derniere_verification', type: 'timestamptz' })
  dateDerniereVerification!: Date;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'corpus_element' })
export class CorpusElementOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'corpus_versionne_id', type: 'uuid' })
  corpusVersionneId!: string;

  @Index()
  @Column({ name: 'referentiel_hierarchique_id', type: 'uuid' })
  referentielHierarchiqueId!: string;

  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 200 })
  nom!: string;

  @Column({ name: 'valeur_ou_coefficient', type: 'varchar', length: 200, nullable: true })
  valeurOuCoefficient!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  ordre!: number;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'compteur_villes_rattachees' })
export class CompteurVillesRattacheesOrmEntity {
  /** L'id du nœud LUI-MÊME sert de clé primaire — une ligne par nœud, jamais plus. */
  @PrimaryColumn({ name: 'noeud_id', type: 'uuid' })
  noeudId!: string;

  @Column({ name: 'nombre_villes', type: 'int', default: 0 })
  nombreVilles!: number;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}
