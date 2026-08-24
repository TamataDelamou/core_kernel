import { assertTransitionAllowed, StatutWorkflow } from './workflow';

export type TypeBlocRegional = 'economique' | 'juridique' | 'monetaire' | 'examinateur';

export interface BlocRegionalProps {
  id: string;
  code: string; // ex. CEDEAO, UEMOA, OHADA
  nom: string;
  type: TypeBlocRegional;
  estActif: boolean;
  statutWorkflow: StatutWorkflow;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * Entité de domaine BlocRegional (KER-REF-07). Le retrait effectif du Mali, du Burkina Faso
 * et du Niger de la CEDEAO le 29 janvier 2025 reste le cas d'école justifiant une période
 * d'appartenance datée (voir PaysBlocRegional) plutôt qu'un simple attribut statique sur pays.
 */
export class BlocRegional {
  private constructor(private props: BlocRegionalProps) {}

  static create(params: { id: string; code: string; nom: string; type: TypeBlocRegional }): BlocRegional {
    const now = new Date();
    return new BlocRegional({
      id: params.id,
      code: params.code.trim().toUpperCase(),
      nom: params.nom.trim(),
      type: params.type,
      estActif: true,
      statutWorkflow: 'brouillon',
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: BlocRegionalProps): BlocRegional {
    return new BlocRegional(props);
  }

  get id(): string {
    return this.props.id;
  }

  get code(): string {
    return this.props.code;
  }

  get statutWorkflow(): StatutWorkflow {
    return this.props.statutWorkflow;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  updateDetails(params: Partial<Pick<BlocRegionalProps, 'nom' | 'type'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  submitForReview(): void {
    assertTransitionAllowed(this.props.statutWorkflow, 'en_revision');
    this.props.statutWorkflow = 'en_revision';
    this.props.modifieLe = new Date();
  }

  validate(): void {
    assertTransitionAllowed(this.props.statutWorkflow, 'valide');
    this.props.statutWorkflow = 'valide';
    this.props.modifieLe = new Date();
  }

  rejectToDraft(): void {
    assertTransitionAllowed(this.props.statutWorkflow, 'brouillon');
    this.props.statutWorkflow = 'brouillon';
    this.props.modifieLe = new Date();
  }

  publish(): void {
    assertTransitionAllowed(this.props.statutWorkflow, 'publie');
    this.props.statutWorkflow = 'publie';
    this.props.modifieLe = new Date();
  }

  deactivate(): void {
    this.props.estActif = false;
    this.props.modifieLe = new Date();
  }

  toSnapshot(): Readonly<BlocRegionalProps> {
    return { ...this.props };
  }
}
