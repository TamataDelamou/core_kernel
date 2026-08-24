import { Email } from '../../../common/value-objects/email.vo';
import { PhoneE164 } from '../../../common/value-objects/phone-e164.vo';

export type UserStatus = 'actif' | 'suspendu' | 'desactive';

/**
 * Références vers le GSG Referential (section 6-7 du Kernel).
 * Champs nommés en français conformément à KER-ID-05 et KER-NOM-01 : ce sont des clés
 * vers le référentiel métier partagé du noyau, jamais des données dupliquées localement.
 */
export interface ReferentielUtilisateur {
  paysId: string | null;
  uniteAdministrativeId: string | null;
  villeId: string | null;
  langueId: string | null;
  deviseId: string | null;
  fuseauHoraire: string | null; // IANA, ex. Africa/Conakry — résolu via héritage si non défini (KER-INH-01)
}

export interface UserProps {
  gsgId: string;
  email: Email | null;
  emailVerifie: boolean;
  phone: PhoneE164 | null;
  phoneVerifie: boolean;
  /**
   * Nullable : un compte provisionné à partir d'une identité externe déjà vérifiée
   * (registerViaVerifiedExternalIdentity — voir plus bas) n'a jamais de mot de passe. Un compte sans passwordHash ne peut jamais s'authentifier
   * par mot de passe (AuthenticateUserUseCase compare toujours contre un hash factice si
   * passwordHash est null, ce qui échoue systématiquement — aucun cas particulier requis).
   */
  passwordHash: string | null;
  nomAffichage: string;
  statut: UserStatus;
  mfaActive: boolean;
  referentiel: ReferentielUtilisateur;
  creeLe: Date;
  modifieLe: Date;
  dernierAuthLe: Date | null;
  tentativesEchoueesConsecutives: number;
  verrouilleJusqua: Date | null;
}

export class MissingIdentifierError extends Error {
  constructor() {
    super("Un profil GSG ID doit porter au moins un identifiant : email ou téléphone.");
    this.name = 'MissingIdentifierError';
  }
}

export class UserAccountLockedError extends Error {
  constructor(until: Date) {
    super(`Compte verrouillé jusqu'au ${until.toISOString()} suite à des échecs d'authentification répétés.`);
    this.name = 'UserAccountLockedError';
  }
}

export class UserAccountInactiveError extends Error {
  constructor(status: UserStatus) {
    super(`Compte non actif (statut actuel : ${status}).`);
    this.name = 'UserAccountInactiveError';
  }
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Entité de domaine User (profil utilisateur du noyau GSG ID).
 * Porte les invariants métier : verrouillage anti-brute-force (OWASP ASVS 2.2.1),
 * statut du compte, et l'état MFA. Ne connaît rien de la persistance ni du framework HTTP.
 */
export class User {
  private props: UserProps;

  private constructor(props: UserProps) {
    this.props = props;
  }

  static register(params: {
    gsgId: string;
    email: Email;
    phone: PhoneE164 | null;
    passwordHash: string;
    nomAffichage: string;
    referentiel: ReferentielUtilisateur;
  }): User {
    const now = new Date();
    return new User({
      gsgId: params.gsgId,
      email: params.email,
      emailVerifie: false,
      phone: params.phone,
      phoneVerifie: false,
      passwordHash: params.passwordHash,
      nomAffichage: params.nomAffichage,
      statut: 'actif',
      mfaActive: false,
      referentiel: params.referentiel,
      creeLe: now,
      modifieLe: now,
      dernierAuthLe: null,
      tentativesEchoueesConsecutives: 0,
      verrouilleJusqua: null,
    });
  }

