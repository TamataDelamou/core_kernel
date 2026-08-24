import { MetadonneesGouvernance } from './gouvernance';
import { assertEngineTransitionAllowed, StatutWorkflowEngine } from './workflow';

export class RegleNotAttachedToTerminalNodeError extends Error {
  constructor() {
    super(
      "Une règle ne peut être rattachée qu'à un nœud terminal (estNoeudTerminal = true) — " +
        'un nœud intermédiaire ne peut porter aucune règle directement (KER-ENG-08).',
    );
    this.name = 'RegleNotAttachedToTerminalNodeError';
  }
}

export interface ReferentielRegleProps {
  id: string;
  referentielHierarchiqueId: string;
  codeDomaine: string;
  nom: string;
  sigle: string | null;
  valeur: string;
  metadata: Record<string, unknown> | null;
  gouvernance: MetadonneesGouvernance;
  statutWorkflow: StatutWorkflowEngine;
  estActif: boolean;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * KER-ENG-08 : "Règle rattachée à un nœud terminal : examen, taux de TVA, seuil d'agrément,
 * plafond réglementaire." Suit le MÊME workflow à 4 états que NoeudHierarchique (KER-ENG-07 —
 * gouvernance structurelle), contrairement à CorpusVersionne qui a son propre cycle de
 * contenu à 3 états.
 */
export class ReferentielRegle {
  private constructor(private props: ReferentielRegleProps) {}

  static create(params: {
    id: string;
    referentielHierarchiqueId: string;
    codeDomaine: string;
    nom: string;
    sigle?: string | null;
    valeur: string;
    metadata?: Record<string, unknown> | null;
    gouvernance: MetadonneesGouvernance;
  }): ReferentielRegle {
    const now = new Date();
    return new ReferentielRegle({
      id: params.id,
      referentielHierarchiqueId: params.referentielHierarchiqueId,
      codeDomaine: params.codeDomaine,
      nom: params.nom.trim(),
      sigle: params.sigle?.trim() ?? null,
      valeur: params.valeur,
      metadata: params.metadata ?? null,
      gouvernance: params.gouvernance,
      statutWorkflow: 'brouillon',
      estActif: true,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: ReferentielRegleProps): ReferentielRegle {
    return new ReferentielRegle(props);
  }

  get id(): string {
    return this.props.id;
  }

  get referentielHierarchiqueId(): string {
    return this.props.referentielHierarchiqueId;
  }

  get statutWorkflow(): StatutWorkflowEngine {
    return this.props.statutWorkflow;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  get gouvernance(): MetadonneesGouvernance {
    return this.props.gouvernance;
  }

  updateDetails(params: Partial<Pick<ReferentielRegleProps, 'nom' | 'sigle' | 'valeur' | 'metadata'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  updateGouvernance(gouvernance: MetadonneesGouvernance): void {
    this.props.gouvernance = gouvernance;
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

  toSnapshot(): Readonly<ReferentielRegleProps> {
    return { ...this.props };
  }
}
