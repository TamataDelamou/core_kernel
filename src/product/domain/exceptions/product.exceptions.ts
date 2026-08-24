export class CatalogueNotFoundError extends Error {
  constructor() {
    super('Catalogue introuvable.');
    this.name = 'CatalogueNotFoundError';
  }
}

export class ProduitNotFoundError extends Error {
  constructor() {
    super('Produit introuvable dans ce catalogue.');
    this.name = 'ProduitNotFoundError';
  }
}

export class ProduitCodeAlreadyExistsError extends Error {
  constructor(code: string) {
    super(`Un produit avec le code "${code}" existe déjà dans ce catalogue.`);
    this.name = 'ProduitCodeAlreadyExistsError';
  }
}

export class OffreNotFoundError extends Error {
  constructor() {
    super('Offre introuvable.');
    this.name = 'OffreNotFoundError';
  }
}

export class OffreCodeAlreadyExistsError extends Error {
  constructor(code: string) {
    super(`Une offre avec le code "${code}" existe déjà pour ce produit.`);
    this.name = 'OffreCodeAlreadyExistsError';
  }
}

export class FeatureNotFoundError extends Error {
  constructor() {
    super('Fonctionnalité introuvable.');
    this.name = 'FeatureNotFoundError';
  }
}

export class FeatureCodeAlreadyExistsError extends Error {
  constructor(code: string) {
    super(`Une fonctionnalité avec le code "${code}" existe déjà.`);
    this.name = 'FeatureCodeAlreadyExistsError';
  }
}

export class EntitlementAlreadyExistsError extends Error {
  constructor() {
    super('Cette fonctionnalité est déjà rattachée à cette offre.');
    this.name = 'EntitlementAlreadyExistsError';
  }
}

export class GrilleTarifaireNotFoundError extends Error {
  constructor() {
    super('Grille tarifaire introuvable.');
    this.name = 'GrilleTarifaireNotFoundError';
  }
}

/** KER-PRD — interdiction absolue d'appliquer un prix dans une devise non certifiée. */
export class UncertifiedCurrencyError extends Error {
  constructor(deviseId: string) {
    super(
      `La devise "${deviseId}" n'est pas certifiée (non publiée ou inactive dans GSG Referential) ` +
        '— aucune grille tarifaire ne peut y être exprimée (KER-PRD).',
    );
    this.name = 'UncertifiedCurrencyError';
  }
}

/** KER-PRD — fermeture du contrôle de portée catalogue ↔ organisation (hiérarchie Org Registry). */
export class CatalogueAccessDeniedError extends Error {
  constructor(organisationId: string, catalogueId: string) {
    super(
      `L'organisation "${organisationId}" n'a pas accès au catalogue "${catalogueId}" — ce catalogue ` +
        'est scopé à une autre organisation dont elle ne descend pas (KER-PRD).',
    );
    this.name = 'CatalogueAccessDeniedError';
  }
}

export class OrganisationScopeNotFoundError extends Error {
  constructor(organisationId: string) {
    super(`Organisation "${organisationId}" introuvable ou désactivée — scope de catalogue refusé.`);
    this.name = 'OrganisationScopeNotFoundError';
  }
}

/** KER-PROD-01 : un produitId doit référencer une ligne active du Registre Central des Produits. */
export class UnregisteredProductError extends Error {
  constructor(produitId: string) {
    super(
      `Produit "${produitId}" introuvable ou désactivé dans le Registre Central des Produits ` +
        '(KER-PROD-01) — création refusée.',
    );
    this.name = 'UnregisteredProductError';
  }
}
