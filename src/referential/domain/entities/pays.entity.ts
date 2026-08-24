import { assertTransitionAllowed, StatutWorkflow } from './workflow';

const ISO_3166_1_ALPHA_2_REGEX = /^[A-Z]{2}$/;

export class InvalidCodeIsoPaysError extends Error {
  constructor(rawValue: string) {
    super(`Code ISO 3166-1 alpha-2 invalide : "${rawValue}" (attendu : 2 lettres majuscules).`);
    this.name = 'InvalidCodeIsoPaysError';
  }
}

export interface PaysProps {
  id: string;
  codeIso: string; // ISO 3166-1 alpha-2 (KER-REF-01)
  nom: string;
  organismeRegionalPrincipal: string | null;
  notesSouverainete: string | null;
  adresseGabarit: string | null; // gabarit de format d'adresse postale (KER-REF-09)
  fuseauHoraire: string | null; // IANA, ex. Africa/Conakry (KER-REF-09)
  estActif: boolean; // KER-ADM-04 — désactivation sans suppression
  statutWorkflow: StatutWorkflow; // KER-AUD-04
  creeLe: Date;
  modifieLe: Date;
}

/**
 * Entité de domaine Pays. Aucune table métier d'aucun produit GSG ne doit stocker un nom
 * de pays en texte libre (KER-REF-01) : ce référentiel est l'unique source de vérité.
 */
export class Pays {
  private constructor(private props: PaysProps) {}

  static create(params: {
    id: string;
    codeIso: string;
    nom: string;
    organismeRegionalPrincipal?: string | null;
    notesSouverainete?: string | null;
    adresseGabarit?: string | null;
    fuseauHoraire?: string | null;
  }): Pays {
    const codeIso = params.codeIso.trim().toUpperCase();
    if (!ISO_3166_1_ALPHA_2_REGEX.test(codeIso)) {
      throw new InvalidCodeIsoPaysError(params.codeIso);
    }

    const now = new Date();
    return new Pays({
      id: params.id,
      codeIso,
      nom: params.nom.trim(),
      organismeRegionalPrincipal: params.organismeRegionalPrincipal ?? null,
      notesSouverainete: params.notesSouverainete ?? null,
      adresseGabarit: params.adresseGabarit ?? null,
      fuseauHoraire: params.fuseauHoraire ?? null,
      estActif: true,
      statutWorkflow: 'brouillon',
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: PaysProps): Pays {
    return new Pays(props);
  }

  get id(): string {
    return this.props.id;
  }

  get codeIso(): string {
    return this.props.codeIso;
  }

  get statutWorkflow(): StatutWorkflow {
    return this.props.statutWorkflow;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  updateDetails(
    params: Partial<
      Pick<
        PaysProps,
        'nom' | 'organismeRegionalPrincipal' | 'notesSouverainete' | 'adresseGabarit' | 'fuseauHoraire'
      >
    >,
  ): void {
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

  reactivate(): void {
    this.props.estActif = true;
    this.props.modifieLe = new Date();
  }

  toSnapshot(): Readonly<PaysProps> {
    return { ...this.props };
  }
}
