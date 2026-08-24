export type StatutDeploiement = 'lance' | 'en_test' | 'planifie' | 'non_prioritaire';

export interface ProduitPaysDeploiementProps {
  id: string;
  produitId: string;
  /** Référence GSG Referential — jamais de clé étrangère physique (KER-VIS-03). */
  paysId: string;
  statut: StatutDeploiement;
  phase: string;
  dateStatut: Date;
}

/**
 * KER-PROD-02 : "La table produit_pays_deploiement... porte la trajectoire de déploiement
 * propre à chaque produit, pays par pays ; ce statut n'est jamais un attribut du pays
 * lui-même." Une seule ligne par (produitId, paysId) — changer de statut MET À JOUR la ligne
 * existante, ne la duplique jamais (contrairement à KER-REF-03/04 où l'historisation datée
 * est explicitement demandée ; ici, seule la trajectoire ACTUELLE est un besoin exprimé).
 */
export class ProduitPaysDeploiement {
  private constructor(private props: ProduitPaysDeploiementProps) {}

  static create(params: {
    id: string;
    produitId: string;
    paysId: string;
    statut: StatutDeploiement;
    phase: string;
  }): ProduitPaysDeploiement {
    return new ProduitPaysDeploiement({
      id: params.id,
      produitId: params.produitId,
      paysId: params.paysId,
      statut: params.statut,
      phase: params.phase.trim(),
      dateStatut: new Date(),
    });
  }

  static reconstitute(props: ProduitPaysDeploiementProps): ProduitPaysDeploiement {
    return new ProduitPaysDeploiement(props);
  }

  get id(): string {
    return this.props.id;
  }

  get produitId(): string {
    return this.props.produitId;
  }

  get paysId(): string {
    return this.props.paysId;
  }

  get statut(): StatutDeploiement {
    return this.props.statut;
  }

  changerStatut(statut: StatutDeploiement, phase: string): void {
    this.props.statut = statut;
    this.props.phase = phase.trim();
    this.props.dateStatut = new Date();
  }

  toSnapshot(): Readonly<ProduitPaysDeploiementProps> {
    return { ...this.props };
  }
}