  /**
   * Provisionne un compte à partir d'une identité EXTERNE déjà vérifiée — typiquement une
   * session Supabase authentifiée nativement par un produit GSG (signInWithOtp/verifyOtp :
   * SMS, WhatsApp via Twilio, Magic Link ou code OTP email — voir le modèle d'authentification
   * de référence "Migration Firebase → Supabase"). GSG ID ne réalise jamais lui-même la
   * vérification OTP : il fait confiance à la preuve déjà apportée par Supabase Auth, exposée
   * via un jeton dont la signature est vérifiée par SupabaseSessionExchangeUseCase (KER-ID-02).
   * Contrairement à `register`, n'exige NI mot de passe NI email : un utilisateur identifié
   * uniquement par téléphone (cas WhatsApp-only, courant sur les marchés où GSG opère)
   * obtient un profil complet.
   */
  static registerViaVerifiedExternalIdentity(params: {
    gsgId: string;
    email: Email | null;
    phone: PhoneE164 | null;
    nomAffichage: string;
    referentiel: ReferentielUtilisateur;
  }): User {
    if (!params.email && !params.phone) {
      throw new MissingIdentifierError();
    }

    const now = new Date();
    return new User({
      gsgId: params.gsgId,
      email: params.email,
      emailVerifie: params.email !== null,
      phone: params.phone,
      phoneVerifie: params.phone !== null,
      passwordHash: null,
      nomAffichage: params.nomAffichage,
      statut: 'actif',
      mfaActive: false,
      referentiel: params.referentiel,
      creeLe: now,
      modifieLe: now,
      dernierAuthLe: null,
      tentativesEchoueesConsecutives: 0,
      verrouilleJusqua: null,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  get gsgId(): string {
    return this.props.gsgId;
  }

  get email(): Email | null {
    return this.props.email;
  }

  get phone(): PhoneE164 | null {
    return this.props.phone;
  }

  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  get statut(): UserStatus {
    return this.props.statut;
  }

  get mfaActive(): boolean {
    return this.props.mfaActive;
  }

  get referentiel(): ReferentielUtilisateur {
    return this.props.referentiel;
  }

  get nomAffichage(): string {
    return this.props.nomAffichage;
  }

  get emailVerifie(): boolean {
    return this.props.emailVerifie;
  }

  get phoneVerifie(): boolean {
    return this.props.phoneVerifie;
  }

  get modifieLe(): Date {
    return this.props.modifieLe;
  }

  get tentativesEchoueesConsecutives(): number {
    return this.props.tentativesEchoueesConsecutives;
  }

  get verrouilleJusqua(): Date | null {
    return this.props.verrouilleJusqua;
  }

  /** Vérifie que le compte peut tenter une authentification (statut + verrouillage). */
  assertCanAuthenticate(now: Date = new Date()): void {
    if (this.props.statut !== 'actif') {
      throw new UserAccountInactiveError(this.props.statut);
    }
    if (this.props.verrouilleJusqua && this.props.verrouilleJusqua > now) {
      throw new UserAccountLockedError(this.props.verrouilleJusqua);
    }
  }

  /** Enregistre un échec d'authentification et verrouille le compte au-delà du seuil. */
  registerFailedAuthentication(now: Date = new Date()): void {
    this.props.tentativesEchoueesConsecutives += 1;
    if (this.props.tentativesEchoueesConsecutives >= MAX_FAILED_ATTEMPTS) {
      const until = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60_000);
      this.props.verrouilleJusqua = until;
    }
    this.props.modifieLe = now;
  }

  /** Réinitialise le compteur d'échecs après une authentification réussie. */
  registerSuccessfulAuthentication(now: Date = new Date()): void {
    this.props.tentativesEchoueesConsecutives = 0;
    this.props.verrouilleJusqua = null;
    this.props.dernierAuthLe = now;
    this.props.modifieLe = now;
  }

  enableMfa(now: Date = new Date()): void {
    this.props.mfaActive = true;
    this.props.modifieLe = now;
  }

  disableMfa(now: Date = new Date()): void {
    this.props.mfaActive = false;
    this.props.modifieLe = now;
  }

  changePasswordHash(newHash: string, now: Date = new Date()): void {
    this.props.passwordHash = newHash;
    this.props.modifieLe = now;
  }

  markEmailVerified(now: Date = new Date()): void {
    this.props.emailVerifie = true;
    this.props.modifieLe = now;
  }

  markPhoneVerified(now: Date = new Date()): void {
    this.props.phoneVerifie = true;
    this.props.modifieLe = now;
  }

  /**
   * Attache un email à un compte existant qui n'en avait pas encore (ex. un utilisateur
   * inscrit via WhatsApp uniquement ajoute plus tard une adresse e-mail, vérifiée par OTP).
   * Ne remplace jamais un email déjà présent — passer par un flux de changement d'email
   * dédié serait nécessaire pour ce cas, hors périmètre ici.
   */
  attachVerifiedEmail(email: Email, now: Date = new Date()): void {
    if (this.props.email === null) {
      this.props.email = email;
    }
    this.props.emailVerifie = true;
    this.props.modifieLe = now;
  }

  /** Symétrique d'attachVerifiedEmail pour le téléphone. */
  attachVerifiedPhone(phone: PhoneE164, now: Date = new Date()): void {
    if (this.props.phone === null) {
      this.props.phone = phone;
    }
    this.props.phoneVerifie = true;
    this.props.modifieLe = now;
  }

  /**
   * Met à jour les références vers le GSG Referential (KER-ID-05). Une organisation cliente
   * peut avoir ses propres valeurs (KER-ORG-04) ; ce champ reste celui de l'utilisateur,
   * résolu en dernier ressort par la chaîne d'héritage (KER-INH-01) au niveau AppConfig.
   */
  updateReferentiel(referentiel: Partial<ReferentielUtilisateur>, now: Date = new Date()): void {
    this.props.referentiel = { ...this.props.referentiel, ...referentiel };
    this.props.modifieLe = now;
  }

  suspend(now: Date = new Date()): void {
    this.props.statut = 'suspendu';
    this.props.modifieLe = now;
  }

  reactivate(now: Date = new Date()): void {
    this.props.statut = 'actif';
    this.props.modifieLe = now;
  }

  deactivate(now: Date = new Date()): void {
    this.props.statut = 'desactive';
    this.props.modifieLe = now;
  }

  toSnapshot(): Readonly<UserProps> {
    return { ...this.props };
  }
}
