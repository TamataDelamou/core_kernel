export class OrganisationNotFoundError extends Error {
  constructor() {
    super('Organisation introuvable dans le registre.');
    this.name = 'OrganisationNotFoundError';
  }
}

export class OrganisationInactiveError extends Error {
  constructor() {
    super('Cette organisation est désactivée.');
    this.name = 'OrganisationInactiveError';
  }
}

export class CircularParentingError extends Error {
  constructor() {
    super(
      "Rattachement refusé : l'organisation cible est déjà une filiale (directe ou indirecte) " +
        'de cette organisation — un cycle de filiation serait créé.',
    );
    this.name = 'CircularParentingError';
  }
}

export class UniteOperationnelleNotFoundError extends Error {
  constructor() {
    super('Unité opérationnelle introuvable.');
    this.name = 'UniteOperationnelleNotFoundError';
  }
}

export class AbonnementNotFoundError extends Error {
  constructor() {
    super('Abonnement introuvable.');
    this.name = 'AbonnementNotFoundError';
  }
}

export class AbonnementAlreadyExistsError extends Error {
  constructor() {
    super('Cette organisation dispose déjà d\'un abonnement (actif ou suspendu) à ce produit.');
    this.name = 'AbonnementAlreadyExistsError';
  }
}

/** KER-PROD-01 : un produitId doit référencer une ligne active du Registre Central des Produits. */
export class UnregisteredProductError extends Error {
  constructor(produitId: string) {
    super(
      `Produit "${produitId}" introuvable ou désactivé dans le Registre Central des Produits ` +
        '(KER-PROD-01) — souscription refusée.',
    );
    this.name = 'UnregisteredProductError';
  }
}
