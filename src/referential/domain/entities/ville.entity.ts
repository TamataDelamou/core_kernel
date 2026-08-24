export interface VilleProps {
  id: string;
  paysId: string;
  nom: string;
  /**
   * Référence optionnelle vers un nœud referentiel_hierarchique (code_domaine = "administratif")
   * du GSG Referential Engine (section 8 du Cahier, service distinct non couvert par ce module).
   * Volontairement non contrainte physiquement ici — KER-VIS-03 : accès inter-services par API
   * uniquement, jamais par clé étrangère directe entre bases de données distinctes.
   */
  referentielHierarchiqueId: string | null;
  estActif: boolean;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * Entité de domaine Ville (KER-ADM-03). Reste une entité dédiée — et non un nœud générique
 * du Referential Engine — car référencée très fréquemment par les modules métier (adresses,
 * livraison, points de vente) et bénéficie d'un accès direct indexé plutôt que d'une remontée
 * d'arbre à chaque requête.
 */
export class Ville {
  private constructor(private props: VilleProps) {}

  static create(params: {
    id: string;
    paysId: string;
    nom: string;
    referentielHierarchiqueId?: string | null;
  }): Ville {
    const now = new Date();
    return new Ville({
      id: params.id,
      paysId: params.paysId,
      nom: params.nom.trim(),
      referentielHierarchiqueId: params.referentielHierarchiqueId ?? null,
      estActif: true,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: VilleProps): Ville {
    return new Ville(props);
  }

  get id(): string {
    return this.props.id;
  }

  get paysId(): string {
    return this.props.paysId;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  updateDetails(params: Partial<Pick<VilleProps, 'nom' | 'referentielHierarchiqueId'>>): void {
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

  toSnapshot(): Readonly<VilleProps> {
    return { ...this.props };
  }
}
