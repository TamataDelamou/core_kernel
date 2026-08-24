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
import {
  TypeOrmAuditEvenementRepository,
  TypeOrmDeadLetterRepository,
} from '../../../src/audit/infrastructure/persistence/typeorm/orm-repositories';
import { AUDIT_EVENEMENT_REPOSITORY, DEAD_LETTER_REPOSITORY } from '../../../src/audit/domain/repositories/audit.repositories';
import { ProcessStreamEventUseCase } from '../../../src/audit/application/use-cases/process-stream-event.use-case';
import { MoveToDeadLetterUseCase } from '../../../src/audit/application/use-cases/dead-letter.use-cases';
import { RedisStreamsConsumerService } from '../../../src/audit/infrastructure/messaging/redis-streams-consumer.service';
import { TransactionContextService } from '../../../src/common/kernel-infrastructure/persistence/transaction-context.service';

/**
 * PRÉREQUIS : voir outbox-relay-to-redis.redis-spec.ts. Valide physiquement la boucle de
 * lecture RÉELLE (`XREADGROUP ... BLOCK`) de RedisStreamsConsumerService : un message ajouté
 * au flux par un simple XADD externe (simulant OutboxRelayService, sans en dépendre ici — un
 * seul maillon à la fois) est effectivement lu, persisté dans `audit_evenement`, ET acquitté
 * (XACK) — les trois affirmations que les tests mockés ne peuvent PAS vérifier ensemble.
 */
describe('[Redis physique] Consumer Group — lecture, persistance, ACK réels', () => {
  let moduleRef: TestingModule;
  let rawRedis: Redis;
  let streamKey: string;
  let consumerGroup: string;

  beforeAll(async () => {
    const namespace = isolateRedisNamespaceForThisFile();
    streamKey = namespace.streamKey;
    consumerGroup = namespace.consumerGroup;
    process.env.AUDIT_CONSUMER_BLOCK_MS = '1000';

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testTypeOrmOptions([AuditEvenementOrmEntity, EvenementEnEchecOrmEntity])),
        TypeOrmModule.forFeature([AuditEvenementOrmEntity, EvenementEnEchecOrmEntity]),
      ],
      providers: [
        TransactionContextService,
        { provide: AUDIT_EVENEMENT_REPOSITORY, useClass: TypeOrmAuditEvenementRepository },
        { provide: DEAD_LETTER_REPOSITORY, useClass: TypeOrmDeadLetterRepository },
        ProcessStreamEventUseCase,
        MoveToDeadLetterUseCase,
        RedisStreamsConsumerService,
      ],
    }).compile();

    // .init() attend la fin de onModuleInit, qui attend lui-même ensureConsumerGroupExists()
    // AVANT de démarrer la boucle de lecture — le groupe existe donc garantiment avant tout
    // XADD envoyé ci-dessous (élimine la course classique XADD-avant-XGROUP-CREATE).
    await moduleRef.init();
    rawRedis = createRawTestRedisClient();
  });

  afterAll(async () => {
    await rawRedis.quit();
    await moduleRef.close();
  });

  it('un message XADD est lu, persisté dans audit_evenement, puis acquitté (XPENDING = 0)', async () => {
    const outboxId = uuidv4();
    const horodatage = new Date().toISOString();

    await rawRedis.xadd(
      streamKey,
      '*',
      'outboxId',
      outboxId,
      'type',
      'test.redis_physical.consumer_loop',
      'gsgOrgId',
      '',
      'horodatage',
      horodatage,
      'produitSource',
      'test-redis-physical',
      'chargeUtile',
      JSON.stringify({ valeur: 42 }),
    );

    const auditEvenementRepository = moduleRef.get(AUDIT_EVENEMENT_REPOSITORY);

    await waitUntil(
      async () => (await auditEvenementRepository.existsByEvenementId(outboxId)) || null,
      { timeoutMs: 5000, intervalMs: 150, description: `persistance de l'événement ${outboxId} dans audit_evenement` },
    );

    // Le message a-t-il été RÉELLEMENT acquitté ? C'est le point que seul un test physique
    // peut vérifier — un mock de handleMessage() ne peut jamais confirmer un XACK réel.
    const resumePending = await rawRedis.xpending(streamKey, consumerGroup);
    const nombreEnAttente = Array.isArray(resumePending) ? Number(resumePending[0]) : 0;
    expect(nombreEnAttente).toBe(0);
  }, 10000);
});
