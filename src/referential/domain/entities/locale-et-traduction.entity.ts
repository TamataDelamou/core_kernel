/**
 * Validation BCP 47 — sous-ensemble strict, pas la RFC 5646 complète. Couvre le besoin réel
 * du noyau : langue (2-3 lettres minuscules) optionnellement suivie d'une région (2 lettres
 * majuscules ISO 3166-1 alpha-2, ou 3 chiffres UN M49 pour les régions supranationales type
 * "419" = Amérique latine). Exemples valides : "fr", "fr-GN", "en-US", "spa-419". Documenté
 * comme sous-ensemble délibéré plutôt que présenté comme une conformité RFC intégrale.
 */
const BCP47_REGEX = /^[a-z]{2,3}(-([A-Z]{2}|\d{3}))?$/;

export class InvalidLocaleCodeError extends Error {
  constructor(code: string) {
    super(`Code locale invalide : "${code}" (format BCP 47 attendu, ex. "fr-GN", "en-US").`);
    this.name = 'InvalidLocaleCodeError';
  }
}

export interface LocaleProps {
  id: string;
  code: string;
  libelle: string;
  estParDefaut: boolean;
  estActif: boolean;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * KER-NOM-04 : "Le locale (format BCP 47, ex. fr-GN) et la table de traductions d'interface,
 * propres à GSG Core et absents du Cadre, sont conservés sous ces noms techniques (locale,
 * traduction) car ils relèvent de l'internationalisation logicielle, non du référentiel
 * métier pays/devise/langue proprement dit." C'est pourquoi `Locale` ne porte aucune
 * référence à `Pays`/`Langue` (pas de FK, ni physique ni applicative) : le code BCP 47 est
 * auto-suffisant, exactement comme dans n'importe quel système i18n standard.
 */
export class Locale {
  private constructor(private props: LocaleProps) {}

  static create(params: { id: string; code: string; libelle: string }): Locale {
    if (!BCP47_REGEX.test(params.code)) {
      throw new InvalidLocaleCodeError(params.code);
    }

    const now = new Date();
    return new Locale({
      id: params.id,
      code: params.code,
      libelle: params.libelle.trim(),
      estParDefaut: false,
      estActif: true,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: LocaleProps): Locale {
    return new Locale(props);
  }

  get id(): string {
    return this.props.id;
  }

  get code(): string {
    return this.props.code;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  get estParDefaut(): boolean {
    return this.props.estParDefaut;
  }

  updateDetails(params: Partial<Pick<LocaleProps, 'libelle'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  marquerCommeDefaut(): void {
    this.props.estParDefaut = true;
    this.props.modifieLe = new Date();
  }

  retirerStatutDefaut(): void {
    this.props.estParDefaut = false;
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

  toSnapshot(): Readonly<LocaleProps> {
    return { ...this.props };
  }
}

export interface TraductionProps {
  id: string;
  localeId: string;
  cle: string;
  valeur: string;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * Table de traductions d'interface (KER-NOM-04) — association clé/valeur paramétrée par
 * locale (ex. `cle = "auth.login.title"`, `valeur = "Se connecter"` pour fr-GN,
 * `"Sign in"` pour en-US). Unicité `(localeId, cle)` — une seule traduction par clé et par
 * locale, appliquée au niveau base (migration), pas seulement documentée ici.
 */
export class Traduction {
  private constructor(private props: TraductionProps) {}

  static create(params: { id: string; localeId: string; cle: string; valeur: string }): Traduction {
    const now = new Date();
    return new Traduction({
      id: params.id,
      localeId: params.localeId,
      cle: params.cle.trim(),
      valeur: params.valeur,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: TraductionProps): Traduction {
    return new Traduction(props);
  }

  get id(): string {
    return this.props.id;
  }

  get localeId(): string {
    return this.props.localeId;
  }

  get cle(): string {
    return this.props.cle;
  }

  updateValeur(valeur: string): void {
    this.props.valeur = valeur;
    this.props.modifieLe = new Date();
  }

  toSnapshot(): Readonly<TraductionProps> {
    return { ...this.props };
  }
}
