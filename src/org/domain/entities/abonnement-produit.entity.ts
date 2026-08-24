export type StatutAbonnement = 'actif' | 'suspendu' | 'resilie';

export class InvalidAbonnementTransitionError extends Error {
  constructor(from: StatutAbonnement, to: StatutAbonnement) {
    super(`Transition d'abonnement invalide : "${from}" → "${to}".`);
    this.name = 'InvalidAbonnementTransitionError';
  }
}

export interface AbonnementProduitProps {
  id: string;
  organisationId: string;
  produitId: string; // référence vers le Registre central des produits (section 5, service distinct)
  statut: StatutAbonnement;
  dateDebut: Date;
  dateFin: Date | null;
}

/**
 * KER-ORG-03 : une organisation peut être abonnée à un sous-ensemble quelconque des
 * produits GSG ; le registre central ne doit jamais imposer qu'une organisation utilise
 * l'intégralité du portefeuille. Cette entité est la seule source de vérité pour "quels
 * produits une organisation consomme effectivement".
 */
export class AbonnementProduit {
  private constructor(private props: AbonnementProduitProps) {}

  static create(params: {
    id: string;
    organisationId: string;
    produitId: string;
    dateDebut: Date;
  }): AbonnementProduit {
    return new AbonnementProduit({
      ...params,
      statut: 'actif',
      dateFin: null,
    });
  }

  static reconstitute(props: AbonnementProduitProps): AbonnementProduit {
    return new AbonnementProduit(props);
  }

  get id(): string {
    return this.props.id;
  }

  get statut(): StatutAbonnement {
    return this.props.statut;
  }

  get organisationId(): string {
    return this.props.organisationId;
  }

  get produitId(): string {
    return this.props.produitId;
  }

  suspend(): void {
    if (this.props.statut !== 'actif') {
      throw new InvalidAbonnementTransitionError(this.props.statut, 'suspendu');
    }
    this.props.statut = 'suspendu';
  }

  reactivate(): void {
    if (this.props.statut !== 'suspendu') {
      throw new InvalidAbonnementTransitionError(this.props.statut, 'actif');
    }
    this.props.statut = 'actif';
  }

  resiliate(dateFin: Date): void {
    if (this.props.statut === 'resilie') {
      throw new InvalidAbonnementTransitionError(this.props.statut, 'resilie');
    }
    this.props.statut = 'resilie';
    this.props.dateFin = dateFin;
  }

  isActive(): boolean {
    return this.props.statut === 'actif';
  }

  toSnapshot(): Readonly<AbonnementProduitProps> {
    return { ...this.props };
  }
}
