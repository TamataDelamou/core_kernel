import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Convention de nommage KER-NOM-01 : le référentiel métier partagé (pays, devise, langue,
 * bloc_regional, taux_change, ville) est nommé exclusivement en français, aligné sur le
 * Cadre de Référence Multi-Pays et l'ensemble des cahiers de conception déjà rédigés.
 */
@Entity({ name: 'pays' })
export class PaysOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'code_iso', type: 'varchar', length: 2 })
  codeIso!: string;

  @Column({ type: 'varchar', length: 150 })
  nom!: string;

  @Column({ name: 'organisme_regional_principal', type: 'varchar', length: 255, nullable: true })
  organismeRegionalPrincipal!: string | null;

  @Column({ name: 'notes_souverainete', type: 'text', nullable: true })
  notesSouverainete!: string | null;

  @Column({ name: 'adresse_gabarit', type: 'text', nullable: true })
  adresseGabarit!: string | null;

  @Column({ name: 'fuseau_horaire', type: 'varchar', length: 64, nullable: true })
  fuseauHoraire!: string | null;

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

@Entity({ name: 'devise' })
export class DeviseOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'code_iso4217', type: 'varchar', length: 3 })
  codeIso4217!: string;

  @Column({ type: 'varchar', length: 150 })
  nom!: string;

  @Column({ name: 'zone_monetaire', type: 'varchar', length: 100, nullable: true })
  zoneMonetaire!: string | null;

  @Column({ type: 'int' })
  decimales!: number;

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

@Entity({ name: 'langue' })
export class LangueOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'code_iso639', type: 'varchar', length: 3 })
  codeIso639!: string;

  @Column({ type: 'varchar', length: 150 })
  nom!: string;

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

@Entity({ name: 'bloc_regional' })
export class BlocRegionalOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  nom!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: string;

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

@Entity({ name: 'pays_devise' })
export class PaysDeviseOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'pays_id', type: 'uuid' })
  paysId!: string;

  @Index()
  @Column({ name: 'devise_id', type: 'uuid' })
  deviseId!: string;

  @Column({ name: 'date_debut', type: 'date' })
  dateDebut!: Date;

  @Column({ name: 'date_fin', type: 'date', nullable: true })
  dateFin!: Date | null;

  @Column({ name: 'devise_principale', type: 'boolean', default: false })
  devisePrincipale!: boolean;
}

@Entity({ name: 'pays_langue' })
export class PaysLangueOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'pays_id', type: 'uuid' })
  paysId!: string;

  @Index()
  @Column({ name: 'langue_id', type: 'uuid' })
  langueId!: string;

  @Column({ type: 'varchar', length: 30 })
  statut!: string;

  @Column({ type: 'int', default: 0 })
  ordre!: number;
}

@Entity({ name: 'pays_bloc_regional' })
export class PaysBlocRegionalOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'pays_id', type: 'uuid' })
  paysId!: string;

  @Index()
  @Column({ name: 'bloc_regional_id', type: 'uuid' })
  blocRegionalId!: string;

  @Column({ name: 'date_adhesion', type: 'date' })
  dateAdhesion!: Date;

  @Column({ name: 'date_retrait', type: 'date', nullable: true })
  dateRetrait!: Date | null;

  @Column({ name: 'statut_actuel', type: 'varchar', length: 20, default: 'membre' })
  statutActuel!: string;
}

@Entity({ name: 'taux_change' })
export class TauxChangeOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'devise_base_id', type: 'uuid' })
  deviseBaseId!: string;

  @Index()
  @Column({ name: 'devise_cible_id', type: 'uuid' })
  deviseCibleId!: string;

  // NUMERIC (jamais FLOAT/DOUBLE) — précision monétaire exacte, cohérent avec KER-REF-05.
  @Column({ type: 'numeric', precision: 24, scale: 10 })
  taux!: string;

  @Column({ name: 'valid_du', type: 'timestamptz' })
  validDu!: Date;

  @Column({ name: 'valid_au', type: 'timestamptz', nullable: true })
  validAu!: Date | null;

  @Column({ type: 'varchar', length: 150 })
  source!: string;
}

@Entity({ name: 'ville' })
export class VilleOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'pays_id', type: 'uuid' })
  paysId!: string;

  @Column({ type: 'varchar', length: 150 })
  nom!: string;

  @Column({ name: 'referentiel_hierarchique_id', type: 'uuid', nullable: true })
  referentielHierarchiqueId!: string | null;

  @Column({ name: 'est_actif', type: 'boolean', default: true })
  estActif!: boolean;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'locale' })
export class LocaleOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  libelle!: string;

  @Column({ name: 'est_par_defaut', type: 'boolean', default: false })
  estParDefaut!: boolean;

  @Column({ name: 'est_actif', type: 'boolean', default: true })
  estActif!: boolean;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'traduction' })
@Index(['localeId', 'cle'], { unique: true })
export class TraductionOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'locale_id', type: 'uuid' })
  localeId!: string;

  @Column({ type: 'varchar', length: 200 })
  cle!: string;

  @Column({ type: 'text' })
  valeur!: string;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}
