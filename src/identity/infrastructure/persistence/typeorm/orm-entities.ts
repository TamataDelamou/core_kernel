import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Table "utilisateur" — profil GSG ID. Le noyau du service (GSG ID) reste techniquement
 * nommé en anglais conformément à KER-NOM-03 ; les colonnes FK vers le référentiel métier
 * partagé (pays_id, unite_administrative_id, ville_id, langue_id, devise_id, fuseau_horaire)
 * sont nommées en français conformément à KER-ID-05 et KER-NOM-01.
 */
@Entity({ name: 'utilisateur' })
export class UserOrmEntity {
  @PrimaryColumn({ name: 'gsg_id', type: 'uuid' })
  gsgId!: string;

  @Index({ unique: true })
  @Column({ name: 'email', type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  @Column({ name: 'email_verifie', type: 'boolean', default: false })
  emailVerifie!: boolean;

  @Index({ unique: true })
  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ name: 'phone_verifie', type: 'boolean', default: false })
  phoneVerifie!: boolean;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'nom_affichage', type: 'varchar', length: 120 })
  nomAffichage!: string;

  @Column({ name: 'statut', type: 'varchar', length: 20, default: 'actif' })
  statut!: string;

  @Column({ name: 'mfa_active', type: 'boolean', default: false })
  mfaActive!: boolean;

  // --- Références GSG Referential (KER-ID-05) ---
  @Column({ name: 'pays_id', type: 'uuid', nullable: true })
  paysId!: string | null;

  @Column({ name: 'unite_administrative_id', type: 'uuid', nullable: true })
  uniteAdministrativeId!: string | null;

  @Column({ name: 'ville_id', type: 'uuid', nullable: true })
  villeId!: string | null;

  @Column({ name: 'langue_id', type: 'uuid', nullable: true })
  langueId!: string | null;

  @Column({ name: 'devise_id', type: 'uuid', nullable: true })
  deviseId!: string | null;

  @Column({ name: 'fuseau_horaire', type: 'varchar', length: 64, nullable: true })
  fuseauHoraire!: string | null;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;

  @Column({ name: 'dernier_auth_le', type: 'timestamptz', nullable: true })
  dernierAuthLe!: Date | null;

  @Column({ name: 'tentatives_echouees_consecutives', type: 'int', default: 0 })
  tentativesEchoueesConsecutives!: number;

  @Column({ name: 'verrouille_jusqua', type: 'timestamptz', nullable: true })
  verrouilleJusqua!: Date | null;
}

@Entity({ name: 'role' })
export class RoleOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  nom!: string;

  @Column({ type: 'text' })
  description!: string;

  @Index()
  @Column({ name: 'gsg_org_id', type: 'uuid', nullable: true })
  gsgOrgId!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions!: string[];

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;
}

@Entity({ name: 'attribution_role_utilisateur' })
@Index(['gsgId'])
export class UserRoleAssignmentOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'gsg_id', type: 'uuid' })
  gsgId!: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @Column({ name: 'gsg_org_id', type: 'uuid', nullable: true })
  gsgOrgId!: string | null;

  @Column({ name: 'assigne_par', type: 'uuid' })
  assignePar!: string;

  @Column({ name: 'assigne_le', type: 'timestamptz' })
  assigneLe!: Date;
}

@Entity({ name: 'jeton_rafraichissement' })
export class RefreshTokenOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'gsg_id', type: 'uuid' })
  gsgId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash!: string;

  @Index()
  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @Column({ name: 'emis_le', type: 'timestamptz' })
  emisLe!: Date;

  @Column({ name: 'expire_le', type: 'timestamptz' })
  expireLe!: Date;

  @Column({ name: 'consomme_le', type: 'timestamptz', nullable: true })
  consommeLe!: Date | null;

  @Column({ name: 'revoque_le', type: 'timestamptz', nullable: true })
  revoqueLe!: Date | null;

  @Column({ name: 'ip_emission', type: 'varchar', length: 45 })
  ipEmission!: string;

  @Column({ name: 'user_agent', type: 'text' })
  userAgent!: string;
}

@Entity({ name: 'facteur_mfa' })
export class MfaFactorOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'gsg_id', type: 'uuid' })
  gsgId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: string;

  @Column({ name: 'secret_chiffre', type: 'text' })
  secretChiffre!: string;

  @Column({ type: 'varchar', length: 30 })
  statut!: string;

  @Column({ name: 'codes_recuperation_hashes', type: 'jsonb', default: () => "'[]'" })
  codesRecuperationHashes!: string[];

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'active_le', type: 'timestamptz', nullable: true })
  activeLe!: Date | null;
}

@Entity({ name: 'correspondance_identite_externe' })
@Index(['produitId', 'externalUserId'], { unique: true })
export class ExternalIdentityMappingOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'gsg_id', type: 'uuid' })
  gsgId!: string;

  @Column({ name: 'produit_id', type: 'uuid' })
  produitId!: string;

  @Column({ name: 'external_user_id', type: 'varchar', length: 255 })
  externalUserId!: string;

  @Column({ name: 'lie_le', type: 'timestamptz' })
  lieLe!: Date;
}
