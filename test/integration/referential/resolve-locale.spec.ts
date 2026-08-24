import { Test } from '@nestjs/testing';
import { ReferentialDefaultsLookupAdapter } from '../../../src/referential/infrastructure/adapters/referential-defaults-lookup.adapter';
import {
  DEVISE_REPOSITORY,
  LANGUE_REPOSITORY,
  LOCALE_REPOSITORY,
  PAYS_DEVISE_REPOSITORY,
  PAYS_LANGUE_REPOSITORY,
  PAYS_REPOSITORY,
} from '../../../src/referential/domain/repositories/referential.repositories';
import { Locale } from '../../../src/referential/domain/entities/locale-et-traduction.entity';

function localeActive(code: string): Locale {
  return Locale.create({ id: `locale-${code}`, code, libelle: code });
}

function localeInactive(code: string): Locale {
  const locale = Locale.create({ id: `locale-${code}`, code, libelle: code });
  locale.deactivate();
  return locale;
}

async function buildAdapter(findByCodeMock: jest.Mock, findParDefautMock: jest.Mock) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      ReferentialDefaultsLookupAdapter,
      { provide: PAYS_REPOSITORY, useValue: { findById: jest.fn() } },
      { provide: DEVISE_REPOSITORY, useValue: { findById: jest.fn() } },
      { provide: LANGUE_REPOSITORY, useValue: { findById: jest.fn() } },
      { provide: PAYS_DEVISE_REPOSITORY, useValue: { findPrincipaleActive: jest.fn() } },
      { provide: PAYS_LANGUE_REPOSITORY, useValue: { findByPays: jest.fn() } },
      { provide: LOCALE_REPOSITORY, useValue: { findByCode: findByCodeMock, findParDefaut: findParDefautMock } },
    ],
  }).compile();

  return moduleRef.get(ReferentialDefaultsLookupAdapter);
}

describe('ReferentialDefaultsLookupAdapter.resolveLocale (intégration application) — KER-NOM-04, repli en 3 temps', () => {
  it('niveau 1 : la combinaison EXACTE langue-pays existe et est active — utilisée directement', async () => {
    const findByCodeMock = jest.fn().mockImplementation((code: string) =>
      Promise.resolve(code === 'fr-GN' ? localeActive('fr-GN') : null),
    );
    const adapter = await buildAdapter(findByCodeMock, jest.fn());

    const resultat = await adapter.resolveLocale('fr', 'GN');

    expect(resultat).toBe('fr-GN');
    expect(findByCodeMock).toHaveBeenCalledWith('fr-GN');
  });

  it('niveau 2 : la combinaison exacte n\'existe pas, mais la langue seule si', async () => {
    const findByCodeMock = jest.fn().mockImplementation((code: string) =>
      Promise.resolve(code === 'fr' ? localeActive('fr') : null),
    );
    const adapter = await buildAdapter(findByCodeMock, jest.fn());

    const resultat = await adapter.resolveLocale('fr', 'GN');

    expect(resultat).toBe('fr');
    expect(findByCodeMock).toHaveBeenCalledWith('fr-GN');
    expect(findByCodeMock).toHaveBeenCalledWith('fr');
  });

  it('niveau 2 refuse une locale langue-seule DÉSACTIVÉE — continue vers le niveau 3', async () => {
    const findByCodeMock = jest.fn().mockImplementation((code: string) =>
      Promise.resolve(code === 'fr' ? localeInactive('fr') : null),
    );
    const findParDefautMock = jest.fn().mockResolvedValue(localeActive('en-US'));
    const adapter = await buildAdapter(findByCodeMock, findParDefautMock);

    const resultat = await adapter.resolveLocale('fr', 'GN');

    expect(resultat).toBe('en-US');
  });

  it('niveau 3 : ni combinaison exacte ni langue seule — repli sur la locale par défaut du noyau', async () => {
    const findByCodeMock = jest.fn().mockResolvedValue(null);
    const findParDefautMock = jest.fn().mockResolvedValue(localeActive('en-US'));
    const adapter = await buildAdapter(findByCodeMock, findParDefautMock);

    const resultat = await adapter.resolveLocale('fr', 'GN');

    expect(resultat).toBe('en-US');
  });

  it('renvoie null si absolument aucune locale n\'est configurée nulle part (premier démarrage)', async () => {
    const findByCodeMock = jest.fn().mockResolvedValue(null);
    const findParDefautMock = jest.fn().mockResolvedValue(null);
    const adapter = await buildAdapter(findByCodeMock, findParDefautMock);

    const resultat = await adapter.resolveLocale('fr', 'GN');

    expect(resultat).toBeNull();
  });

  it('renvoie null si la locale par défaut existe mais est désactivée', async () => {
    const findByCodeMock = jest.fn().mockResolvedValue(null);
    const findParDefautMock = jest.fn().mockResolvedValue(localeInactive('en-US'));
    const adapter = await buildAdapter(findByCodeMock, findParDefautMock);

    const resultat = await adapter.resolveLocale('fr', 'GN');

    expect(resultat).toBeNull();
  });

  it('sans langueCode ni paysCode : saute directement au niveau 3 (défaut du noyau)', async () => {
    const findByCodeMock = jest.fn();
    const findParDefautMock = jest.fn().mockResolvedValue(localeActive('en-US'));
    const adapter = await buildAdapter(findByCodeMock, findParDefautMock);

    const resultat = await adapter.resolveLocale(null, null);

    expect(findByCodeMock).not.toHaveBeenCalled();
    expect(resultat).toBe('en-US');
  });
});
