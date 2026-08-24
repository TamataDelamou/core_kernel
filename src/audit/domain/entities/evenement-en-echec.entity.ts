export interface EvenementEnEchecProps {
  id: string;
  evenementId: string;
  type: string;
  gsgOrgId: string | null;
  produitSource: string;
  horodatage: Date;
  chargeUtile: Record<string, unknown>;
  tentatives: number;
  derniereErreur: string;
  misEnEchecLe: Date;
  /** Un opérateur peut rejouer manuellement une entrée DLQ — traçabilité de cette action. */
  rejoueLe: Date | null;
}

/**
 * Entrée de Dead-Letter Queue (résilience de l'Event Bus, gestion des DLQ demandée
 * explicitement). Un événement y échoue après avoir dépassé `AUDIT_CONSUMER_MAX_DELIVERIES`
 * tentatives de traitement par RedisStreamsConsumerService — jamais silencieusement perdu,
 * toujours conservé pour investigation et rejeu manuel éventuel.
 */
export class EvenementEnEchec {
  private constructor(private props: EvenementEnEchecProps) {}

  static create(params: Omit<EvenementEnEchecProps, 'misEnEchecLe' | 'rejoueLe'>): EvenementEnEchec {
    return new EvenementEnEchec({ ...params, misEnEchecLe: new Date(), rejoueLe: null });
  }

  static reconstitute(props: EvenementEnEchecProps): EvenementEnEchec {
    return new EvenementEnEchec(props);
  }

  get id(): string {
    return this.props.id;
  }

  get evenementId(): string {
    return this.props.evenementId;
  }

  get type(): string {
    return this.props.type;
  }

  markReplayed(now: Date = new Date()): void {
    this.props.rejoueLe = now;
  }

  toSnapshot(): Readonly<EvenementEnEchecProps> {
    return { ...this.props };
  }
}

/**
 * Fonction pure : un message dont la livraison a été tentée `deliveryCount` fois doit-il
 * basculer en DLQ ? Extraite du consommateur pour rester testable sans Redis réel.
 */
export function shouldMoveToDeadLetter(deliveryCount: number, maxDeliveries: number): boolean {
  return deliveryCount > maxDeliveries;
}
