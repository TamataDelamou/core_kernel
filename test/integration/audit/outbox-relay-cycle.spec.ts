import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OutboxRelayService } from '../../../src/common/kernel-infrastructure/outbox/outbox-relay.service';
import { OUTBOX_EVENT_REPOSITORY } from '../../../src/common/kernel-infrastructure/outbox/outbox-event.repository';

const CONFIG_VALUES: Record<string, unknown> = {
  'redis.host': 'localhost',
  'redis.port': 6379,
  'redis.password': undefined,
  'outbox.pollIntervalMs': 1000,
  'outbox.batchSize': 50,
  'outbox.maxRetries': 10,
  'eventBus.streamPrefix': 'gsg.kernel.events',
};

type RelayInternals = OutboxRelayService & {
  redis: { xadd: jest.Mock };
  runCycle: () => Promise<void>;
  sweepPermanentFailures: () => Promise<void>;
};

/**
 * OutboxRelayService instancie une vraie connexion ioredis dans son constructeur (non
 * injectée — cohérent avec le pattern déjà établi par les autres services messagerie du
 * projet). Sans nettoyage explicite, chaque relay créé dans un test laisserait une connexion
 * tenter de se reconnecter indéfiniment en arrière-plan après la fin du test. Toutes les
 * instances créées dans ce fichier sont donc suivies et fermées dans `afterEach`.
 */
const relaysACloturer: OutboxRelayService[] = [];

async function buildRelay(outboxRepoMock: Partial<Record<string, jest.Mock>>): Promise<RelayInternals> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      OutboxRelayService,
      {
        provide: OUTBOX_EVENT_REPOSITORY,
        useValue: {
          findPendingBatch: jest.fn().mockResolvedValue([]),
          markPublished: jest.fn(),
          markFailedAttempt: jest.fn(),
          markPermanentlyFailed: jest.fn().mockResolvedValue(0),
          countByStatut: jest.fn(),
          ...outboxRepoMock,
        },
      },
      { provide: ConfigService, useValue: { get: jest.fn((key: string) => CONFIG_VALUES[key]) } },
    ],
  }).compile();

  const relay = moduleRef.get(OutboxRelayService);
  relaysACloturer.push(relay);

  const internals = relay as unknown as RelayInternals;
  // xadd est remplacé sur l'instance ioredis interne réelle — ce test isole la logique de
  // cycle (retry, marquage de statut) sans dépendre d'un serveur Redis effectivement disponible.
  internals.redis.xadd = jest.fn().mockResolvedValue('1-0');
  return internals;
}

describe('OutboxRelayService (intégration application) — cycle de relais', () => {
  afterEach(async () => {
    await Promise.all(relaysACloturer.splice(0).map((relay) => relay.onModuleDestroy()));
    jest.restoreAllMocks();
  });

  it('publie chaque ligne du lot en attente puis la marque "publie" en cas de succès', async () => {
    const markPublishedMock = jest.fn().mockResolvedValue(undefined);
    const ligne = {
      id: 'evt-1',
      type: 'identity.user.registered',
      gsgOrgId: null,
      horodatage: new Date('2026-01-01T00:00:00Z'),
      produitSource: 'gsg-id',
      chargeUtile: { gsgId: 'user-1' },
      statut: 'en_attente' as const,
      tentatives: 0,
      derniereErreur: null,
      creeLe: new Date(),
      publieLe: null,
    };

    const relay = await buildRelay({
      findPendingBatch: jest.fn().mockResolvedValue([ligne]),
      markPublished: markPublishedMock,
    });

    await relay.runCycle();

    expect(markPublishedMock).toHaveBeenCalledWith('evt-1');
    expect(relay.redis.xadd).toHaveBeenCalledTimes(1);
  });

  it('marque une tentative échouée sans jamais faire planter le cycle (les lignes suivantes sont quand même traitées)', async () => {
    const markFailedAttemptMock = jest.fn().mockResolvedValue(undefined);
    const markPublishedMock = jest.fn().mockResolvedValue(undefined);

    const ligneEnEchec = {
      id: 'evt-echec',
      type: 'identity.user.registered',
      gsgOrgId: null,
      horodatage: new Date(),
      produitSource: 'gsg-id',
      chargeUtile: {},
      statut: 'en_attente' as const,
      tentatives: 2,
      derniereErreur: null,
      creeLe: new Date(),
      publieLe: null,
    };
    const ligneEnSucces = { ...ligneEnEchec, id: 'evt-succes' };

    const relay = await buildRelay({
      findPendingBatch: jest.fn().mockResolvedValue([ligneEnEchec, ligneEnSucces]),
      markFailedAttempt: markFailedAttemptMock,
      markPublished: markPublishedMock,
    });

    relay.redis.xadd = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce('1-0');

    await relay.runCycle();

    expect(markFailedAttemptMock).toHaveBeenCalledWith('evt-echec', expect.stringContaining('ECONNREFUSED'));
    expect(markPublishedMock).toHaveBeenCalledWith('evt-succes');
  });

  it('un cycle déjà en cours n\'en démarre pas un second en parallèle (protection de ré-entrance)', async () => {
    let resolveFindPending: (value: unknown[]) => void = () => {};
    const findPendingBatchMock = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFindPending = resolve; }),
    );

    const relay = await buildRelay({ findPendingBatch: findPendingBatchMock });

    const premierCycle = relay.runCycle();
    const secondCycle = relay.runCycle(); // déclenché avant que le premier n'ait fini

    resolveFindPending([]);
    await Promise.all([premierCycle, secondCycle]);

    // Le second appel doit avoir été absorbé immédiatement sans relancer findPendingBatch.
    expect(findPendingBatchMock).toHaveBeenCalledTimes(1);
  });

  it('signale les échecs permanents lors du balayage périodique sans lever d\'exception', async () => {
    const relay = await buildRelay({
      markPermanentlyFailed: jest.fn().mockResolvedValue(3),
    });

    await expect(relay.sweepPermanentFailures()).resolves.toBeUndefined();
  });

  it('un échec du balayage ne lève jamais d\'exception vers l\'appelant (setInterval ne doit jamais crasher)', async () => {
    const relay = await buildRelay({
      markPermanentlyFailed: jest.fn().mockRejectedValue(new Error('Postgres indisponible')),
    });

    await expect(relay.sweepPermanentFailures()).resolves.toBeUndefined();
  });
});
