export class InvalidRangError extends Error {
  constructor(rang: number) {
    super(`Rang de niveau administratif invalide : ${rang} (doit être un entier ≥ 1).`);
    this.name = 'InvalidRangError';
  }
}

export interface NiveauAdministratifProps {
  id: string;
  /** Référence GSG Referential — jamais de clé étrangère physique (KER-VIS-03). */
  paysId: string;
  /** Profondeur dans la hiérarchie POUR CE PAYS — 1 = niveau racine, 2 = son enfant direct, etc. */
  rang: number;
  /** Libellé local de ce niveau — "Région", "Préfecture", "District", "Comté"... */
  nom: string;
  estActif: boolean;
  creeLe: Date;
}

/**
 * KER-ADM-01 : absorbe la diversité des découpages administratifs (Région → Préfecture →
 * Sous-préfecture vs District → Comté) sans jamais nécessiter de modification de schéma —
 * chaque pays définit librement sa propre séquence de niveaux nommés. `NoeudHierarchique`
 * référence cette définition via `rangNormalise`, jamais un nom de niveau codé en dur.
 */
export class NiveauAdministratif {
  private constructor(private props: NiveauAdministratifProps) {}

  static create(params: { id: string; paysId: string; rang: number; nom: string }): NiveauAdministratif {
    if (!Number.isInteger(params.rang) || params.rang < 1) {
      throw new InvalidRangError(params.rang);
    }

    return new NiveauAdministratif({
      id: params.id,
      paysId: params.paysId,
      rang: params.rang,
      nom: params.nom.trim(),
      estActif: true,
      creeLe: new Date(),
    });
  }

  static reconstitute(props: NiveauAdministratifProps): NiveauAdministratif {
    return new NiveauAdministratif(props);
  }

  get id(): string {
    return this.props.id;
  }

  get paysId(): string {
    return this.props.paysId;
  }

  get rang(): number {
    return this.props.rang;
  }

  get nom(): string {
    return this.props.nom;
  }

  updateNom(nom: string): void {
    this.props.nom = nom.trim();
  }

  deactivate(): void {
    this.props.estActif = false;
  }

  reactivate(): void {
    this.props.estActif = true;
  }

  toSnapshot(): Readonly<NiveauAdministratifProps> {
    return { ...this.props };
  }
}
