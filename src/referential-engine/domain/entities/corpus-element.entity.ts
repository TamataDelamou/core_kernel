export class CorpusElementParentNotInSameCorpusError extends Error {
  constructor() {
    super("Le parent d'un élément de corpus doit appartenir au MÊME corpus_versionne.");
    this.name = 'CorpusElementParentNotInSameCorpusError';
  }
}

export class CorpusElementCircularParentError extends Error {
  constructor() {
    super("Rattachement refusé : le parent désigné est un descendant de cet élément — cycle.");
    this.name = 'CorpusElementCircularParentError';
  }
}

export interface CorpusElementProps {
  id: string;
  corpusVersionneId: string;
  referentielHierarchiqueId: string;
  parentId: string | null;
  nom: string;
  valeurOuCoefficient: string | null;
  metadata: Record<string, unknown> | null;
  ordre: number;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * Hiérarchie PROPRE au corpus (chapitre → article), volontairement un simple `parentId`
 * plutôt qu'un Materialized Path — la profondeur attendue (2-3 niveaux) ne justifie pas la
 * complexité qui a un sens pour une hiérarchie administrative à N niveaux inconnus.
 */
export class CorpusElement {
  private constructor(private props: CorpusElementProps) {}

  static create(params: {
    id: string;
    corpusVersionneId: string;
    referentielHierarchiqueId: string;
    parentId?: string | null;
    nom: string;
    valeurOuCoefficient?: string | null;
    metadata?: Record<string, unknown> | null;
    ordre?: number;
  }): CorpusElement {
    const now = new Date();
    return new CorpusElement({
      id: params.id,
      corpusVersionneId: params.corpusVersionneId,
      referentielHierarchiqueId: params.referentielHierarchiqueId,
      parentId: params.parentId ?? null,
      nom: params.nom.trim(),
      valeurOuCoefficient: params.valeurOuCoefficient ?? null,
      metadata: params.metadata ?? null,
      ordre: params.ordre ?? 0,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: CorpusElementProps): CorpusElement {
    return new CorpusElement(props);
  }

  get id(): string {
    return this.props.id;
  }

  get corpusVersionneId(): string {
    return this.props.corpusVersionneId;
  }

  get parentId(): string | null {
    return this.props.parentId;
  }

  updateDetails(
    params: Partial<Pick<CorpusElementProps, 'nom' | 'valeurOuCoefficient' | 'metadata' | 'ordre'>>,
  ): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  reattachToParent(parentId: string | null): void {
    this.props.parentId = parentId;
    this.props.modifieLe = new Date();
  }

  toSnapshot(): Readonly<CorpusElementProps> {
    return { ...this.props };
  }
}

/**
 * Fonction pure — détection de cycle pour la hiérarchie propre de CorpusElement (pas de
 * Materialized Path ici, contrairement à NoeudHierarchique : profondeur attendue faible,
 * une marche d'ascendance classique sur une liste déjà chargée en mémoire suffit largement).
 * `elements` doit contenir TOUS les éléments du même corpus_versionne — l'appelant (use-case)
 * est responsable de ce chargement, cette fonction ne fait aucun accès I/O.
 */
export function wouldCreateCycleInCorpus(
  elements: readonly { id: string; parentId: string | null }[],
  elementId: string,
  candidateParentId: string,
): boolean {
  const parentIndex = new Map(elements.map((e) => [e.id, e.parentId] as const));
  let curseur: string | null = candidateParentId;
  const dejaVus = new Set<string>();

  while (curseur !== null) {
    if (curseur === elementId) return true;
    if (dejaVus.has(curseur)) return false; // boucle déjà existante ailleurs — pas notre affaire ici, on s'arrête
    dejaVus.add(curseur);
    curseur = parentIndex.get(curseur) ?? null;
  }
  return false;
}
