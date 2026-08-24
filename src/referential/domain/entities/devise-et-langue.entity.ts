import { assertTransitionAllowed, StatutWorkflow } from './workflow';

const ISO_4217_REGEX = /^[A-Z]{3}$/;
const ISO_639_REGEX = /^[a-z]{2,3}$/;

export class InvalidCodeIso4217Error extends Error {
  constructor(rawValue: string) {
    super(`Code ISO 4217 invalide : "${rawValue}" (attendu : 3 lettres majuscules, ex. XOF).`);
    this.name = 'InvalidCodeIso4217Error';
  }
}

export class InvalidCodeIso639Error extends Error {
  constructor(rawValue: string) {
    super(`Code ISO 639 invalide : "${rawValue}" (attendu : 2 ou 3 lettres minuscules, ex. fr).`);
    this.name = 'InvalidCodeIso639Error';
  }
}

export class InvalidDecimalesError extends Error {
  constructor(value: number) {
    super(`Nombre de décimales invalide : ${value} (doit être un entier compris entre 0 et 4).`);
    this.name = 'InvalidDecimalesError';
  }
}

export interface DeviseProps {
  id: string;
  codeIso4217: string;
  nom: string;
  zoneMonetaire: string | null; // ex. BCEAO, BEAC (KER-REF-08)
  decimales: number; // nombre officiel de décimales — 0 pour XOF/GNF, 3 pour KWD (KER-REF-02)
  estActif: boolean;
  statutWorkflow: StatutWorkflow;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * Entité de domaine Devise, alignée ISO 4217. Le champ `decimales` est l'apport de GSG Core
 * conservé lors de la fusion (KER-REF-02) : indispensable au calcul en unité mineure entière
 * exigé de tous les produits qui manipulent de l'argent (KER-REF-05).
 */
export class Devise {
  private constructor(private props: DeviseProps) {}

  static create(params: {
    id: string;
    codeIso4217: string;
    nom: string;
    zoneMonetaire?: string | null;
    decimales: number;
  }): Devise {
    const codeIso4217 = params.codeIso4217.trim().toUpperCase();
    if (!ISO_4217_REGEX.test(codeIso4217)) {
      throw new InvalidCodeIso4217Error(params.codeIso4217);
    }
    if (!Number.isInteger(params.decimales) || params.decimales < 0 || params.decimales > 4) {
      throw new InvalidDecimalesError(params.decimales);
    }

    const now = new Date();
    return new Devise({
      id: params.id,
      codeIso4217,
      nom: params.nom.trim(),
      zoneMonetaire: params.zoneMonetaire ?? null,
      decimales: params.decimales,
      estActif: true,
      statutWorkflow: 'brouillon',
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: DeviseProps): Devise {
    return new Devise(props);
  }

  get id(): string {
    return this.props.id;
  }

  get codeIso4217(): string {
    return this.props.codeIso4217;
  }

  get decimales(): number {
    return this.props.decimales;
  }

  get statutWorkflow(): StatutWorkflow {
    return this.props.statutWorkflow;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  updateDetails(params: Partial<Pick<DeviseProps, 'nom' | 'zoneMonetaire' | 'decimales'>>): void {
    if (params.decimales !== undefined) {
      if (!Number.isInteger(params.decimales) || params.decimales < 0 || params.decimales > 4) {
        throw new InvalidDecimalesError(params.decimales);
      }
    }
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

  toSnapshot(): Readonly<DeviseProps> {
    return { ...this.props };
  }
}

export type StatutPaysLangue = 'officielle' | 'nationale' | 'enseignement_initial' | 'vehiculaire';

export interface LangueProps {
  id: string;
  codeIso639: string;
  nom: string;
  estActif: boolean;
  statutWorkflow: StatutWorkflow;
  creeLe: Date;
  modifieLe: Date;
}

/** Entité de domaine Langue, alignée ISO 639 (KER-REF-06). */
export class Langue {
  private constructor(private props: LangueProps) {}

  static create(params: { id: string; codeIso639: string; nom: string }): Langue {
    const codeIso639 = params.codeIso639.trim().toLowerCase();
    if (!ISO_639_REGEX.test(codeIso639)) {
      throw new InvalidCodeIso639Error(params.codeIso639);
    }

    const now = new Date();
    return new Langue({
      id: params.id,
      codeIso639,
      nom: params.nom.trim(),
      estActif: true,
      statutWorkflow: 'brouillon',
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: LangueProps): Langue {
    return new Langue(props);
  }

  get id(): string {
    return this.props.id;
  }

  get codeIso639(): string {
    return this.props.codeIso639;
  }

  get statutWorkflow(): StatutWorkflow {
    return this.props.statutWorkflow;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  updateDetails(params: Partial<Pick<LangueProps, 'nom'>>): void {
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

  toSnapshot(): Readonly<LangueProps> {
    return { ...this.props };
  }
}
