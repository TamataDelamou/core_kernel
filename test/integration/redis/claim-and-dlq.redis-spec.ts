import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import {
  isolateRedisNamespaceForThisFile,
  createRawTestRedisClient,
  waitUntil,
  testTypeOrmOptions,
} from './redis-test-helpers';
import { AuditEvenementOrmEntity, EvenementEnEchecOrmEntity } from '../../../src/audit/infrastructure/persistence/typeorm/orm-entities';
import { TypeOrmDeadLetterRepository } from '../../../src/audit/infrastructure/persistence/typeorm/orm-repositories';
import { AUDIT_EVENEMENT_REPOSITORY, DEAD_LETTER_REPOSITORY, DeadLetterRepository } from '../../../src/audit/domain/repositories/audit.repositories';
import { ProcessStreamEventUseCase } from '../../../src/audit/application/use-cases/process-stream-event.use-case';
import { MoveToDeadLetterUseCase } from '../../../src/audit/application/use-cases/dead-letter.use-cases';
import { RedisStreamsConsumerService } from '../../../src/audit/infrastructure/messaging/redis-streams-consumer.service';
import { TransactionContextService } from '../../../src/common/kernel-infrastructure/persistence/transaction-context.service';

/**
 * PRÉREQUIS : voir outbox-relay-to-redis.redis-spec.ts.
 *
 * Le point le plus délicat de toute la mécanique Redis Streams du noyau, et celui qui NE
 * PEUT PAS être vérifié par un mock : `ProcessStreamEventUseCase` est ici volontairement
 * remplacé par un mock qui échoue TOUJOURS — pas pour éviter Redis (au contraire, tout le
 * reste — XREADGROUP, non-ACK, XPENDING, XCLAIM, incrémentation réelle du compteur de
 * livraison par Redis lui-même, bascule DLQ, XACK final — reste 100% réel), mais parce que la
 * persistance en base du succès n'est pas ce qui est sous test ici (déjà couvert par le
 * fichier précédent) : c'est le comportement de Redis face à un message qui échoue APRÈS
 * plusieurs réclamations qui l'est.
 */
describe('[Redis physique] Réclamation (XCLAIM) et bascule Dead-Letter Queue', () => {
  let moduleRef: TestingModule;
  let rawRedis: Redis;
  let streamKey: string;
  let consumerGroup: string;
  let deadLetterRepository: DeadLetterRepository;

  beforeAll(async () => {
    const namespace = isolateRedisNamespaceForThisFile();
    streamKey = namespace.streamKey;
    consumerGroup = namespace.consumerGroup;

    // Seuils volontairement bas et cycles rapprochés — accélère le test sans changer la
    // mécanique elle-même (XPENDING/XCLAIM se comportent identiquement quel que soit le seuil).
    process.env.AUDIT_CONSUMER_MAX_DELIVERIES = '2';
    process.env.AUDIT_CONSUMER_CLAIM_IDLE_MS = '400';
    process.env.AUDIT_CONSUMER_CLAIM_INTERVAL_MS = '300';
    process.env.AUDIT_CONSUMER_BLOCK_MS = '500';

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testTypeOrmOptions([AuditEvenementOrmEntity, EvenementEnEchecOrmEntity])),
        TypeOrmModule.forFeature([AuditEvenementOrmEntity, EvenementEnEchecOrmEntity]),
      ],
      providers: [
        TransactionContextService,
        // ProcessStreamEventUseCase mocké : échoue systématiquement, pour forcer le message
        // à rester "pending" et déclencher le cycle réclamation → DLQ sous test.
        { provide: ProcessStreamEventUseCase, useValue: { execute: jest.fn().mockRejectedValue(new Error('échec simulé volontaire')) } },
        { provide: AUDIT_EVENEMENT_REPOSITORY, useValue: { existsByEvenementId: jest.fn().mockResolvedValue(false) } },
        { provide: DEAD_LETTER_REPOSITORY, useClass: TypeOrmDeadLetterRepository },
        MoveToDeadLetterUseCase,
        RedisStreamsConsumerService,
      ],
    }).compile();

    await moduleRef.init();
    rawRedis = createRawTestRedisClient();
    deadLetterRepository = moduleRef.get(DEAD_LETTER_REPOSITORY);
  });

  afterAll(async () => {
    await rawRedis.quit();
    await moduleRef.close();
  });

  it('un message qui échoue systématiquement finit par être réclamé PUIS basculé en DLQ, et acquitté', async () => {
    const outboxId = uuidv4();

    await rawRedis.xadd(
      streamKey,
      '*',
      'outboxId',
      outboxId,
      'type',
      'test.redis_physical.claim_and_dlq',
      'gsgOrgId',
      '',
      'horodatage',
      new Date().toISOString(),
      'produitSource',
      'test-redis-physical',
      'chargeUtile',
      JSON.stringify({}),
    );

    // Attend l'apparition de l'entrée DLQ correspondante — ce qui ne peut arriver qu'après :
    // 1) lecture initiale (échec, non-ACK), 2) au moins un cycle XPENDING+XCLAIM (réclamation,
    // le compteur de livraison Redis passe à 2), 3) un cycle suivant où XPENDING rapporte un
    // compteur strictement supérieur à AUDIT_CONSUMER_MAX_DELIVERIES=2, déclenchant la bascule.
    const entreeDlq = await waitUntil(
      async () => {
        const { elements } = await deadLetterRepository.list({ page: 1, tailleParPage: 50 });
        return elements.find((e) => e.evenementId === outboxId) ?? null;
      },
      { timeoutMs: 15000, intervalMs: 300, description: `entrée DLQ pour l'événement ${outboxId}` },
    );

    const snapshot = entreeDlq.toSnapshot();
    expect(snapshot.tentatives).toBeGreaterThan(2);
    expect(snapshot.derniereErreur).toContain('tentatives de livraison dépassé');

    // Le message poison a-t-il été retiré de la liste des messages en attente (XACK final
    // après bascule DLQ) ? Sans ce XACK, le message resterait indéfiniment "pending" malgré
    // sa présence en DLQ — un bug de fuite que seul un test physique révélerait.
    const resumePending = await rawRedis.xpending(streamKey, consumerGroup);
    const nombreEnAttente = Array.isArray(resumePending) ? Number(resumePending[0]) : 0;
    expect(nombreEnAttente).toBe(0);
  }, 20000);
});
