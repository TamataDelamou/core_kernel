export class OrganisationNotFoundOrInactiveError extends Error {
  constructor() {
    super('Organisation introuvable ou désactivée — résolution AppConfig refusée.');
    this.name = 'OrganisationNotFoundOrInactiveError';
  }
}

/** L'appelant a fourni un gsgOrgId hors de son propre périmètre (claim gsgOrgIds du JWT). */
export class OrganisationNotInUserScopeError extends Error {
  constructor() {
    super('Cette organisation ne fait pas partie du périmètre de l\'utilisateur authentifié.');
    this.name = 'OrganisationNotInUserScopeError';
  }
}

/** L'unité opérationnelle fournie n'existe pas ou n'appartient pas à l'organisation indiquée. */
export class UniteOperationnelleNotInOrganisationError extends Error {
  constructor() {
    super('Cette unité opérationnelle n\'appartient pas à l\'organisation indiquée.');
    this.name = 'UniteOperationnelleNotInOrganisationError';
  }
}
