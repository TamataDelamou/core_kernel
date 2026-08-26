import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisStreamsConsumerService } from '../../../src/audit/infrastructure/messaging/redis-streams-consumer.service';
import { ProcessStreamEventUseCase } from '../../../src/audit/application/use-cases/process-stream-event.use-case';
import { MoveToDeadLetterUseCase } from '../../../src/audit/application/use-cases/dead-letter.use-cases';

const CONFIG_VALUES: Record<string, unknown> = {
  'redis.host': 'localhost',
  'redis.port': 6379,
  'redis.password': undefined,
  'audit.consumerGroup': 'audit-consumers',
  'audit.batchSize': 10,
  'audit.blockMs': 5000,
  'audit.maxDeliveries': 5,
  'audit.claimIdleMs': 30000,
  'audit.claimIntervalMs': 15000,
  'eventBus.streamPrefix': 'gsg.kernel.events',
};

// Voir la note dans outbox-relay-cycle.spec.ts — même piège, même correctif (Omit avant intersection).
type ConsumerInternals = Omit<RedisStreamsConsumerService, 'redis'> & {
  redis: { xack: jest.Mock };
  handleMessage: (id: string, fields: string[], deliveryAttempt: number) => Promise<void>;
  parseFields: (fields: string[]) => unknown;
};

const consumersACloturer: RedisStreamsConsumerService[] = [];

async function buildConsumer(overrides: {
  processMock?: jest.Mock;
  moveToDeadLetterMock?: jest.Mock;
}): Promise<ConsumerInternals> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RedisStreamsConsumerService,
      {
        provide: ProcessStreamEventUseCase,
        useValue: { execute: overrides.processMock ?? jest.fn().mockResolvedValue(undefined) },
      },
      {
        provide: MoveToDeadLetterUseCase,
        useValue: { execute: overrides.moveToDeadLetterMock ?? jest.fn().mockResolvedValue(undefined) },
      },
      { provide: ConfigService, useValue: { get: jest.fn((key: string) => CONFIG_VALUES[key]) } },
    ],
  }).compile();

  const consumer = moduleRef.get(RedisStreamsConsumerService);
  consumersACloturer.push(consumer);

  const internals = consumer as unknown as ConsumerInternals;
  internals.redis.xack = jest.fn().mockResolvedValue(1);
  return internals;
}

function fieldsFor(overrides: Partial<Record<string, string>> = {}): string[] {
  const base: Record<string, string> = {
    outboxId: 'evt-1',
    type: 'identity.user.registered',
    gsgOrgId: 'org-1',
    horodatage: '2026-01-01T00:00:00.000Z',
    produitSource: 'gsg-id',
    chargeUtile: JSON.stringify({ gsgId: 'user-1' }),
    ...overrides,
  };
  return Object.entries(base).flatMap(([k, v]) => [k, v]);
}

describe('RedisStreamsConsumerService (intégration application) — traitement de message', () => {
  afterEach(async () => {
    await Promise.all(consumersACloturer.splice(0).map((c) => c.onModuleDestroy()));
    jest.restoreAllMocks();
  });

  describe('parseFields', () => {
    it('reconstruit un StreamMessage complet à partir des champs plats Redis', async () => {
      const consumer = await buildConsumer({});
      const message = consumer.parseFields(fieldsFor());

      expect(message).toEqual({
        outboxId: 'evt-1',
        type: 'identity.user.registered',
        gsgOrgId: 'org-1',
        horodatage: '2026-01-01T00:00:00.000Z',
        produitSource: 'gsg-id',
        chargeUtileBrute: JSON.stringify({ gsgId: 'user-1' }),
      });
    });

    it('normalise un gsgOrgId absent ou vide en null (événement global du noyau)', async () => {
      const consumer = await buildConsumer({});
      const message = consumer.parseFields(fieldsFor({ gsgOrgId: '' })) as { gsgOrgId: string | null };

      expect(message.gsgOrgId).toBeNull();
    });
  });

  describe('handleMessage', () => {
    it('acquitte (XACK) le message après un traitement réussi', async () => {
      const processMock = jest.fn().mockResolvedValue(undefined);
      const consumer = await buildConsumer({ processMock });

      await consumer.handleMessage('1-0', fieldsFor(), 1);

      expect(processMock).toHaveBeenCalledTimes(1);
      expect(consumer.redis.xack).toHaveBeenCalledWith('gsg.kernel.events', 'audit-consumers', '1-0');
    });

    it('N\'acquitte PAS le message si le traitement échoue (reste "pending" pour la boucle de réclamation)', async () => {
      const processMock = jest.fn().mockRejectedValue(new Error('Postgres indisponible'));
      const consumer = await buildConsumer({ processMock });

      await consumer.handleMessage('1-0', fieldsFor(), 1);

      expect(consumer.redis.xack).not.toHaveBeenCalled();
    });

    it('un échec de traitement ne fait jamais remonter d\'exception à l\'appelant (boucle de lecture jamais interrompue)', async () => {
      const processMock = jest.fn().mockRejectedValue(new Error('erreur quelconque'));
      const consumer = await buildConsumer({ processMock });

      await expect(consumer.handleMessage('1-0', fieldsFor(), 1)).resolves.toBeUndefined();
    });
  });
});
