import { MetadonneesGouvernance } from './gouvernance';
import { assertCorpusTransitionAllowed, StatutCorpusWorkflow } from './corpus-workflow';

export interface CorpusVersionneProps {
  id: string;
  paysId: string;
  codeDomaine: string;
  libelleVersion: string;
  statut: StatutCorpusWorkflow;
  datePublication: Date | null;
  gouvernance: MetadonneesGouvernance;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * KER-ENG-08 : "Généralisation du programme scolaire versionné : contenu ou réglementation
 * renouvelé périodiquement." Racine porteuse d'un ensemble de `CorpusElement` — la version
 * elle-même (pas ses éléments) porte le workflow et les métadonnées de gouvernance.
 */
export class CorpusVersionne {
  private constructor(private props: CorpusVersionneProps) {}

  static create(params: {
    id: string;
    paysId: string;
    codeDomaine: string;
    libelleVersion: string;
    gouvernance: MetadonneesGouvernance;
  }): CorpusVersionne {
    const now = new Date();
    return new CorpusVersionne({
      id: params.id,
      paysId: params.paysId,
      codeDomaine: params.codeDomaine,
      libelleVersion: params.libelleVersion.trim(),
      statut: 'brouillon',
      datePublication: null,
      gouvernance: params.gouvernance,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: CorpusVersionneProps): CorpusVersionne {
    return new CorpusVersionne(props);
  }

  get id(): string {
    return this.props.id;
  }

  get paysId(): string {
    return this.props.paysId;
  }

  get codeDomaine(): string {
    return this.props.codeDomaine;
  }

  get statut(): StatutCorpusWorkflow {
    return this.props.statut;
  }

  get gouvernance(): MetadonneesGouvernance {
    return this.props.gouvernance;
  }

  updateDetails(params: Partial<Pick<CorpusVersionneProps, 'libelleVersion'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  updateGouvernance(gouvernance: MetadonneesGouvernance): void {
    this.props.gouvernance = gouvernance;
    this.props.modifieLe = new Date();
  }

  publish(): void {
    assertCorpusTransitionAllowed(this.props.statut, 'publie');
    this.props.statut = 'publie';
    this.props.datePublication = new Date();
    this.props.modifieLe = new Date();
  }

  archive(): void {
    assertCorpusTransitionAllowed(this.props.statut, 'archive');
    this.props.statut = 'archive';
    this.props.modifieLe = new Date();
  }

  toSnapshot(): Readonly<CorpusVersionneProps> {
    return { ...this.props };
  }
}
