import { Test } from '@nestjs/testing';
import { ResolveAppConfigUseCase } from '../../../src/app-config/application/use-cases/resolve-app-config.use-case';
import { USER_REFERENTIAL_LOOKUP_PORT } from '../../../src/common/kernel-ports/user-referential-lookup.port';
import { ORGANISATION_REFERENTIAL_LOOKUP_PORT } from '../../../src/common/kernel-ports/organisation-referential-lookup.port';
import { REFERENTIAL_DEFAULTS_LOOKUP_PORT } from '../../../src/common/kernel-ports/referential-defaults-lookup.port';
import { ORGANISATION_LOOKUP_PORT } from '../../../src/common/kernel-ports/organisation-lookup.port';
import { CONFIGURATION_GLOBALE_REPOSITORY } from '../../../src/app-config/domain/repositories/configuration-globale.repository';
import { ConfigurationGlobale } from '../../../src/app-config/domain/entities/configuration-globale.entity';
import {
  OrganisationNotFoundOrInactiveError,
  OrganisationNotInUserScopeError,
  UniteOperationnelleNotInOrganisationError,
} from '../../../src/app-config/domain/exceptions/app-config.exceptions';

const REFERENTIEL_VIDE = { paysId: null, deviseId: null, langueId: null, fuseauHoraire: null };

interface MockOverrides {
  userReferentiel?: typeof REFERENTIEL_VIDE | null;
  organisationReferentiel?: typeof REFERENTIEL_VIDE | null;
  uniteReferentiel?: typeof REFERENTIEL_VIDE | null;
  paysDefaults?: unknown;
  configurationGlobale?: ConfigurationGlobale | null;
  organisationActive?: boolean;
}

async function buildUseCase(overrides: MockOverrides = {}) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      ResolveAppConfigUseCase,
      {
        provide: USER_REFERENTIAL_LOOKUP_PORT,
        useValue: { getReferentiel: jest.fn().mockResolvedValue(overrides.userReferentiel ?? REFERENTIEL_VIDE) },
      },
      {
        provide: ORGANISATION_REFERENTIAL_LOOKUP_PORT,
        useValue: {
          getOrganisationReferentiel: jest.fn().mockResolvedValue(overrides.organisationReferentiel ?? REFERENTIEL_VIDE),
          getUniteOperationnelleReferentiel: jest.fn().mockResolvedValue(overrides.uniteReferentiel ?? null),
        },
      },
      {
        provide: REFERENTIAL_DEFAULTS_LOOKUP_PORT,
        useValue: {
          getPaysDefaults: jest.fn().mockResolvedValue(overrides.paysDefaults ?? null),
          enrichCodes: jest.fn().mockResolvedValue({ paysCode: null, deviseCode: null, langueCode: null }),
        },
      },
      {
        provide: ORGANISATION_LOOKUP_PORT,
        useValue: { existsAndActive: jest.fn().mockResolvedValue(overrides.organisationActive ?? true) },
      },
      {
        provide: CONFIGURATION_GLOBALE_REPOSITORY,
        useValue: { get: jest.fn().mockResolvedValue(overrides.configurationGlobale ?? null) },
      },
    ],
  }).compile();

  return moduleRef.get(ResolveAppConfigUseCase);
}

const COMMAND_BASE = { gsgId: 'user-1', requestingUserGsgOrgIds: ['org-1'], gsgOrgId: 'org-1' };

