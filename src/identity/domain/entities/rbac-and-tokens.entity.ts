/**
 * RBAC granulaire (rôles et permissions) — extension du socle GSG ID demandée pour couvrir
 * la gestion des utilisateurs, rôles et permissions granulaires à l'échelle du portefeuille.
 * Les rôles sont globaux au noyau (ex. kernel.admin) ou scopés à une organisation
 * (gsg_org_id non nul) pour respecter KER-ORG-03 (une organisation reste libre de son périmètre).
 */
export interface RoleProps {
  id: string;
  code: string; // ex. 'org.owner', 'kernel.admin', 'produit.support'
  nom: string;
  description: string;
  gsgOrgId: string | null; // null = rôle global du noyau ; renseigné = rôle scopé à une organisation
  permissions: string[]; // codes de permission, ex. 'identity.user.read', 'identity.user.suspend'
  creeLe: Date;
}

export class Role {
  private constructor(private readonly props: RoleProps) {}

  static create(params: Omit<RoleProps, 'creeLe'>): Role {
    return new Role({ ...params, creeLe: new Date() });
  }

  static reconstitute(props: RoleProps): Role {
    return new Role(props);
  }

  get id(): string {
    return this.props.id;
  }

  get code(): string {
    return this.props.code;
  }

  get gsgOrgId(): string | null {
    return this.props.gsgOrgId;
  }

  get permissions(): readonly string[] {
    return this.props.permissions;
  }

  hasPermission(permissionCode: string): boolean {
    return this.props.permissions.includes(permissionCode);
  }

  toSnapshot(): Readonly<RoleProps> {
    return { ...this.props };
  }
}

/** Association utilisateur ↔ rôle, avec granularité par organisation (KER-ORG-03/04). */
export interface UserRoleAssignmentProps {
  id: string;
  gsgId: string;
  roleId: string;
  gsgOrgId: string | null;
  assignePar: string; // gsgId de l'acteur ayant réalisé l'attribution — traçabilité (KER-AUD)
  assigneLe: Date;
}

export class UserRoleAssignment {
  private constructor(private readonly props: UserRoleAssignmentProps) {}

  static create(params: Omit<UserRoleAssignmentProps, 'id' | 'assigneLe'> & { id: string }): UserRoleAssignment {
    return new UserRoleAssignment({ ...params, assigneLe: new Date() });
  }

  static reconstitute(props: UserRoleAssignmentProps): UserRoleAssignment {
    return new UserRoleAssignment(props);
  }

  toSnapshot(): Readonly<UserRoleAssignmentProps> {
    return { ...this.props };
  }
}

/**
 * Jeton de rafraîchissement (refresh token) — rotation obligatoire à chaque usage,
 * détection de rejeu (OWASP ASVS 3.3 : un refresh token déjà consommé et réutilisé
 * entraîne la révocation de toute la famille de jetons du device).
 */
export interface RefreshTokenProps {
  id: string;
  gsgId: string;
  tokenHash: string; // jamais le token en clair — seul son hash est persisté
  familyId: string; // identifiant de la lignée de rotation, pour révocation en cascade
  emisLe: Date;
  expireLe: Date;
  consommeLe: Date | null;
  revoqueLe: Date | null;
  ipEmission: string;
  userAgent: string;
}

export class RefreshTokenAlreadyUsedError extends Error {
  constructor() {
    super('Jeton de rafraîchissement déjà consommé — rejeu détecté, famille révoquée.');
    this.name = 'RefreshTokenAlreadyUsedError';
  }
}

export class RefreshTokenExpiredError extends Error {
  constructor() {
    super('Jeton de rafraîchissement expiré.');
    this.name = 'RefreshTokenExpiredError';
  }
}

export class RefreshTokenRevokedError extends Error {
  constructor() {
    super('Jeton de rafraîchissement révoqué.');
    this.name = 'RefreshTokenRevokedError';
  }
}

export class RefreshToken {
  private constructor(private props: RefreshTokenProps) {}

