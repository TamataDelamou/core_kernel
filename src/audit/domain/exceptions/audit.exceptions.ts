export class DeadLetterEntryNotFoundError extends Error {
  constructor() {
    super('Entrée de Dead-Letter Queue introuvable.');
    this.name = 'DeadLetterEntryNotFoundError';
  }
}

export class DeadLetterEntryAlreadyReplayedError extends Error {
  constructor() {
    super('Cette entrée de Dead-Letter Queue a déjà été rejouée.');
    this.name = 'DeadLetterEntryAlreadyReplayedError';
  }
}

export class InvalidStreamMessageError extends Error {
  constructor(reason: string) {
    super(`Message du bus d'événements structurellement invalide, ignoré : ${reason}`);
    this.name = 'InvalidStreamMessageError';
  }
}

/** KER-ORG-03 : un org.owner doit toujours préciser le périmètre consulté — jamais de requête non scopée. */
export class AuditTrailScopeRequiredError extends Error {
  constructor() {
    super('Le paramètre gsgOrgId est requis pour consulter le journal d\'audit avec ce rôle.');
    this.name = 'AuditTrailScopeRequiredError';
  }
}

/** Ferme le contrôle de portée : refuse un gsgOrgId hors du périmètre (soi-même ou une filiale) de l'appelant. */
export class AuditTrailAccessDeniedError extends Error {
  constructor(gsgOrgId: string) {
    super(
      `Accès refusé au journal d'audit de l'organisation "${gsgOrgId}" — hors du périmètre ` +
        "de l'utilisateur (ni lui-même, ni une de ses filiales).",
    );
    this.name = 'AuditTrailAccessDeniedError';
  }
}
