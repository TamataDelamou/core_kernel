import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager } from 'typeorm';

/**
 * Porte l'EntityManager transactionnel de la requête HTTP en cours, si une transaction a été
 * ouverte par TransactionInterceptor (common/interceptors/transaction.interceptor.ts). Fondé
 * sur AsyncLocalStorage — le mécanisme standard Node.js pour propager un contexte à travers
 * une chaîne d'`await`, sans avoir à faire transiter l'EntityManager explicitement en
 * paramètre de chaque use-case et chaque méthode de repository.
 *
 * `getManager()` renvoie `undefined` en dehors de toute requête (ex. OutboxRelayService et
 * RedisStreamsConsumerService, qui tournent en tâche de fond, hors cycle HTTP) — c'est le
 * signal pour TransactionalRepository de retomber sur le repository par défaut, sans erreur.
 */
@Injectable()
export class TransactionContextService {
  private readonly als = new AsyncLocalStorage<EntityManager>();

  run<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
    return this.als.run(manager, work);
  }

  getManager(): EntityManager | undefined {
    return this.als.getStore();
  }
}
