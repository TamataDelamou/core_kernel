import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  isolateRedisNamespaceForThisFile,
  createRawTestRedisClient,
  waitUntil,
  testTypeOrmOptions,
} from './redis-test-helpers';
import { OutboxEventOrmEntity } from '../../../src/common/kernel-infrastructure/outbox/outbox-event.orm-entity';
import {
  OUTBOX_EVENT_REPOSITORY,
  TypeOrmOutboxEventRepository,
} from '../../../src/common/kernel-infrastructure/outbox/outbox-event.repository';
import { OutboxRelayService } from '../../../src/common/kernel-infrastructure/outbox/outbox-relay.service';
import { OutboxEventPublisherService } from '../../../src/common/kernel-infrastructure/messaging/outbox-event-publisher.service';
import { EVENT_PUBLISHER, EventPublisher } from '../../../src/common/kernel-ports/event-publisher.interface';
import { TransactionContextService } from '../../../src/common/kernel-infrastructure/persistence/transaction-context.service';
import Redis from 'ioredis';

/**
 * PRÉREQUIS : `docker compose up -d` (PostgreSQL + Redis réels) et `npm run migration:run`
 * exécutés au préalable — voir README section Tests. Non exécuté par `npm test` (mocks
 * uniquement), lancé séparément via `npm run test:redis` (jest-redis.json), précisément parce
 * qu'il dépend de services externes réels — même principe que `test:e2e`.
 *
 * Ce fichier valide physiquement l'affirmation centrale de la Priorité 1 de la passe
 * précédente : un événement publié via le port EVENT_PUBLISHER finit RÉELLEMENT par
 * apparaître sur le flux Redis, via le cycle de relais Outbox — pas seulement "l'insertion
 * outbox a été appelée" (déjà couvert par les tests mockés), mais "le message existe belle et
 * bien dans Redis, avec les bons champs".
 */
describe('[Redis physique] Outbox → Redis Streams (OutboxRelayService)', () => {
  let moduleRef: TestingModule;
  let eventPublisher: EventPublisher;
  let rawRedis: Redis;
  let streamKey: string;

  beforeAll(async () => {
    const namespace = isolateRedisNamespaceForThisFile();
    streamKey = namespace.streamKey;
    // Cycle de relais accéléré pour un test rapide — le comportement en production
    // (OUTBOX_POLL_INTERVAL_MS=1000 par défaut) n'est pas ce qui est sous test ici, seule la
    // mécanique du cycle (lecture outbox → XADD → marquage publié) l'est.
    process.env.OUTBOX_POLL_INTERVAL_MS = '200';

    moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(testTypeOrmOptions([OutboxEventOrmEntity])), TypeOrmModule.forFeature([OutboxEventOrmEntity])],
      providers: [
        TransactionContextService,
        { provide: OUTBOX_EVENT_REPOSITORY, useClass: TypeOrmOutboxEventRepository },
        { provide: EVENT_PUBLISHER, useClass: OutboxEventPublisherService },
        OutboxRelayService,
      ],
    }).compile();

    await moduleRef.init(); // déclenche OutboxRelayService.onModuleInit (démarre le cycle réel)
    eventPublisher = moduleRef.get(EVENT_PUBLISHER);
    rawRedis = createRawTestRedisClient();
  });

  afterAll(async () => {
    await rawRedis.quit();
    await moduleRef.close();
  });

  it('un événement publié via EVENT_PUBLISHER apparaît réellement sur le flux Redis après relais', async () => {
    const marqueur = `test-outbox-relay-${uuidv4()}`;

    await eventPublisher.publish({
      type: 'test.redis_physical.outbox_relay',
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'test-redis-physical',
      chargeUtile: { marqueur },
    });

    const entree = await waitUntil(
      async () => {
        const messages = await rawRedis.xrange(streamKey, '-', '+');
        return messages.find(([, fields]) => {
          const index = fields.indexOf('chargeUtile');
          return index !== -1 && (fields[index + 1] ?? '').includes(marqueur);
        });
      },
      { timeoutMs: 5000, intervalMs: 150, description: `message avec marqueur "${marqueur}" sur ${streamKey}` },
    );

    const [, fields] = entree;
    const map = new Map<string, string>();
    for (let i = 0; i < fields.length; i += 2) map.set(fields[i], fields[i + 1]);

    expect(map.get('type')).toBe('test.redis_physical.outbox_relay');
    expect(map.get('produitSource')).toBe('test-redis-physical');
    expect(JSON.parse(map.get('chargeUtile') as string)).toEqual({ marqueur });
  }, 10000);
});
