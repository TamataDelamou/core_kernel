import { assertEngineTransitionAllowed, StatutWorkflowEngine } from './workflow';

export class CrossCountryReattachmentError extends Error {
  constructor() {
    super('Un nœud ne peut être rattaché qu\'à un parent du même pays.');
    this.name = 'CrossCountryReattachmentError';
  }
}

export class CircularReattachmentError extends Error {
  constructor() {
    super(
      'Rattachement refusé : la nouvelle organisation mère est un descendant de ce nœud — ' +
        'un cycle serait créé dans l\'arbre.',
    );
    this.name = 'CircularReattachmentError';
  }
}

export class NodeHasPublishedChildrenError extends Error {
  constructor() {
    super(
      'Opération refusée : ce nœud a au moins un enfant publié et actif. Dépubliez ou ' +
        'désactivez d\'abord ses enfants (KER-ADM-04).',
    );
    this.name = 'NodeHasPublishedChildrenError';
  }
}

export interface NoeudHierarchiqueProps {
  id: string;
  paysId: string;
  codeDomaine: string;
  parentId: string | null;
  chemin: string;
  appellationLocale: string;
  rangNormalise: number;
  ordre: number;
  estNoeudTerminal: boolean;
  estActif: boolean;
  statutWorkflow: StatutWorkflowEngine;
  creeLe: Date;
  modifieLe: Date;
}

export class NoeudHierarchique {
  private constructor(private props: NoeudHierarchiqueProps) {}

  static createRoot(params: {
    id: string;
    paysId: string;
    codeDomaine: string;
    appellationLocale: string;
    ordre?: number;
    estNoeudTerminal?: boolean;
  }): NoeudHierarchique {
    const now = new Date();
    return new NoeudHierarchique({
      id: params.id,
      paysId: params.paysId,
      codeDomaine: params.codeDomaine,
      parentId: null,
      chemin: `/${params.id}/`,
      appellationLocale: params.appellationLocale.trim(),
      rangNormalise: 1,
      ordre: params.ordre ?? 0,
      estNoeudTerminal: params.estNoeudTerminal ?? false,
      estActif: true,
      statutWorkflow: 'brouillon',
      creeLe: now,
      modifieLe: now,
    });
  }

  static createChild(params: {
    id: string;
    parent: NoeudHierarchique;
    appellationLocale: string;
    ordre?: number;
    estNoeudTerminal?: boolean;
  }): NoeudHierarchique {
    const rangAttendu = params.parent.rangNormalise + 1;
    const now = new Date();

    return new NoeudHierarchique({
      id: params.id,
      paysId: params.parent.paysId,
      codeDomaine: params.parent.codeDomaine,
      parentId: params.parent.id,
      chemin: `${params.parent.chemin}${params.id}/`,
      appellationLocale: params.appellationLocale.trim(),
      rangNormalise: rangAttendu,
      ordre: params.ordre ?? 0,
      estNoeudTerminal: params.estNoeudTerminal ?? false,
      estActif: true,
      statutWorkflow: 'brouillon',
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: NoeudHierarchiqueProps): NoeudHierarchique {
    return new NoeudHierarchique(props);
  }

  get id(): string {
    return this.props.id;
  }

  get paysId(): string {
    return this.props.paysId;
  }

  get parentId(): string | null {
    return this.props.parentId;
  }

  get chemin(): string {
    return this.props.chemin;
  }

  get rangNormalise(): number {
    return this.props.rangNormalise;
  }

  get codeDomaine(): string {
    return this.props.codeDomaine;
  }

  get statutWorkflow(): StatutWorkflowEngine {
    return this.props.statutWorkflow;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  get estNoeudTerminal(): boolean {
    return this.props.estNoeudTerminal;
  }

  updateDetails(params: Partial<Pick<NoeudHierarchiqueProps, 'appellationLocale' | 'ordre'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  reattachToParent(nouveauParent: NoeudHierarchique | null): void {
    if (nouveauParent) {
      if (nouveauParent.paysId !== this.props.paysId) {
        throw new CrossCountryReattachmentError();
      }
      this.props.parentId = nouveauParent.id;
      this.props.chemin = `${nouveauParent.chemin}${this.props.id}/`;
      this.props.rangNormalise = nouveauParent.rangNormalise + 1;
    } else {
      this.props.parentId = null;
      this.props.chemin = `/${this.props.id}/`;
      this.props.rangNormalise = 1;
    }
    this.props.modifieLe = new Date();
  }

  submitForReview(): void {
    assertEngineTransitionAllowed(this.props.statutWorkflow, 'en_revision');
    this.props.statutWorkflow = 'en_revision';
    this.props.modifieLe = new Date();
  }

  validate(): void {
    assertEngineTransitionAllowed(this.props.statutWorkflow, 'valide');
    this.props.statutWorkflow = 'valide';
    this.props.modifieLe = new Date();
  }

  rejectToDraft(): void {
    assertEngineTransitionAllowed(this.props.statutWorkflow, 'brouillon');
    this.props.statutWorkflow = 'brouillon';
    this.props.modifieLe = new Date();
  }

  publish(): void {
    assertEngineTransitionAllowed(this.props.statutWorkflow, 'publie');
    this.props.statutWorkflow = 'publie';
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

  toSnapshot(): Readonly<NoeudHierarchiqueProps> {
    return { ...this.props };
  }
}

/**
 * Fonction pure — le bénéfice concret du Materialized Path : détecter un cycle de
 * réattachement par simple comparaison de chaînes, sans aucune requête récursive. Un
 * rattachement créerait un cycle si le chemin du candidat nouveau parent commence par le
 * chemin du nœud qu'on déplace (= le candidat est un descendant de ce nœud, ou lui-même).
 */
export function wouldCreateCycle(cheminNoeud: string, cheminCandidatNouveauParent: string): boolean {
  return cheminCandidatNouveauParent.startsWith(cheminNoeud);
}

/**
 * KER-ADM-04 : refuse une opération (réattachement ou désactivation) si au moins un enfant
 * DIRECT est publié et actif. Un enfant lui-même verrouillé par ses propres enfants publiés
 * aurait déjà refusé sa propre désactivation en amont — la contrainte se propage donc
 * naturellement de proche en proche, sans récursion nécessaire ici.
 */
export function assertNoPublishedChildren(enfants: readonly NoeudHierarchique[]): void {
  const aUnEnfantPublieEtActif = enfants.some(
    (enfant) => enfant.statutWorkflow === 'publie' && enfant.estActif,
  );
  if (aUnEnfantPublieEtActif) {
    throw new NodeHasPublishedChildrenError();
  }
}
