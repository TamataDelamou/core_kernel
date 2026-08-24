import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'organisation' })
export class OrganisationOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string; // gsg_org_id

  @Column({ type: 'varchar', length: 200 })
  nom!: string;

  @Index()
  @Column({ name: 'organisation_mere_id', type: 'uuid', nullable: true })
  organisationMereId!: string | null;

  // --- Référentiel propre à cette organisation (KER-ORG-04) ---
  @Column({ name: 'pays_id', type: 'uuid', nullable: true })
  paysId!: string | null;

  @Column({ name: 'unite_administrative_id', type: 'uuid', nullable: true })
  uniteAdministrativeId!: string | null;

  @Column({ name: 'ville_id', type: 'uuid', nullable: true })
  villeId!: string | null;

  @Column({ name: 'devise_id', type: 'uuid', nullable: true })
  deviseId!: string | null;

  @Column({ name: 'langue_id', type: 'uuid', nullable: true })
  langueId!: string | null;

  @Column({ name: 'fuseau_horaire', type: 'varchar', length: 64, nullable: true })
  fuseauHoraire!: string | null;

  @Column({ name: 'est_actif', type: 'boolean', default: true })
  estActif!: boolean;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'unite_operationnelle' })
export class UniteOperationnelleOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId!: string;

  @Column({ type: 'varchar', length: 200 })
  nom!: string;

  @Column({ name: 'pays_id', type: 'uuid', nullable: true })
  paysId!: string | null;

  @Column({ name: 'unite_administrative_id', type: 'uuid', nullable: true })
  uniteAdministrativeId!: string | null;

  @Column({ name: 'ville_id', type: 'uuid', nullable: true })
  villeId!: string | null;

  @Column({ name: 'devise_id', type: 'uuid', nullable: true })
  deviseId!: string | null;

  @Column({ name: 'langue_id', type: 'uuid', nullable: true })
  langueId!: string | null;

  @Column({ name: 'fuseau_horaire', type: 'varchar', length: 64, nullable: true })
  fuseauHoraire!: string | null;

  @Column({ name: 'est_actif', type: 'boolean', default: true })
  estActif!: boolean;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'abonnement_produit' })
export class AbonnementProduitOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'organisation_id', type: 'uuid' })
  organisationId!: string;

  @Index()
  @Column({ name: 'produit_id', type: 'uuid' })
  produitId!: string;

  @Column({ type: 'varchar', length: 20, default: 'actif' })
  statut!: string;

  @Column({ name: 'date_debut', type: 'date' })
  dateDebut!: Date;

  @Column({ name: 'date_fin', type: 'date', nullable: true })
  dateFin!: Date | null;
}
