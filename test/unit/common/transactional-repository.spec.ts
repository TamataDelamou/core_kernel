import { EntityManager, Repository } from 'typeorm';
import { TransactionContextService } from '../../../src/common/kernel-infrastructure/persistence/transaction-context.service';
import { TransactionalRepository } from '../../../src/common/kernel-infrastructure/persistence/transactional-repository.base';

class FakeEntity {
  id!: string;
}

/** Sous-classe minimale exposant `repo` publiquement pour les besoins du test. */
class TestRepository extends TransactionalRepository<FakeEntity> {
  constructor(defaultRepo: Repository<FakeEntity>, transactionContext: TransactionContextService) {
    super(defaultRepo, transactionContext);
  }

  getResolvedRepo(): Repository<FakeEntity> {
    return this.repo;
  }
}

function buildFakeRepository(label: string): Repository<FakeEntity> {
  return { __label: label, target: FakeEntity } as unknown as Repository<FakeEntity>;
}

describe('TransactionContextService (unitaire) — propagation AsyncLocalStorage', () => {
  it('renvoie undefined hors de tout contexte transactionnel', () => {
    const context = new TransactionContextService();
    expect(context.getManager()).toBeUndefined();
  });

  it('renvoie le manager fourni à l\'intérieur du callback run()', async () => {
    const context = new TransactionContextService();
    const fakeManager = { id: 'manager-1' } as unknown as EntityManager;

    await context.run(fakeManager, async () => {
      expect(context.getManager()).toBe(fakeManager);
    });
  });

  it('propage le manager à travers plusieurs niveaux d\'await imbriqués (le cas réel d\'un use-case)', async () => {
    const context = new TransactionContextService();
    const fakeManager = { id: 'manager-1' } as unknown as EntityManager;

    async function niveauProfond(): Promise<EntityManager | undefined> {
      await new Promise((resolve) => setTimeout(resolve, 0)); // force un vrai passage par la microtask queue
      return context.getManager();
    }

    async function niveauIntermediaire(): Promise<EntityManager | undefined> {
      return niveauProfond();
    }

    const resultat = await context.run(fakeManager, () => niveauIntermediaire());
    expect(resultat).toBe(fakeManager);
  });

  it('n\'affecte jamais le contexte d\'un appel CONCURRENT hors de son propre run()', async () => {
    const context = new TransactionContextService();
    const managerA = { id: 'A' } as unknown as EntityManager;

    const observationsHorsContexte: Array<EntityManager | undefined> = [];

    const appelDansContexte = context.run(managerA, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return context.getManager();
    });

    // Appel concurrent, jamais entré dans un run() — ne doit jamais voir managerA.
    observationsHorsContexte.push(context.getManager());

    const resultatDansContexte = await appelDansContexte;
    expect(resultatDansContexte).toBe(managerA);
    expect(observationsHorsContexte).toEqual([undefined]);
  });
});

describe('TransactionalRepository (unitaire) — résolution dynamique du repository', () => {
  it('retombe sur le repository par défaut hors de toute transaction (ex. OutboxRelayService en tâche de fond)', () => {
    const context = new TransactionContextService();
    const defaultRepo = buildFakeRepository('default');
    const repository = new TestRepository(defaultRepo, context);

    expect(repository.getResolvedRepo()).toBe(defaultRepo);
  });

  it('résout le repository TRANSACTIONNEL quand un contexte est actif (le mécanisme d\'atomicité lui-même)', async () => {
    const context = new TransactionContextService();
    const defaultRepo = buildFakeRepository('default');
    const transactionalRepo = buildFakeRepository('transactionnel');
    const fakeManager = {
      getRepository: jest.fn().mockReturnValue(transactionalRepo),
    } as unknown as EntityManager;

    const repository = new TestRepository(defaultRepo, context);

    await context.run(fakeManager, async () => {
      expect(repository.getResolvedRepo()).toBe(transactionalRepo);
    });
  });

  it('redemande le repository transactionnel à chaque accès (jamais mis en cache entre deux transactions)', async () => {
    const context = new TransactionContextService();
    const defaultRepo = buildFakeRepository('default');
    const repository = new TestRepository(defaultRepo, context);

    const managerA = { getRepository: jest.fn().mockReturnValue(buildFakeRepository('A')) } as unknown as EntityManager;
    const managerB = { getRepository: jest.fn().mockReturnValue(buildFakeRepository('B')) } as unknown as EntityManager;

    let vuDansA: Repository<FakeEntity> | undefined;
    let vuDansB: Repository<FakeEntity> | undefined;

    await context.run(managerA, async () => {
      vuDansA = repository.getResolvedRepo();
    });
    await context.run(managerB, async () => {
      vuDansB = repository.getResolvedRepo();
    });

    expect(vuDansA).not.toBe(vuDansB);
    expect(repository.getResolvedRepo()).toBe(defaultRepo); // retour à la normale après les deux transactions
  });
});
