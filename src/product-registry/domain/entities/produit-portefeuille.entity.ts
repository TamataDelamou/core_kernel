const CODE_PRODUIT_REGEX = /^[a-z0-9][a-z0-9_-]{1,49}$/;

export class InvalidCodeProduitPortefeuilleError extends Error {
  constructor(rawValue: string) {
    super(`Code produit invalide : "${rawValue}" (2 à 50 caractères, minuscules/chiffres/_-).`);
    this.name = 'InvalidCodeProduitPortefeuilleError';
  }
}

export class InvalidBriqueError extends Error {
  constructor(brique: string) {
    super(
      `Brique du noyau inconnue : "${brique}" (valeurs autorisées : ${BRIQUES_NOYAU_VALIDES.join(', ')}).`,
    );
    this.name = 'InvalidBriqueError';
  }
}

/**
 * KER-PROD-04 : chaque produit du registre déclare les briques du noyau qu'il consomme
 * effectivement, afin que l'impact d'une évolution du noyau soit mesurable produit par
 * produit plutôt qu'estimé. Liste fermée, alignée sur les modules réellement livrés du Kernel.
 */
export const BRIQUES_NOYAU_VALIDES = [
  'gsg_id',
  'org_registry',
  'gsg_referential',
  'referential_engine',
  'event_bus',
  'audit',
  'billing',
  'design_system',
] as const;

export type BriqueNoyau = (typeof BRIQUES_NOYAU_VALIDES)[number];

export interface ProduitPortefeuilleProps {
  id: string;
  /** Slug unique — ex. "ecclesias360", "edureussite", "assoshop". */
  code: string;
  nom: string;
  briquesConsommees: BriqueNoyau[];
  estActif: boolean;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * KER-PROD-01 : "Le registre des produits GSG (table produit : id, code, nom) est la source
 * unique de la liste des produits du portefeuille ; toute mention du portefeuille... s'y
 * réfère plutôt que de répéter une liste en texte libre." C'est CETTE entité qui remplace
 * définitivement les `produitId` UUID libres jusqu'ici non vérifiés dans Product Catalog et
 * Org Registry.
 */
export class ProduitPortefeuille {
  private constructor(private props: ProduitPortefeuilleProps) {}

  static create(params: {
    id: string;
    code: string;
    nom: string;
    briquesConsommees?: BriqueNoyau[];
  }): ProduitPortefeuille {
    const code = params.code.trim().toLowerCase();
    if (!CODE_PRODUIT_REGEX.test(code)) {
      throw new InvalidCodeProduitPortefeuilleError(params.code);
    }

    const briquesConsommees = params.briquesConsommees ?? [];
    for (const brique of briquesConsommees) {
      if (!BRIQUES_NOYAU_VALIDES.includes(brique)) {
        throw new InvalidBriqueError(brique);
      }
    }

    const now = new Date();
    return new ProduitPortefeuille({
      id: params.id,
      code,
      nom: params.nom.trim(),
      briquesConsommees: [...new Set(briquesConsommees)],
      estActif: true,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: ProduitPortefeuilleProps): ProduitPortefeuille {
    return new ProduitPortefeuille(props);
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

  updateDetails(params: Partial<Pick<ProduitPortefeuilleProps, 'nom'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  declareBriquesConsommees(briques: BriqueNoyau[]): void {
    for (const brique of briques) {
      if (!BRIQUES_NOYAU_VALIDES.includes(brique)) {
        throw new InvalidBriqueError(brique);
      }
    }
    this.props.briquesConsommees = [...new Set(briques)];
    this.props.modifieLe = new Date();
  }

  deactivate(): void {
    this.props.estActif = false;
    this.props.modifieLe = new Date();
  }

  reactivate(): void {
    this.props.estActif = true;
    this.props.modifieLe = new Date();
  }

  toSnapshot(): Readonly<ProduitPortefeuilleProps> {
    return { ...this.props };
  }
}
