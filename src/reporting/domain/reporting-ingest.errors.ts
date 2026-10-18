export class InvalidReportingPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReportingPayloadError';
  }
}

export class ReportingIdempotencyConflictError extends Error {
  constructor(message = 'La clé d’idempotence a déjà été utilisée avec un contenu différent.') {
    super(message);
    this.name = 'ReportingIdempotencyConflictError';
  }
}

export class ReportingSourceMismatchError extends Error {
  constructor() {
    super('La provenance ne correspond pas à l’identité workload authentifiée.');
    this.name = 'ReportingSourceMismatchError';
  }
}
