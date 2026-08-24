import { EntityManager } from 'typeorm';

export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');

/**
 * Port permettant d'exécuter un bloc de code dans une unique transaction Postgres. Fourni
 * dès maintenant pour retrofiter progressivement l'atomicité complète entre une écriture
 * métier et l'insertion outbox correspondante (aujourd'hui deux instructions séquentielles
 * indépendantes — voir OutboxEventPublisherService pour la nuance exacte).
 *
 * Usage prévu dans un use-case : injecter TRANSACTION_MANAGER, puis remplacer
 * `await repository.save(x); await eventPublisher.publish(evt);` par
 * `await transactionManager.runInTransaction(async () => { await repository.save(x); await eventPublisher.publish(evt); });`
 * — à condition que les implémentations de repository et d'EventPublisher utilisées à
 * l'intérieur du callback résolvent le même EntityManager transactionnel ambient (mécanisme
 * de propagation via AsyncLocalStorage, non encore branché sur les repositories existants —
 * c'est le chantier de retrofit documenté dans le README, pas une fonctionnalité silencieuse).
 */
export interface TransactionManager {
  runInTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T>;
}
