import { assertCatalogTransitionAllowed, StatutCatalogWorkflow } from './catalog-workflow';

export class InvalidMontantError extends Error {
  constructor(montantMinorUnit: number) {
    super(
      `Montant invalide : ${montantMinorUnit} (doit être un entier positif ou nul, exprimé en ` +
        "unité mineure de la devise — jamais un nombre à virgule flottante, cohérent avec KER-REF-05).",
    );
    this.name = 'InvalidMontantError';
  }
}

export class InvalidVersionError extends Error {
  constructor(version: number) {
    super(`Numéro de version invalide : ${version} (doit être un entier strictement positif).`);
    this.name = 'InvalidVersionError';
  }
}

export class InvalidValidityWindowError extends Error {
  constructor() {
    super('dateFin doit être strictement postérieure à dateEffective pour une grille tarifaire.');
    this.name = 'InvalidValidityWindowError';
  }
}

export interface GrilleTarifaireProps {
  id: string;
  offreId: string;
  version: number; // incrémenté à chaque nouvelle grille pour la même offre (KER-PRD — versions de grilles)
  deviseId: string; // référence GSG Referential — la certification est vérifiée en application, via CurrencyValidationPort
  montantMinorUnit: number; // KER-REF-05 : entier en unité mineure, jamais de virgule flottante
  periodeFacturation: string; // aligné sur Offre.periodeFacturation, dupliqué ici pour figer la grille même si l'offre change
  dateEffective: Date;
  dateFin: Date | null; // null = en vigueur jusqu'à nouvel ordre / remplacement
  statutWorkflow: StatutCatalogWorkflow;
  creeLe: Date;
}

/**
 * Entité de domaine GrilleTarifaire. Représente UNE version datée d'un tarif pour une offre
 * donnée. KER-PRD impose deux invariants critiques :
 *  1. Le montant est toujours un entier en unité mineure (jamais de virgule flottante) —
 *     vérifié à la construction, cohérent avec la discipline monétaire déjà posée par
 *     KER-REF-05 pour l'ensemble du portefeuille GSG.
 *  2. Deux grilles PUBLIÉES pour la même offre et la même devise ne peuvent jamais avoir de
 *     fenêtres de validité qui se chevauchent — sans quoi le prix appliqué à un instant donné
 *     serait ambigu. Cette règle est portée par la fonction pure `rangesOverlap` (testable
 *     isolément) et appliquée par `assertNoOverlapWithExisting`, invoquée par le use-case
 *     applicatif qui a accès au repository (l'entité elle-même ne connaît pas ses pairs).
 */
export class GrilleTarifaire {
  private constructor(private props: GrilleTarifaireProps) {}

  static create(params: {
    id: string;
    offreId: string;
    version: number;
    deviseId: string;
    montantMinorUnit: number;
    periodeFacturation: string;
    dateEffective: Date;
    dateFin?: Date | null;
  }): GrilleTarifaire {
    if (!Number.isInteger(params.montantMinorUnit) || params.montantMinorUnit < 0) {
      throw new InvalidMontantError(params.montantMinorUnit);
    }
    if (!Number.isInteger(params.version) || params.version < 1) {
      throw new InvalidVersionError(params.version);
    }
    if (params.dateFin && params.dateFin <= params.dateEffective) {
      throw new InvalidValidityWindowError();
    }

    const now = new Date();
    return new GrilleTarifaire({
      id: params.id,
      offreId: params.offreId,
      version: params.version,
      deviseId: params.deviseId,
      montantMinorUnit: params.montantMinorUnit,
      periodeFacturation: params.periodeFacturation,
      dateEffective: params.dateEffective,
      dateFin: params.dateFin ?? null,
      statutWorkflow: 'brouillon',
      creeLe: now,
    });
  }

  static reconstitute(props: GrilleTarifaireProps): GrilleTarifaire {
    return new GrilleTarifaire(props);
  }

  get id(): string {
    return this.props.id;
  }

  get offreId(): string {
    return this.props.offreId;
  }

  get deviseId(): string {
    return this.props.deviseId;
  }

  get version(): number {
    return this.props.version;
  }

  get dateEffective(): Date {
    return this.props.dateEffective;
  }

  get dateFin(): Date | null {
    return this.props.dateFin;
  }

  get montantMinorUnit(): number {
    return this.props.montantMinorUnit;
  }

  get statutWorkflow(): StatutCatalogWorkflow {
    return this.props.statutWorkflow;
  }

  /** Vrai si la grille s'applique à l'instant donné (bornes : début inclus, fin exclue). */
  isEffectiveAt(instant: Date): boolean {
    const apresDebut = this.props.dateEffective <= instant;
    const avantFin = this.props.dateFin === null || instant < this.props.dateFin;
    return apresDebut && avantFin;
  }

  validate(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'valide');
    this.props.statutWorkflow = 'valide';
  }

  rejectToDraft(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'brouillon');
    this.props.statutWorkflow = 'brouillon';
  }

  publish(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'publie');
    this.props.statutWorkflow = 'publie';
  }

  archive(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'archive');
    this.props.statutWorkflow = 'archive';
  }

  toSnapshot(): Readonly<GrilleTarifaireProps> {
    return { ...this.props };
  }
}

/**
 * Fonction pure : deux fenêtres [debut, fin) se chevauchent-elles ? `fin = null` signifie
 * "sans fin déterminée". Bornes de début inclusives, bornes de fin exclusives — deux grilles
 * dont l'une se termine exactement quand l'autre commence NE se chevauchent PAS (succession
 * propre, cas d'usage normal d'un remplacement de tarif).
 */
export function rangesOverlap(
  debutA: Date,
  finA: Date | null,
  debutB: Date,
  finB: Date | null,
): boolean {
  const aCommenceAvantFinB = finB === null || debutA < finB;
  const bCommenceAvantFinA = finA === null || debutB < finA;
  return aCommenceAvantFinB && bCommenceAvantFinA;
}

/**
 * KER-PRD — règle d'incompatibilité de grilles tarifaires : refuse la création/publication
 * d'une grille dont la fenêtre de validité chevauche une grille existante PUBLIÉE pour la
 * même offre et la même devise. Les grilles en brouillon/validées (non encore publiées) ne
 * sont pas prises en compte : seul un chevauchement de tarifs réellement APPLICABLES est une
 * ambiguïté métier.
 */
export class OverlappingPricingGridError extends Error {
  constructor(offreId: string, deviseId: string) {
    super(
      `Une grille tarifaire publiée existe déjà pour l'offre "${offreId}" en devise "${deviseId}" ` +
        'sur une période qui chevauche celle demandée — ambiguïté de prix refusée (KER-PRD).',
    );
    this.name = 'OverlappingPricingGridError';
  }
}

export function assertNoOverlapWithExisting(
  candidate: GrilleTarifaire,
  grillesExistantesPubliees: readonly GrilleTarifaire[],
): void {
  for (const existante of grillesExistantesPubliees) {
    if (existante.id === candidate.id) continue; // republication de la même grille : jamais un conflit avec elle-même
    if (existante.deviseId !== candidate.deviseId) continue;

    const seChevauchent = rangesOverlap(
      candidate.dateEffective,
      candidate.dateFin,
      existante.dateEffective,
      existante.dateFin,
    );
    if (seChevauchent) {
      throw new OverlappingPricingGridError(candidate.offreId, candidate.deviseId);
    }
  }
}
