import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { firstValueFrom, from, Observable } from 'rxjs';
import { TRANSACTION_MANAGER, TransactionManager } from '../kernel-ports/transaction-manager.port';

const METHODES_ECRITURE = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Applique le pattern Transactional Outbox de façon systémique, sans toucher un seul
 * use-case : toute requête HTTP d'écriture est exécutée à l'intérieur d'une unique
 * transaction Postgres. Grâce à TransactionContextService (propagation par AsyncLocalStorage)
 * et TransactionalRepository (résolution dynamique de l'EntityManager ambiant), la sauvegarde
 * de l'entité métier ET l'insertion dans `evenement_outbox` — deux appels de repository
 * indépendants dans le code du use-case, sans lien explicite entre eux — finissent par
 * s'exécuter dans la MÊME transaction : soit les deux sont commit ensemble, soit un échec
 * quelconque (violation de contrainte, exception métier) fait tout annuler ensemble. C'est
 * la garantie d'atomicité qui manquait à l'implémentation initiale de l'Outbox.
 *
 * Enregistré globalement (APP_INTERCEPTOR, voir app.module.ts) — couvre les 5 modules du
 * noyau sans qu'aucun contrôleur n'ait à le déclarer explicitement. Les requêtes de lecture
 * (GET) ne sont jamais englobées dans une transaction : aucun bénéfice d'atomicité à en tirer,
 * coût inutile évité.
 */
@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(@Inject(TRANSACTION_MANAGER) private readonly transactionManager: TransactionManager) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (!METHODES_ECRITURE.has(request.method)) {
      return next.handle();
    }

    return from(this.transactionManager.runInTransaction(() => firstValueFrom(next.handle())));
  }
}
