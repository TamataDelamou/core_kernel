import { Test } from '@nestjs/testing';
import { SetLocaleParDefautUseCase } from '../../../src/referential/application/use-cases/locale.use-cases';
import { LOCALE_REPOSITORY } from '../../../src/referential/domain/repositories/referential.repositories';
import { LocaleNotFoundError } from '../../../src/referential/domain/exceptions/referential.exceptions';
import { Locale } from '../../../src/referential/domain/entities/locale-et-traduction.entity';

describe('SetLocaleParDefautUseCase (intégration application) — invariant "une seule locale par défaut"', () => {
  it('REFUSE si la locale ciblée n\'existe pas', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SetLocaleParDefautUseCase,
        { provide: LOCALE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    const useCase = moduleRef.get(SetLocaleParDefautUseCase);
    await expect(useCase.execute('locale-inexistante')).rejects.toThrow(LocaleNotFoundError);
  });

  it('retire le statut de l\'ANCIEN défaut avant de poser le NOUVEAU (deux sauvegardes distinctes)', async () => {
    const ancienneLocaleParDefaut = Locale.create({ id: 'ancienne', code: 'en-US', libelle: 'English (US)' });
    ancienneLocaleParDefaut.marquerCommeDefaut();
    const nouvelleLocale = Locale.create({ id: 'nouvelle', code: 'fr-GN', libelle: 'Français (Guinée)' });

    const saveMock = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        SetLocaleParDefautUseCase,
        {
          provide: LOCALE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockResolvedValue(nouvelleLocale),
            findParDefaut: jest.fn().mockResolvedValue(ancienneLocaleParDefaut),
            save: saveMock,
          },
        },
      ],
    }).compile();

    const useCase = moduleRef.get(SetLocaleParDefautUseCase);
    await useCase.execute('nouvelle');

    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(saveMock.mock.calls[0][0].estParDefaut).toBe(false);
    expect(saveMock.mock.calls[1][0].estParDefaut).toBe(true);
  });

  it('ne fait qu\'UNE sauvegarde si aucune locale par défaut n\'existait déjà', async () => {
    const nouvelleLocale = Locale.create({ id: 'nouvelle', code: 'fr-GN', libelle: 'X' });
    const saveMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SetLocaleParDefautUseCase,
        {
          provide: LOCALE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockResolvedValue(nouvelleLocale),
            findParDefaut: jest.fn().mockResolvedValue(null),
            save: saveMock,
          },
        },
      ],
    }).compile();

    const useCase = moduleRef.get(SetLocaleParDefautUseCase);
    await useCase.execute('nouvelle');

    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('ne fait qu\'UNE sauvegarde si la locale ciblée est déjà celle par défaut (idempotence)', async () => {
    const dejaParDefaut = Locale.create({ id: 'deja-par-defaut', code: 'fr-GN', libelle: 'X' });
    dejaParDefaut.marquerCommeDefaut();
    const saveMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SetLocaleParDefautUseCase,
        {
          provide: LOCALE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockResolvedValue(dejaParDefaut),
            findParDefaut: jest.fn().mockResolvedValue(dejaParDefaut),
            save: saveMock,
          },
        },
      ],
    }).compile();

    const useCase = moduleRef.get(SetLocaleParDefautUseCase);
    await useCase.execute('deja-par-defaut');

    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
