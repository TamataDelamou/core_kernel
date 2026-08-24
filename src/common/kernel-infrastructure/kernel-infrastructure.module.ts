import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EVENT_PUBLISHER } from '../kernel-ports/event-publisher.interface';
import { TRANSACTION_MANAGER } from '../kernel-ports/transaction-manager.port';
import { OutboxEventPublisherService } from './messaging/outbox-event-publisher.service';
import { OutboxEventOrmEntity } from './outbox/outbox-event.orm-entity';
import { OUTBOX_EVENT_REPOSITORY, TypeOrmOutboxEventRepository } from './outbox/outbox-event.repository';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { TypeOrmTransactionManager } from './persistence/typeorm-transaction-manager.service';
import { TransactionContextService } from './persistence/transaction-context.service';

/**
 * Regroupe les implémentations concrètes des ports transverses du noyau (KER-EVT-01)
 * partagées par toutes les briques (GSG ID, GSG Referential, Org Registry, Product Catalog,
 * Audit). @Global() évite qu'une même connexion Redis Streams soit ouverte en double par
 * chaque module consommateur, et rend TransactionContextService disponible à tout repository
 * de tout module sans import explicite — condition nécessaire pour que TransactionalRepository
 * fonctionne de façon transparente partout (voir transactional-repository.base.ts).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventOrmEntity])],
  providers: [
    { provide: EVENT_PUBLISHER, useClass: OutboxEventPublisherService },
    { provide: OUTBOX_EVENT_REPOSITORY, useClass: TypeOrmOutboxEventRepository },
    { provide: TRANSACTION_MANAGER, useClass: TypeOrmTransactionManager },
    TransactionContextService,
    OutboxRelayService,
  ],
  exports: [EVENT_PUBLISHER, TRANSACTION_MANAGER, TransactionContextService],
})
export class KernelInfrastructureModule {}
