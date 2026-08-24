import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VilleRattacheeConsumerService } from '../../../src/referential-engine/infrastructure/messaging/ville-rattachee-consumer.service';
import { COMPTEUR_VILLES_RATTACHEES_REPOSITORY } from '../../../src/referential-engine/domain/repositories/referential-engine.repositories';

const CONFIG_VALUES: Record<string, unknown> = {
  'redis.host': 'localhost',
  'redis.port': 6379,
  'redis.password': undefined,
  'referentialEngineVilles.consumerGroup': 'referential-engine-villes-consumers',
  'referentialEngineVilles.batchSize': 20,
  'referentialEngineVilles.blockMs': 5000,
  'referentialEngineVilles.claimIdleMs': 30000,
  'referentialEngineVilles.claimIntervalMs': 15000,
  'eventBus.streamPrefix': 'gsg.kernel.events',
};

type ConsumerInternals = VilleRattacheeConsumerService & {
  redis: { xack: jest.Mock };
  handleMessage: (id: string, fields: string[]) => Promise<void>;
};

const consumersACloturer: VilleRattacheeConsumerService[] = [];

async function buildConsumer(incrementerMock: jest.Mock, decrementerMock: jest.Mock): Promise<ConsumerInternals> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      VilleRattacheeConsumerService,
      {
        provide: COMPTEUR_VILLES_RATTACHEES_REPOSITORY,
        useValue: { incrementer: incrementerMock, decrementer: decrementerMock, getCompte: jest.fn() },
      },
      { provide: ConfigService, useValue: { get: jest.fn((key: string) => CONFIG_VALUES[key]) } },
    ],
  }).compile();

  const consumer = moduleRef.get(VilleRattacheeConsumerService);
  consumersACloturer.push(consumer);

  const internals = consumer as unknown as ConsumerInternals;
  internals.redis.xack = jest.fn().mockResolvedValue(1);
  return internals;
}

function champsPourType(type: string, chargeUtile: Record<string, unknown>): string[] {
  return [
    'outboxId',
    'evt-1',
    'type',
    type,
    'gsgOrgId',
    '',
    'horodatage',
    new Date().toISOString(),
    'produitSource',
    'gsg-referential',
    'chargeUtile',
    JSON.stringify(chargeUtile),
  ];
}

describe('VilleRattacheeConsumerService (intégration application) — KER-ADM-04, filtrage et compteur', () => {
  afterEach(async () => {
    await Promise.all(consumersACloturer.splice(0).map((c) => c.onModuleDestroy()));
    jest.restoreAllMocks();
  });

  it('ignore et acquitte IMMÉDIATEMENT tout message hors périmètre (ex. identity.user.registered)', async () => {
    const incrementerMock = jest.fn();
    const decrementerMock = jest.fn();
    const consumer = await buildConsumer(incrementerMock, decrementerMock);

    await consumer.handleMessage('1-0', champsPourType('identity.user.registered', {}));

    expect(incrementerMock).not.toHaveBeenCalled();
    expect(decrementerMock).not.toHaveBeenCalled();
    expect(consumer.redis.xack).toHaveBeenCalledWith(
      'gsg.kernel.events',
      'referential-engine-villes-consumers',
      '1-0',
    );
  });

  it('referential.ville.created avec un nœud défini : incrémente ce nœud puis acquitte', async () => {
    const incrementerMock = jest.fn().mockResolvedValue(undefined);
    const decrementerMock = jest.fn();
    const consumer = await buildConsumer(incrementerMock, decrementerMock);

    await consumer.handleMessage(
      '1-0',
      champsPourType('referential.ville.created', { id: 'ville-1', referentielHierarchiqueId: 'noeud-1' }),
    );

    expect(incrementerMock).toHaveBeenCalledWith('noeud-1');
    expect(decrementerMock).not.toHaveBeenCalled();
    expect(consumer.redis.xack).toHaveBeenCalled();
  });

  it('referential.ville.created SANS nœud (referentielHierarchiqueId null) : aucun incrément, acquitte quand même', async () => {
    const incrementerMock = jest.fn();
    const consumer = await buildConsumer(incrementerMock, jest.fn());

    await consumer.handleMessage(
      '1-0',
      champsPourType('referential.ville.created', { id: 'ville-1', referentielHierarchiqueId: null }),
    );

    expect(incrementerMock).not.toHaveBeenCalled();
    expect(consumer.redis.xack).toHaveBeenCalled();
  });

  it('referential.ville.moved : décrémente l\'ANCIEN nœud et incrémente le NOUVEAU', async () => {
    const incrementerMock = jest.fn().mockResolvedValue(undefined);
    const decrementerMock = jest.fn().mockResolvedValue(undefined);
    const consumer = await buildConsumer(incrementerMock, decrementerMock);

    await consumer.handleMessage(
      '1-0',
      champsPourType('referential.ville.moved', {
        id: 'ville-1',
        ancienReferentielHierarchiqueId: 'ancien-noeud',
        nouveauReferentielHierarchiqueId: 'nouveau-noeud',
      }),
    );

    expect(decrementerMock).toHaveBeenCalledWith('ancien-noeud');
    expect(incrementerMock).toHaveBeenCalledWith('nouveau-noeud');
  });

  it('referential.ville.moved vers null (détachement) : décrémente l\'ancien, n\'incrémente rien', async () => {
    const incrementerMock = jest.fn();
    const decrementerMock = jest.fn().mockResolvedValue(undefined);
    const consumer = await buildConsumer(incrementerMock, decrementerMock);

    await consumer.handleMessage(
      '1-0',
      champsPourType('referential.ville.moved', {
        id: 'ville-1',
        ancienReferentielHierarchiqueId: 'ancien-noeud',
        nouveauReferentielHierarchiqueId: null,
      }),
    );

    expect(decrementerMock).toHaveBeenCalledWith('ancien-noeud');
    expect(incrementerMock).not.toHaveBeenCalled();
  });

  it('N\'acquitte PAS si le traitement échoue (reste "pending" pour la réclamation)', async () => {
    const incrementerMock = jest.fn().mockRejectedValue(new Error('Postgres indisponible'));
    const consumer = await buildConsumer(incrementerMock, jest.fn());

    await consumer.handleMessage(
      '1-0',
      champsPourType('referential.ville.created', { id: 'ville-1', referentielHierarchiqueId: 'noeud-1' }),
    );

    expect(consumer.redis.xack).not.toHaveBeenCalled();
  });
});
