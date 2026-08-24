import { Test } from '@nestjs/testing';
import { SupabaseSessionExchangeUseCase } from '../../../src/identity/application/use-cases/supabase-session-exchange.use-case';
import {
  EXTERNAL_IDENTITY_MAPPING_REPOSITORY,
  USER_REPOSITORY,
} from '../../../src/identity/domain/repositories/identity.repositories';
import { SUPABASE_SESSION_VERIFIER } from '../../../src/identity/domain/services/supabase-session.interface';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { AuthenticateUserUseCase } from '../../../src/identity/application/use-cases/authenticate-user.use-case';
import { User } from '../../../src/identity/domain/entities/user.entity';
import { ExternalIdentityMapping } from '../../../src/identity/domain/entities/rbac-and-tokens.entity';
import { Email } from '../../../src/common/value-objects/email.vo';

const REFERENTIEL_VIDE = {
  paysId: null,
  uniteAdministrativeId: null,
  villeId: null,
  langueId: null,
  deviseId: null,
  fuseauHoraire: null,
};

function buildAuthenticateUserUseCaseMock() {
  return {
    completeAuthenticationByGsgId: jest.fn().mockResolvedValue({
      status: 'authenticated',
      accessToken: 'fake-access-token',
      accessTokenExpiresInSeconds: 900,
      refreshToken: 'fake-refresh-token',
    }),
  };
}

async function buildUseCase(overrides: {
  verifierMock: { verify: jest.Mock };
  mappingRepoMock?: Partial<Record<string, jest.Mock>>;
  userRepoMock?: Partial<Record<string, jest.Mock>>;
  authenticateUserUseCaseMock?: ReturnType<typeof buildAuthenticateUserUseCaseMock>;
}) {
  const authenticateUserUseCaseMock = overrides.authenticateUserUseCaseMock ?? buildAuthenticateUserUseCaseMock();

  const moduleRef = await Test.createTestingModule({
    providers: [
      SupabaseSessionExchangeUseCase,
      { provide: SUPABASE_SESSION_VERIFIER, useValue: overrides.verifierMock },
      {
        provide: EXTERNAL_IDENTITY_MAPPING_REPOSITORY,
        useValue: {
          findByProduitAndExternalId: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockResolvedValue(undefined),
          ...overrides.mappingRepoMock,
        },
      },
      {
        provide: USER_REPOSITORY,
        useValue: {
          findByEmail: jest.fn().mockResolvedValue(null),
          findByPhone: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockResolvedValue(undefined),
          ...overrides.userRepoMock,
        },
      },
      { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      { provide: AuthenticateUserUseCase, useValue: authenticateUserUseCaseMock },
    ],
  }).compile();

  return {
    useCase: moduleRef.get(SupabaseSessionExchangeUseCase),
    authenticateUserUseCaseMock,
  };
}

const COMMAND_BASE = {
  supabaseProjectUrl: 'https://xxxx.supabase.co',
  supabaseAccessToken: 'fake-supabase-jwt',
  produitId: 'produit-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
};

describe('SupabaseSessionExchangeUseCase (intégration application) — KER-ID-02', () => {
  it('SSO immédiat si un mapping (produitId, supabaseUserId) existe déjà — aucune dédup nécessaire', async () => {
    const mapping = ExternalIdentityMapping.create({
      id: 'mapping-1',
      gsgId: 'gsg-id-existant',
      produitId: 'produit-1',
      externalUserId: 'supabase-user-1',
    });

    const { useCase, authenticateUserUseCaseMock } = await buildUseCase({
      verifierMock: {
        verify: jest.fn().mockResolvedValue({ supabaseUserId: 'supabase-user-1', email: '', phone: '' }),
      },
      mappingRepoMock: { findByProduitAndExternalId: jest.fn().mockResolvedValue(mapping) },
    });

    await useCase.execute(COMMAND_BASE);

    expect(authenticateUserUseCaseMock.completeAuthenticationByGsgId).toHaveBeenCalledWith(
      'gsg-id-existant',
      '127.0.0.1',
      'jest',
    );
  });

  it('rattache un profil GSG ID existant si l\'email du jeton Supabase correspond (dédup inter-produits)', async () => {
    const utilisateurExistant = User.reconstitute({
      gsgId: 'gsg-id-existant',
      email: Email.create('user@example.com'),
      emailVerifie: true,
      phone: null,
      phoneVerifie: false,
      passwordHash: 'hash',
      nomAffichage: 'Test',
      statut: 'actif',
      mfaActive: false,
      referentiel: REFERENTIEL_VIDE,
      creeLe: new Date(),
      modifieLe: new Date(),
      dernierAuthLe: null,
      tentativesEchoueesConsecutives: 0,
      verrouilleJusqua: null,
    });

    const saveMappingMock = jest.fn().mockResolvedValue(undefined);
    const { useCase, authenticateUserUseCaseMock } = await buildUseCase({
      verifierMock: {
        verify: jest
          .fn()
          .mockResolvedValue({ supabaseUserId: 'supabase-user-2', email: 'user@example.com', phone: '' }),
      },
      mappingRepoMock: { save: saveMappingMock },
      userRepoMock: { findByEmail: jest.fn().mockResolvedValue(utilisateurExistant) },
    });

    await useCase.execute(COMMAND_BASE);

    expect(authenticateUserUseCaseMock.completeAuthenticationByGsgId).toHaveBeenCalledWith(
      'gsg-id-existant',
      '127.0.0.1',
      'jest',
    );
    // Le mapping est créé pour accélérer les prochaines connexions (même produit).
    expect(saveMappingMock).toHaveBeenCalledTimes(1);
  });

  it('crée un nouveau profil GSG ID si aucun mapping ni dédup ne correspond', async () => {
    const saveUserMock = jest.fn().mockResolvedValue(undefined);
    const { useCase, authenticateUserUseCaseMock } = await buildUseCase({
      verifierMock: {
        verify: jest
          .fn()
          .mockResolvedValue({ supabaseUserId: 'supabase-user-3', email: 'nouveau@example.com', phone: '' }),
      },
      userRepoMock: { save: saveUserMock },
    });

    await useCase.execute(COMMAND_BASE);

    expect(saveUserMock).toHaveBeenCalledTimes(1);
    expect(authenticateUserUseCaseMock.completeAuthenticationByGsgId).toHaveBeenCalledTimes(1);
  });

  it('priorise la dédup par email avant de consulter le téléphone', async () => {
    const parEmail = User.reconstitute({
      gsgId: 'gsg-id-par-email',
      email: Email.create('user@example.com'),
      emailVerifie: true,
      phone: null,
      phoneVerifie: false,
      passwordHash: null,
      nomAffichage: 'Test',
      statut: 'actif',
      mfaActive: false,
      referentiel: REFERENTIEL_VIDE,
      creeLe: new Date(),
      modifieLe: new Date(),
      dernierAuthLe: null,
      tentativesEchoueesConsecutives: 0,
      verrouilleJusqua: null,
    });

    const findByPhoneMock = jest.fn();
    const { useCase } = await buildUseCase({
      verifierMock: {
        verify: jest.fn().mockResolvedValue({
          supabaseUserId: 'supabase-user-4',
          email: 'user@example.com',
          phone: '+224620000000',
        }),
      },
      userRepoMock: { findByEmail: jest.fn().mockResolvedValue(parEmail), findByPhone: findByPhoneMock },
    });

    await useCase.execute(COMMAND_BASE);

    // L'email a suffi à identifier l'utilisateur : le téléphone n'est jamais consulté.
    expect(findByPhoneMock).not.toHaveBeenCalled();
  });
});
