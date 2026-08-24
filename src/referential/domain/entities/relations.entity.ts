import { StatutPaysLangue } from './devise-et-langue.entity';

/** KER-REF-03 : relation many-to-many datée entre pays et devise (zones UEMOA/XOF, CEMAC/XAF). */
export interface PaysDeviseProps {
  id: string;
  paysId: string;
  deviseId: string;
  dateDebut: Date;
  dateFin: Date | null; // null = circulation en cours
  devisePrincipale: boolean;
}

export class PaysDevise {
  private constructor(private props: PaysDeviseProps) {}

  static create(params: Omit<PaysDeviseProps, 'id'> & { id: string }): PaysDevise {
    if (params.dateFin && params.dateFin <= params.dateDebut) {
      throw new Error('date_fin doit être postérieure à date_debut pour une relation pays_devise.');
    }
    return new PaysDevise({ ...params });
  }

  static reconstitute(props: PaysDeviseProps): PaysDevise {
    return new PaysDevise(props);
  }

  get id(): string {
    return this.props.id;
  }

  endCirculation(dateFin: Date): void {
    this.props.dateFin = dateFin;
  }

  toSnapshot(): Readonly<PaysDeviseProps> {
    return { ...this.props };
  }
}

/** KER-REF-06 : relation pays ↔ langue, avec statut officiel/national/enseignement/véhiculaire. */
export interface PaysLangueProps {
  id: string;
  paysId: string;
  langueId: string;
  statut: StatutPaysLangue;
  ordre: number;
}

export class PaysLangue {
  private constructor(private props: PaysLangueProps) {}

  static create(params: Omit<PaysLangueProps, 'id'> & { id: string }): PaysLangue {
    return new PaysLangue({ ...params });
  }

  static reconstitute(props: PaysLangueProps): PaysLangue {
    return new PaysLangue(props);
  }

  get id(): string {
    return this.props.id;
  }

  toSnapshot(): Readonly<PaysLangueProps> {
    return { ...this.props };
  }
}

export type StatutAdhesionBlocRegional = 'membre' | 'suspendu' | 'retire';

/**
 * KER-REF-07 : appartenance datée à un bloc régional. Modélise explicitement le cas du
 * retrait du Mali, du Burkina Faso et du Niger de la CEDEAO le 29 janvier 2025 —
 * date_retrait renseignée, statut_actuel passé à 'retire', sans supprimer l'historique.
 */
export interface PaysBlocRegionalProps {
  id: string;
  paysId: string;
  blocRegionalId: string;
  dateAdhesion: Date;
  dateRetrait: Date | null;
  statutActuel: StatutAdhesionBlocRegional;
}

export class PaysBlocRegional {
  private constructor(private props: PaysBlocRegionalProps) {}

  static create(
    params: Omit<PaysBlocRegionalProps, 'id' | 'statutActuel' | 'dateRetrait'> & { id: string },
  ): PaysBlocRegional {
    return new PaysBlocRegional({ ...params, dateRetrait: null, statutActuel: 'membre' });
  }

  static reconstitute(props: PaysBlocRegionalProps): PaysBlocRegional {
    return new PaysBlocRegional(props);
  }

  get id(): string {
    return this.props.id;
  }

  suspend(): void {
    this.props.statutActuel = 'suspendu';
  }

  withdraw(dateRetrait: Date): void {
    this.props.dateRetrait = dateRetrait;
    this.props.statutActuel = 'retire';
  }

  reinstate(): void {
    this.props.statutActuel = 'membre';
    this.props.dateRetrait = null;
  }

  toSnapshot(): Readonly<PaysBlocRegionalProps> {
    return { ...this.props };
  }
}

export class InvalidTauxError extends Error {
  constructor(rawValue: string) {
    super(`Taux de change invalide : "${rawValue}" (doit être un nombre décimal strictement positif).`);
    this.name = 'InvalidTauxError';
  }
}

/**
 * KER-REF-04 : unique source de taux de change de la plateforme. Le taux est représenté
 * en chaîne décimale (jamais en `number` JS) pour éviter toute perte de précision en virgule
 * flottante — cohérent avec l'exigence KER-REF-05 de précision monétaire absolue imposée aux
 * produits consommateurs.
 */
export interface TauxChangeProps {
  id: string;
  deviseBaseId: string;
  deviseCibleId: string;
  taux: string; // décimal en chaîne, ex. "655.9570000000"
  validDu: Date;
  validAu: Date | null; // null = taux en vigueur jusqu'à nouvel ordre
  source: string; // ex. "BCEAO", "Banque Centrale de Guinée"
}

const DECIMAL_STRING_REGEX = /^\d+(\.\d+)?$/;

export class TauxChange {
  private constructor(private readonly props: TauxChangeProps) {}

  static create(params: Omit<TauxChangeProps, 'id'> & { id: string }): TauxChange {
    if (!DECIMAL_STRING_REGEX.test(params.taux) || Number(params.taux) <= 0) {
      throw new InvalidTauxError(params.taux);
    }
    if (params.validAu && params.validAu <= params.validDu) {
      throw new Error('valid_au doit être postérieur à valid_du pour un taux de change.');
    }
    return new TauxChange({ ...params });
  }

  static reconstitute(props: TauxChangeProps): TauxChange {
    return new TauxChange(props);
  }

  get id(): string {
    return this.props.id;
  }

  get taux(): string {
    return this.props.taux;
  }

  get validDu(): Date {
    return this.props.validDu;
  }

  get validAu(): Date | null {
    return this.props.validAu;
  }

  /** Le taux est-il en vigueur à l'instant donné ? Utilisé par ResolveExchangeRateUseCase. */
  isValidAt(instant: Date): boolean {
    const afterStart = this.props.validDu <= instant;
    const beforeEnd = this.props.validAu === null || instant <= this.props.validAu;
    return afterStart && beforeEnd;
  }

  toSnapshot(): Readonly<TauxChangeProps> {
    return { ...this.props };
  }
}
