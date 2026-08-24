import { Test } from '@nestjs/testing';
import { AssignRoleUseCase } from '../../../src/identity/application/use-cases/external-identity-and-profile.use-cases';
import {
  ROLE_REPOSITORY,
  USER_REPOSITORY,
  USER_ROLE_ASSIGNMENT_REPOSITORY,
} from '../../../src/identity/domain/repositories/identity.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { ORGANISATION_LOOKUP_PORT } from '../../../src/common/kernel-ports/organisation-lookup.port';
import { InvalidOrganizationScopeError, UserNotFoundError } from '../../../src/identity/domain/exceptions/identity.exceptions';
import { User } from '../../../src/identity/domain/entities/user.entity';
import { Email } from '../../../src/common/value-objects/email.vo';
import { Role } from '../../../src/identity/domain/entities/rbac-and-tokens.entity';

describe('AssignRoleUseCase (intégration application) — fermeture du contrôle de portée KER-ORG-03', () => {
  const fakeUser = User.register({
    gsgId: 'user-1',
    email: Email.create('owner@example.com'),
    phone: null,
    passwordHash: 'hash',
    nomAffichage: 'Owner',
    referentiel: {
      paysId: null,
      uniteAdministrativeId: null,
      villeId: null,
      langueId: null,
      deviseId: null,
      fuseauHoraire: null,
    },
  });

  const fakeRole = Role.create({
    id: 'role-1',
    code: 'org.owner',
    nom: 'Propriétaire',
    description: 'Rôle scopé organisation',
    gsgOrgId: null,
    permissions: [],
  });

  async function buildUseCase(organisationLookupPortMock: { existsAndActive: jest.Mock }) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssignRoleUseCase,
        { provide: USER_REPOSITORY, useValue: { findByGsgId: jest.fn().mockResolvedValue(fakeUser) } },
        { provide: ROLE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(fakeRole) } },
        {
          provide: USER_ROLE_ASSIGNMENT_REPOSITORY,
          useValue: { save: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: organisationLookupPortMock },
      ],
    }).compile();

    return moduleRef.get(AssignRoleUseCase);
  }

  it('attribue un rôle GLOBAL (gsgOrgId null) sans jamais consulter Org Registry', async () => {
    const lookupMock = { existsAndActive: jest.fn() };
    const useCase = await buildUseCase(lookupMock);

    await expect(
      useCase.execute({ gsgId: 'user-1', roleId: 'role-1', gsgOrgId: null, assignePar: 'admin-1' }),
    ).resolves.toBeUndefined();

    expect(lookupMock.existsAndActive).not.toHaveBeenCalled();
  });

  it('attribue un rôle SCOPÉ si l\'organisation existe et est active', async () => {
    const lookupMock = { existsAndActive: jest.fn().mockResolvedValue(true) };
    const useCase = await buildUseCase(lookupMock);

    await expect(
      useCase.execute({ gsgId: 'user-1', roleId: 'role-1', gsgOrgId: 'org-1', assignePar: 'admin-1' }),
    ).resolves.toBeUndefined();

    expect(lookupMock.existsAndActive).toHaveBeenCalledWith('org-1');
  });

  it('REFUSE d\'attribuer un rôle scopé à une organisation inexistante ou désactivée', async () => {
    const lookupMock = { existsAndActive: jest.fn().mockResolvedValue(false) };
    const useCase = await buildUseCase(lookupMock);

    await expect(
      useCase.execute({ gsgId: 'user-1', roleId: 'role-1', gsgOrgId: 'org-inexistante', assignePar: 'admin-1' }),
    ).rejects.toThrow(InvalidOrganizationScopeError);
  });

  it('ne persiste JAMAIS l\'attribution si le contrôle de portée échoue', async () => {
    const lookupMock = { existsAndActive: jest.fn().mockResolvedValue(false) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssignRoleUseCase,
        { provide: USER_REPOSITORY, useValue: { findByGsgId: jest.fn().mockResolvedValue(fakeUser) } },
        { provide: ROLE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(fakeRole) } },
        { provide: USER_ROLE_ASSIGNMENT_REPOSITORY, useValue: { save: jest.fn() } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: lookupMock },
      ],
    }).compile();

    const useCase = moduleRef.get(AssignRoleUseCase);
    const saveSpy = moduleRef.get(USER_ROLE_ASSIGNMENT_REPOSITORY).save;

    await expect(
      useCase.execute({ gsgId: 'user-1', roleId: 'role-1', gsgOrgId: 'org-x', assignePar: 'admin-1' }),
    ).rejects.toThrow(InvalidOrganizationScopeError);

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('propage UserNotFoundError avant même de consulter Org Registry', async () => {
    const lookupMock = { existsAndActive: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssignRoleUseCase,
        { provide: USER_REPOSITORY, useValue: { findByGsgId: jest.fn().mockResolvedValue(null) } },
        { provide: ROLE_REPOSITORY, useValue: { findById: jest.fn() } },
        { provide: USER_ROLE_ASSIGNMENT_REPOSITORY, useValue: { save: jest.fn() } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: lookupMock },
      ],
    }).compile();

    const useCase = moduleRef.get(AssignRoleUseCase);

    await expect(
      useCase.execute({ gsgId: 'user-inconnu', roleId: 'role-1', gsgOrgId: 'org-1', assignePar: 'admin-1' }),
    ).rejects.toThrow(UserNotFoundError);

    expect(lookupMock.existsAndActive).not.toHaveBeenCalled();
  });
});
