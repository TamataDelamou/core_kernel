export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("Cette adresse e-mail est déjà associée à un compte GSG ID.");
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    // OWASP: message générique, ne distingue jamais "e-mail inconnu" de "mot de passe incorrect".
    super('Identifiants invalides.');
    this.name = 'InvalidCredentialsError';
  }
}

export class MfaRequiredError extends Error {
  constructor(public readonly mfaChallengeToken: string) {
    super('Une vérification MFA est requise pour finaliser l\'authentification.');
    this.name = 'MfaRequiredError';
  }
}

export class InvalidMfaCodeError extends Error {
  constructor() {
    super('Code MFA invalide.');
    this.name = 'InvalidMfaCodeError';
  }
}

export class MfaAlreadyEnabledError extends Error {
  constructor() {
    super('Le MFA est déjà activé pour ce compte.');
    this.name = 'MfaAlreadyEnabledError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('Utilisateur introuvable.');
    this.name = 'UserNotFoundError';
  }
}

export class ExternalIdentityAlreadyLinkedError extends Error {
  constructor() {
    super('Cet identifiant externe est déjà lié à un autre compte GSG ID pour ce produit.');
    this.name = 'ExternalIdentityAlreadyLinkedError';
  }
}

export class RoleNotFoundError extends Error {
  constructor() {
    super('Rôle introuvable.');
    this.name = 'RoleNotFoundError';
  }
}

/** KER-ORG-03 : ferme le contrôle de portée — un rôle scopé ne peut référencer qu'une organisation réelle et active. */
export class InvalidOrganizationScopeError extends Error {
  constructor(gsgOrgId: string) {
    super(
      `Organisation "${gsgOrgId}" introuvable ou désactivée — attribution de rôle scopé refusée (KER-ORG-03).`,
    );
    this.name = 'InvalidOrganizationScopeError';
  }
}

/**
 * KER-ID-02 : la session Supabase présentée n'a pas pu être vérifiée (signature invalide,
 * émetteur inattendu, expirée, ou rôle différent de "authenticated"). Message générique
 * volontaire — ne distingue jamais la cause précise (anti-énumération / anti-fuite d'info
 * sur l'état interne du projet Supabase du produit appelant).
 */
export class InvalidSupabaseSessionError extends Error {
  constructor() {
    super('Session Supabase invalide ou expirée.');
    this.name = 'InvalidSupabaseSessionError';
  }
}

/** L'URL de projet Supabase fournie n'est pas dans la liste des projets GSG autorisés. */
export class UntrustedSupabaseProjectError extends Error {
  constructor(supabaseProjectUrl: string) {
    super(
      `Le projet Supabase "${supabaseProjectUrl}" n'est pas enregistré parmi les projets GSG ` +
        'autorisés — échange de session refusé (protection anti-SSRF).',
    );
    this.name = 'UntrustedSupabaseProjectError';
  }
}
