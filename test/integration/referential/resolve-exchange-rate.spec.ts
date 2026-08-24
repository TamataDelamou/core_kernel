import { Test } from '@nestjs/testing';
import {
  ResolveExchangeRateUseCase,
  SetTauxChangeUseCase,
} from '../../../src/referential/application/use-cases/taux-change.use-cases';
import {
  DEVISE_REPOSITORY,
  TAUX_CHANGE_REPOSITORY,
} from '../../../src/referential/domain/repositories/referential.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { NoValidExchangeRateError, DeviseNotFoundError } from '../../../src/referential/domain/exceptions/referential.exceptions';
import { Devise } from '../../../src/referential/domain/entities/devise-et-langue.entity';
import { TauxChange } from '../../../src/referential/domain/entities/relations.entity';

const deviseXof = Devise.create({ id: 'devise-xof', codeIso4217: 'XOF', nom: 'Franc CFA', decimales: 0 });
const deviseEur = Devise.create({ id: 'devise-eur', codeIso4217: 'EUR', nom: 'Euro', decimales: 2 });

describe('ResolveExchangeRateUseCase (intégration application) — KER-REF-04', () => {
  it('résout un taux valide à l\'instant demandé', async () => {
    const tauxExistant = TauxChange.create({
      id: 'taux-1',
      deviseBaseId: 'devise-xof',
      deviseCibleId: 'devise-eur',
      taux: '655.957',
      validDu: new Date('2026-01-01T00:00:00Z'),
      validAu: null,
      source: 'BCEAO',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolveExchangeRateUseCase,
        {
          provide: TAUX_CHANGE_REPOSITORY,
          useValue: { findByPaire: jest.fn().mockResolvedValue([tauxExistant]) },
        },
      ],
    }).compile();

    const useCase = moduleRef.get(ResolveExchangeRateUseCase);
    const result = await useCase.execute({
      deviseBaseId: 'devise-xof',
      deviseCibleId: 'devise-eur',
      instant: new Date('2026-03-01T00:00:00Z'),
    });

    expect(result.taux).toBe('655.957');
    expect(result.source).toBe('BCEAO');
  });

  it('REFUSE explicitement quand aucun taux valide n\'existe — jamais de parité 1:1 implicite', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolveExchangeRateUseCase,
        { provide: TAUX_CHANGE_REPOSITORY, useValue: { findByPaire: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    const useCase = moduleRef.get(ResolveExchangeRateUseCase);

    await expect(
      useCase.execute({ deviseBaseId: 'devise-xof', deviseCibleId: 'devise-eur' }),
    ).rejects.toThrow(NoValidExchangeRateError);
  });

  it('REFUSE si un taux existe pour la paire mais hors de sa fenêtre de validité', async () => {
    const tauxExpire = TauxChange.create({
      id: 'taux-1',
      deviseBaseId: 'devise-xof',
      deviseCibleId: 'devise-eur',
      taux: '650.000',
      validDu: new Date('2020-01-01T00:00:00Z'),
      validAu: new Date('2021-01-01T00:00:00Z'),
      source: 'BCEAO',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolveExchangeRateUseCase,
        { provide: TAUX_CHANGE_REPOSITORY, useValue: { findByPaire: jest.fn().mockResolvedValue([tauxExpire]) } },
      ],
    }).compile();

    const useCase = moduleRef.get(ResolveExchangeRateUseCase);

    await expect(
      useCase.execute({
        deviseBaseId: 'devise-xof',
        deviseCibleId: 'devise-eur',
        instant: new Date('2026-01-01T00:00:00Z'),
      }),
    ).rejects.toThrow(NoValidExchangeRateError);
  });

  it('renvoie une identité (taux "1") pour une devise convertie vers elle-même, sans consulter le repository', async () => {
    const findByPaireMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolveExchangeRateUseCase,
        { provide: TAUX_CHANGE_REPOSITORY, useValue: { findByPaire: findByPaireMock } },
      ],
    }).compile();

    const useCase = moduleRef.get(ResolveExchangeRateUseCase);
    const result = await useCase.execute({ deviseBaseId: 'devise-xof', deviseCibleId: 'devise-xof' });

    expect(result.taux).toBe('1');
    expect(findByPaireMock).not.toHaveBeenCalled();
  });

  it('choisit le taux valide parmi plusieurs candidats historiques pour la même paire', async () => {
    const ancien = TauxChange.create({
      id: 'taux-ancien',
      deviseBaseId: 'devise-xof',
      deviseCibleId: 'devise-eur',
      taux: '600.000',
      validDu: new Date('2024-01-01T00:00:00Z'),
      validAu: new Date('2025-01-01T00:00:00Z'),
      source: 'BCEAO',
    });
    const actuel = TauxChange.create({
      id: 'taux-actuel',
      deviseBaseId: 'devise-xof',
      deviseCibleId: 'devise-eur',
      taux: '655.957',
      validDu: new Date('2025-01-01T00:00:00Z'),
      validAu: null,
      source: 'BCEAO',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolveExchangeRateUseCase,
        { provide: TAUX_CHANGE_REPOSITORY, useValue: { findByPaire: jest.fn().mockResolvedValue([ancien, actuel]) } },
      ],
    }).compile();

    const useCase = moduleRef.get(ResolveExchangeRateUseCase);
    const result = await useCase.execute({
      deviseBaseId: 'devise-xof',
      deviseCibleId: 'devise-eur',
      instant: new Date('2026-01-01T00:00:00Z'),
    });

    expect(result.taux).toBe('655.957');
  });
});

describe('SetTauxChangeUseCase (intégration application)', () => {
  it('refuse d\'enregistrer un taux référençant une devise inconnue', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SetTauxChangeUseCase,
        { provide: DEVISE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(null) } },
        { provide: TAUX_CHANGE_REPOSITORY, useValue: { save: jest.fn() } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(SetTauxChangeUseCase);

    await expect(
      useCase.execute({
        deviseBaseId: 'devise-inconnue',
        deviseCibleId: 'devise-eur',
        taux: '655.957',
        validDu: new Date(),
        source: 'BCEAO',
      }),
    ).rejects.toThrow(DeviseNotFoundError);
  });

  it('enregistre et publie un événement quand les deux devises existent', async () => {
    const publishMock = jest.fn().mockResolvedValue(undefined);
    const saveMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SetTauxChangeUseCase,
        {
          provide: DEVISE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockImplementation((id: string) =>
              Promise.resolve(id === 'devise-xof' ? deviseXof : deviseEur),
            ),
          },
        },
        { provide: TAUX_CHANGE_REPOSITORY, useValue: { save: saveMock } },
        { provide: EVENT_PUBLISHER, useValue: { publish: publishMock } },
      ],
    }).compile();

    const useCase = moduleRef.get(SetTauxChangeUseCase);
    await useCase.execute({
      deviseBaseId: 'devise-xof',
      deviseCibleId: 'devise-eur',
      taux: '655.957',
      validDu: new Date(),
      source: 'BCEAO',
    });

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledTimes(1);
  });
});