  static issue(params: Omit<RefreshTokenProps, 'consommeLe' | 'revoqueLe'>): RefreshToken {
    return new RefreshToken({ ...params, consommeLe: null, revoqueLe: null });
  }

  static reconstitute(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken(props);
  }

  get id(): string {
    return this.props.id;
  }

  get familyId(): string {
    return this.props.familyId;
  }

  get gsgId(): string {
    return this.props.gsgId;
  }

  /** Valide et consomme le jeton (rotation) — lève une erreur explicite selon la cause. */
  assertValidAndConsume(now: Date = new Date()): void {
    if (this.props.revoqueLe) {
      throw new RefreshTokenRevokedError();
    }
    if (this.props.consommeLe) {
      throw new RefreshTokenAlreadyUsedError();
    }
    if (this.props.expireLe <= now) {
      throw new RefreshTokenExpiredError();
    }
    this.props.consommeLe = now;
  }

  revoke(now: Date = new Date()): void {
    this.props.revoqueLe = now;
  }

  toSnapshot(): Readonly<RefreshTokenProps> {
    return { ...this.props };
  }
}

/**
 * Facteur MFA (KER-ID-04) — implémenté une seule fois au niveau du noyau,
 * réutilisé par tous les produits connectés.
 */
export type MfaFactorType = 'totp';
export type MfaFactorStatus = 'en_attente_activation' | 'actif' | 'revoque';

export interface MfaFactorProps {
  id: string;
  gsgId: string;
  type: MfaFactorType;
  secretChiffre: string; // secret TOTP chiffré au repos (jamais en clair en base)
  statut: MfaFactorStatus;
  codesRecuperationHashes: string[]; // codes de secours à usage unique, hashés
  creeLe: Date;
  activeLe: Date | null;
}

export class MfaFactor {
  private constructor(private props: MfaFactorProps) {}

  static createPending(params: {
    id: string;
    gsgId: string;
    secretChiffre: string;
    codesRecuperationHashes: string[];
  }): MfaFactor {
    return new MfaFactor({
      ...params,
      type: 'totp',
      statut: 'en_attente_activation',
      creeLe: new Date(),
      activeLe: null,
    });
  }

  static reconstitute(props: MfaFactorProps): MfaFactor {
    return new MfaFactor(props);
  }

  get id(): string {
    return this.props.id;
  }

  get secretChiffre(): string {
    return this.props.secretChiffre;
  }

  get statut(): MfaFactorStatus {
    return this.props.statut;
  }

  get codesRecuperationHashes(): readonly string[] {
    return this.props.codesRecuperationHashes;
  }

  activate(now: Date = new Date()): void {
    this.props.statut = 'actif';
    this.props.activeLe = now;
  }

  revoke(): void {
    this.props.statut = 'revoque';
  }

  consumeRecoveryCode(codeHash: string): void {
    this.props.codesRecuperationHashes = this.props.codesRecuperationHashes.filter(
      (hash) => hash !== codeHash,
    );
  }

  toSnapshot(): Readonly<MfaFactorProps> {
    return { ...this.props };
  }
}

/**
 * Table de correspondance externe (KER-ID-02) : permet à un produit déjà en production
 * d'adopter GSG ID sans supprimer ni modifier son système d'authentification existant.
 */
export interface ExternalIdentityMappingProps {
  id: string;
  gsgId: string;
  produitId: string; // référence vers le Registre central des produits (section 5)
  externalUserId: string; // identifiant utilisateur dans le système existant du produit
  lieLe: Date;
}

export class ExternalIdentityMapping {
  private constructor(private readonly props: ExternalIdentityMappingProps) {}

  static create(params: Omit<ExternalIdentityMappingProps, 'lieLe'>): ExternalIdentityMapping {
    return new ExternalIdentityMapping({ ...params, lieLe: new Date() });
  }

  static reconstitute(props: ExternalIdentityMappingProps): ExternalIdentityMapping {
    return new ExternalIdentityMapping(props);
  }

  toSnapshot(): Readonly<ExternalIdentityMappingProps> {
    return { ...this.props };
  }
}
