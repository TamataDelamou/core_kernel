import { assertCatalogTransitionAllowed, StatutCatalogWorkflow } from './catalog-workflow';

export type TypeOffre = 'abonnement' | 'usage' | 'ponctuel';
export type PeriodeFacturation = 'mensuelle' | 'annuelle' | 'unique';

export class IncompatibleBillingPeriodError extends Error {
  constructor(type: TypeOffre, periode: PeriodeFacturation) {
    super(
      `Période de facturation "${periode}" incompatible avec le type d'offre "${type}" : ` +
        'une offre "ponctuel" ne peut être facturée qu\'en "unique", et une offre "abonnement" ' +
        'ou "usage" ne peut jamais être facturée en "unique".',
    );
    this.name = 'IncompatibleBillingPeriodError';
  }
}

/**
 * KER-PRD — invariant de compatibilité type d'offre / période de facturation, vérifié à
 * la construction : une offre ponctuelle (achat one-time) n'a pas de notion de récurrence,
 * et inversement un abonnement ou une offre à l'usage n'a pas de sens en paiement "unique".
 */
function assertBillingPeriodCompatible(type: TypeOffre, periode: PeriodeFacturation): void {
  const estPonctuelle = type === 'ponctuel';
  const periodeEstUnique = periode === 'unique';
  if (estPonctuelle !== periodeEstUnique) {
    throw new IncompatibleBillingPeriodError(type, periode);
  }
}

export interface OffreProps {
  id: string;
  produitId: string;
  code: string;
  nom: string;
  type: TypeOffre;
  periodeFacturation: PeriodeFacturation;
  estActif: boolean;
  statutWorkflow: StatutCatalogWorkflow;
  creeLe: Date;
  modifieLe: Date;
}

export class Offre {
  private constructor(private props: OffreProps) {}

  static create(params: {
    id: string;
    produitId: string;
    code: string;
    nom: string;
    type: TypeOffre;
    periodeFacturation: PeriodeFacturation;
  }): Offre {
    assertBillingPeriodCompatible(params.type, params.periodeFacturation);

    const now = new Date();
    return new Offre({
      id: params.id,
      produitId: params.produitId,
      code: params.code.trim().toLowerCase(),
      nom: params.nom.trim(),
      type: params.type,
      periodeFacturation: params.periodeFacturation,
      estActif: true,
      statutWorkflow: 'brouillon',
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: OffreProps): Offre {
    return new Offre(props);
  }

  get id(): string {
    return this.props.id;
  }

  get produitId(): string {
    return this.props.produitId;
  }

  get type(): TypeOffre {
    return this.props.type;
  }

  get statutWorkflow(): StatutCatalogWorkflow {
    return this.props.statutWorkflow;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  updateDetails(params: Partial<Pick<OffreProps, 'nom'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  validate(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'valide');
    this.props.statutWorkflow = 'valide';
    this.props.modifieLe = new Date();
  }

  rejectToDraft(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'brouillon');
    this.props.statutWorkflow = 'brouillon';
    this.props.modifieLe = new Date();
  }

  publish(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'publie');
    this.props.statutWorkflow = 'publie';
    this.props.modifieLe = new Date();
  }

  archive(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'archive');
    this.props.statutWorkflow = 'archive';
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

  toSnapshot(): Readonly<OffreProps> {
    return { ...this.props };
  }
}