describe('ResolveAppConfigUseCase (intégration application) — KER-CFG-02', () => {
  it('REFUSE une résolution pour une organisation hors du périmètre du jeton (gsgOrgIds)', async () => {
    const useCase = await buildUseCase();
    await expect(
      useCase.execute({ ...COMMAND_BASE, gsgOrgId: 'org-etrangere', requestingUserGsgOrgIds: ['org-1'] }),
    ).rejects.toThrow(OrganisationNotInUserScopeError);
  });

  it('REFUSE une résolution pour une organisation désactivée', async () => {
    const useCase = await buildUseCase({ organisationActive: false });
    await expect(useCase.execute(COMMAND_BASE)).rejects.toThrow(OrganisationNotFoundOrInactiveError);
  });

  it('REFUSE si uniteOperationnelleId est fourni mais n\'appartient pas à l\'organisation', async () => {
    const useCase = await buildUseCase({ uniteReferentiel: null });
    await expect(
      useCase.execute({ ...COMMAND_BASE, uniteOperationnelleId: 'unite-etrangere' }),
    ).rejects.toThrow(UniteOperationnelleNotInOrganisationError);
  });

  it('le niveau Utilisateur l\'emporte sur tous les autres pour un champ qu\'il définit', async () => {
    const useCase = await buildUseCase({
      userReferentiel: { ...REFERENTIEL_VIDE, deviseId: 'devise-utilisateur' },
      organisationReferentiel: { ...REFERENTIEL_VIDE, deviseId: 'devise-organisation' },
    });

    const resultat = await useCase.execute(COMMAND_BASE);
    expect(resultat.deviseId).toBe('devise-utilisateur');
  });

  it('retombe sur le niveau Organisation si Utilisateur et Agence ne définissent rien', async () => {
    const useCase = await buildUseCase({
      userReferentiel: REFERENTIEL_VIDE,
      organisationReferentiel: { ...REFERENTIEL_VIDE, deviseId: 'devise-organisation' },
    });

    const resultat = await useCase.execute(COMMAND_BASE);
    expect(resultat.deviseId).toBe('devise-organisation');
  });

  it('retombe effectivement sur le niveau Global quand rien n\'est défini nulle part ailleurs', async () => {
    const configurationGlobale = ConfigurationGlobale.reconstitute({
      deviseId: 'devise-globale',
      langueId: 'langue-globale',
      fuseauHoraire: 'Africa/Conakry',
      formatDate: 'DD/MM/YYYY',
      formatNombre: '#,##0.00',
      modifieLe: new Date(),
    });

    const useCase = await buildUseCase({ configurationGlobale });

    const resultat = await useCase.execute(COMMAND_BASE);
    expect(resultat.deviseId).toBe('devise-globale');
    expect(resultat.langueId).toBe('langue-globale');
    expect(resultat.fuseauHoraire).toBe('Africa/Conakry');
  });

  it('n\'échoue JAMAIS même si aucune configuration globale n\'a été initialisée (repli DEFAUTS_ABSOLUS)', async () => {
    const useCase = await buildUseCase({ configurationGlobale: null });
    const resultat = await useCase.execute(COMMAND_BASE);
    expect(resultat.fuseauHoraire).toBe('UTC');
    expect(resultat.formatDate).toBe('DD/MM/YYYY');
  });

  it('résout paysId depuis le premier niveau qui le définit, interroge les défauts pays, et dérive locale', async () => {
    const getPaysDefaultsMock = jest.fn().mockResolvedValue({
      codeIso: 'GN',
      deviseIdPrincipale: 'devise-gnf',
      langueIdPrincipale: 'langue-fr',
      fuseauHoraire: 'Africa/Conakry',
      adresseGabarit: 'gabarit-gn',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolveAppConfigUseCase,
        {
          provide: USER_REFERENTIAL_LOOKUP_PORT,
          useValue: { getReferentiel: jest.fn().mockResolvedValue({ ...REFERENTIEL_VIDE, paysId: 'pays-gn' }) },
        },
        {
          provide: ORGANISATION_REFERENTIAL_LOOKUP_PORT,
          useValue: {
            getOrganisationReferentiel: jest.fn().mockResolvedValue(REFERENTIEL_VIDE),
            getUniteOperationnelleReferentiel: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: REFERENTIAL_DEFAULTS_LOOKUP_PORT,
          useValue: {
            getPaysDefaults: getPaysDefaultsMock,
            enrichCodes: jest.fn().mockResolvedValue({ paysCode: 'GN', deviseCode: 'GNF', langueCode: 'fr' }),
          },
        },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { existsAndActive: jest.fn().mockResolvedValue(true) } },
        { provide: CONFIGURATION_GLOBALE_REPOSITORY, useValue: { get: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    const useCase = moduleRef.get(ResolveAppConfigUseCase);
    const resultat = await useCase.execute(COMMAND_BASE);

    expect(getPaysDefaultsMock).toHaveBeenCalledWith('pays-gn');
    expect(resultat.paysId).toBe('pays-gn');
    expect(resultat.deviseId).toBe('devise-gnf');
    expect(resultat.locale).toBe('fr-GN');
  });

  it('fournisseursPaiement est toujours un tableau vide (KER-BIL non construit — jamais de donnée inventée)', async () => {
    const useCase = await buildUseCase();
    const resultat = await useCase.execute(COMMAND_BASE);
    expect(resultat.fournisseursPaiement).toEqual([]);
  });
});
