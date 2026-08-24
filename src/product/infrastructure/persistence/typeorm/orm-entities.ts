import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'catalogue' })
export class CatalogueOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'produit_id', type: 'uuid' })
  produitId!: string;

  @Column({ type: 'varchar', length: 200 })
  nom!: string;

  @Column({ name: 'scope_type', type: 'varchar', length: 30 })
  scopeType!: string;

  @Index()
  @Column({ name: 'scope_cible_id', type: 'uuid', nullable: true })
  scopeCibleId!: string | null;

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

@Entity({ name: 'produit_catalogue' })
export class ProduitOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'catalogue_id', type: 'uuid' })
  catalogueId!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  nom!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

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

@Entity({ name: 'offre' })
export class OffreOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'produit_id', type: 'uuid' })
  produitId!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  nom!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: string;

  @Column({ name: 'periode_facturation', type: 'varchar', length: 20 })
  periodeFacturation!: string;

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

@Entity({ name: 'feature' })
export class FeatureOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  nom!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'est_actif', type: 'boolean', default: true })
  estActif!: boolean;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'offre_entitlement' })
@Index(['offreId', 'featureId'], { unique: true })
export class OffreEntitlementOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'offre_id', type: 'uuid' })
  offreId!: string;

  @Index()
  @Column({ name: 'feature_id', type: 'uuid' })
  featureId!: string;

  @Column({ type: 'int', nullable: true })
  limite!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unite!: string | null;
}

@Entity({ name: 'grille_tarifaire' })
export class GrilleTarifaireOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'offre_id', type: 'uuid' })
  offreId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Index()
  @Column({ name: 'devise_id', type: 'uuid' })
  deviseId!: string;

  // 'integer' (max ~2,147 milliards en unité mineure) plutôt que 'bigint' : évite la
  // conversion string↔number que le driver pg impose sur bigint, au prix d'un plafond
  // largement suffisant pour des montants B2B usuels. À revoir avec un mapper dédié si
  // des montants dépassant ce plafond deviennent un cas d'usage réel.
  @Column({ name: 'montant_minor_unit', type: 'integer' })
  montantMinorUnit!: number;

  @Column({ name: 'periode_facturation', type: 'varchar', length: 20 })
  periodeFacturation!: string;

  @Column({ name: 'date_effective', type: 'timestamptz' })
  dateEffective!: Date;

  @Column({ name: 'date_fin', type: 'timestamptz', nullable: true })
  dateFin!: Date | null;

  @Index()
  @Column({ name: 'statut_workflow', type: 'varchar', length: 20, default: 'brouillon' })
  statutWorkflow!: string;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;
}
