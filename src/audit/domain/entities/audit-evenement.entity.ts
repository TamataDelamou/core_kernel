export interface AuditEvenementProps {
  id: string;
  /** Identifiant de la ligne outbox d'origine — clé de déduplication (KER-AUD, idempotence). */
  evenementId: string;
  type: string;
  gsgOrgId: string | null;
  produitSource: string;
  horodatage: Date;
  chargeUtile: Record<string, unknown>;
  traiteLe: Date;
}

/**
 * Enregistrement d'audit immuable (KER-AUD-01). Une fois créé, il n'est plus jamais modifié
 * — c'est un journal, pas un état mutable. La déduplication par `evenementId` garantit
 * l'idempotence du traitement : si le consommateur Redis Streams retraite un message déjà
 * traité (redémarrage, reclaim après crash via XAUTOCLAIM), l'insertion échoue silencieusement
 * sur la contrainte d'unicité plutôt que de dupliquer l'entrée d'audit.
 */
export class AuditEvenement {
  private constructor(private readonly props: AuditEvenementProps) {}

  static create(params: Omit<AuditEvenementProps, 'traiteLe'>): AuditEvenement {
    return new AuditEvenement({ ...params, traiteLe: new Date() });
  }

  static reconstitute(props: AuditEvenementProps): AuditEvenement {
    return new AuditEvenement(props);
  }

  get id(): string {
    return this.props.id;
  }

  get evenementId(): string {
    return this.props.evenementId;
  }

  toSnapshot(): Readonly<AuditEvenementProps> {
    return { ...this.props };
  }
}
