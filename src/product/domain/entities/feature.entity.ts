const CODE_FEATURE_REGEX = /^[a-z0-9][a-z0-9._-]{1,63}$/;

export class InvalidCodeFeatureError extends Error {
  constructor(rawValue: string) {
    super(`Code de fonctionnalité invalide : "${rawValue}" (2 à 64 caractères, minuscules/chiffres/._-).`);
    this.name = 'InvalidCodeFeatureError';
  }
}

export interface FeatureProps {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  estActif: boolean;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * Une Feature (fonctionnalité) est un concept transversal, réutilisable par plusieurs offres
 * (ex. "export-pdf", "utilisateurs-illimites") — contrairement à Offre/Produit, elle ne suit
 * pas le workflow de publication à 4 états : son cycle de vie est binaire (active/inactive),
 * cohérent avec un référentiel de capacités plutôt qu'un catalogue commercial versionné.
 */
export class Feature {
  private constructor(private props: FeatureProps) {}

  static create(params: { id: string; code: string; nom: string; description?: string | null }): Feature {
    const code = params.code.trim().toLowerCase();
    if (!CODE_FEATURE_REGEX.test(code)) {
      throw new InvalidCodeFeatureError(params.code);
    }

    const now = new Date();
    return new Feature({
      id: params.id,
      code,
      nom: params.nom.trim(),
      description: params.description ?? null,
      estActif: true,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: FeatureProps): Feature {
    return new Feature(props);
  }

  get id(): string {
    return this.props.id;
  }

  get code(): string {
    return this.props.code;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  updateDetails(params: Partial<Pick<FeatureProps, 'nom' | 'description'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  deactivate(): void {
    this.props.estActif = false;
    this.props.modifieLe = new Date();
  }

  reactivate(): void {
    this.props.estActif = true;
    this.props.modifieLe = new Date();
  }

  toSnapshot(): Readonly<FeatureProps> {
    return { ...this.props };
  }
}

export class InvalidEntitlementLimitError extends Error {
  constructor(limite: number) {
    super(`Limite d'entitlement invalide : ${limite} (doit être un entier positif, ou null pour illimité).`);
    this.name = 'InvalidEntitlementLimitError';
  }
}

export interface OffreEntitlementProps {
  id: string;
  offreId: string;
  featureId: string;
  limite: number | null; // null = illimité
  unite: string | null; // ex. "utilisateurs", "Go", "requêtes/mois" — libre, informatif
}

/**
 * Rattache une Feature à une Offre avec un quota éventuel (entitlement). Un même couple
 * (offreId, featureId) ne peut être rattaché qu'une seule fois — l'unicité est garantie par
 * une contrainte d'index en base (OffreEntitlementRepository / migration), pas par l'entité
 * elle-même qui n'a pas connaissance du reste de l'agrégat.
 */
export class OffreEntitlement {
  private constructor(private readonly props: OffreEntitlementProps) {}

  static create(params: Omit<OffreEntitlementProps, 'id'> & { id: string }): OffreEntitlement {
    if (params.limite !== null && (!Number.isInteger(params.limite) || params.limite < 0)) {
      throw new InvalidEntitlementLimitError(params.limite);
    }
    return new OffreEntitlement({ ...params });
  }

  static reconstitute(props: OffreEntitlementProps): OffreEntitlement {
    return new OffreEntitlement(props);
  }

  get id(): string {
    return this.props.id;
  }

  get offreId(): string {
    return this.props.offreId;
  }

  get featureId(): string {
    return this.props.featureId;
  }

  toSnapshot(): Readonly<OffreEntitlementProps> {
    return { ...this.props };
  }
}
