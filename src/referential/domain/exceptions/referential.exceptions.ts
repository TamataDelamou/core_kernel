export class PaysNotFoundError extends Error {
  constructor() {
    super('Pays introuvable dans le référentiel.');
    this.name = 'PaysNotFoundError';
  }
}

export class PaysCodeIsoAlreadyExistsError extends Error {
  constructor(codeIso: string) {
    super(`Un pays avec le code ISO "${codeIso}" existe déjà (KER-REF-01 : source unique).`);
    this.name = 'PaysCodeIsoAlreadyExistsError';
  }
}

export class DeviseNotFoundError extends Error {
  constructor() {
    super('Devise introuvable dans le référentiel.');
    this.name = 'DeviseNotFoundError';
  }
}

export class DeviseCodeIso4217AlreadyExistsError extends Error {
  constructor(code: string) {
    super(`Une devise avec le code ISO 4217 "${code}" existe déjà.`);
    this.name = 'DeviseCodeIso4217AlreadyExistsError';
  }
}

export class LangueNotFoundError extends Error {
  constructor() {
    super('Langue introuvable dans le référentiel.');
    this.name = 'LangueNotFoundError';
  }
}

export class LangueCodeIso639AlreadyExistsError extends Error {
  constructor(code: string) {
    super(`Une langue avec le code ISO 639 "${code}" existe déjà.`);
    this.name = 'LangueCodeIso639AlreadyExistsError';
  }
}

export class BlocRegionalNotFoundError extends Error {
  constructor() {
    super('Bloc régional introuvable dans le référentiel.');
    this.name = 'BlocRegionalNotFoundError';
  }
}

export class BlocRegionalCodeAlreadyExistsError extends Error {
  constructor(code: string) {
    super(`Un bloc régional avec le code "${code}" existe déjà.`);
    this.name = 'BlocRegionalCodeAlreadyExistsError';
  }
}

export class VilleNotFoundError extends Error {
  constructor() {
    super('Ville introuvable dans le référentiel.');
    this.name = 'VilleNotFoundError';
  }
}

export class PaysBlocRegionalNotFoundError extends Error {
  constructor() {
    super("Relation d'appartenance pays/bloc régional introuvable.");
    this.name = 'PaysBlocRegionalNotFoundError';
  }
}

/**
 * KER-REF-04 : si aucun taux valide n'existe pour une paire de devises à un instant donné,
 * le système refuse explicitement l'opération plutôt que de supposer une parité 1:1.
 */
export class NoValidExchangeRateError extends Error {
  constructor(deviseBaseId: string, deviseCibleId: string, instant: Date) {
    super(
      `Aucun taux de change valide entre "${deviseBaseId}" et "${deviseCibleId}" à la date ${instant.toISOString()} — ` +
        'opération refusée (KER-REF-04 : aucune parité 1:1 implicite).',
    );
    this.name = 'NoValidExchangeRateError';
  }
}

export class ReferentialEntityNotPublishedError extends Error {
  constructor(entityType: string) {
    super(
      `Cette entrée de référentiel (${entityType}) n'est pas encore publiée et ne peut pas être ` +
        'consommée par un produit (KER-AUD-04 : workflow de publication requis).',
    );
    this.name = 'ReferentialEntityNotPublishedError';
  }
}

/** KER-ADM-03 : un referentiel_hierarchique_id fourni sur une Ville doit référencer un nœud existant et publié. */
export class UnpublishedHierarchicalNodeError extends Error {
  constructor(noeudId: string) {
    super(
      `Le nœud hiérarchique "${noeudId}" n'existe pas ou n'est pas publié — impossible de ` +
        "l'associer à une ville (KER-ADM-03).",
    );
    this.name = 'UnpublishedHierarchicalNodeError';
  }
}

export class LocaleNotFoundError extends Error {
  constructor() {
    super('Locale introuvable.');
    this.name = 'LocaleNotFoundError';
  }
}

export class LocaleCodeAlreadyExistsError extends Error {
  constructor(code: string) {
    super(`Une locale avec le code "${code}" existe déjà.`);
    this.name = 'LocaleCodeAlreadyExistsError';
  }
}

export class TraductionNotFoundError extends Error {
  constructor() {
    super('Traduction introuvable.');
    this.name = 'TraductionNotFoundError';
  }
}

export class TraductionKeyAlreadyExistsError extends Error {
  constructor(cle: string, localeId: string) {
    super(`Une traduction pour la clé "${cle}" existe déjà pour la locale "${localeId}".`);
    this.name = 'TraductionKeyAlreadyExistsError';
  }
}
