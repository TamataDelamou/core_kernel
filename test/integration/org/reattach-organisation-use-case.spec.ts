import { Test } from '@nestjs/testing';
import { ReattachOrganisationUseCase } from '../../../src/org/application/use-cases/organisation.use-cases';
import { ORGANISATION_REPOSITORY } from '../../../src/org/domain/repositories/org.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { CircularParentingError, OrganisationNotFoundError } from '../../../src/org/domain/exceptions/org.exceptions';
import { Organisation } from '../../../src/org/domain/entities/organisation.entity';

const REFERENTIEL_VIDE = {
  paysId: null,
  uniteAdministrativeId: null,
  villeId: null,
  deviseId: null,
  langueId: null,
  fuseauHoraire: null,
};

function org(id: string): Organisation {
  return Organisation.create({ id, nom: `Org ${id}`, referentiel: REFERENTIEL_VIDE });
}

describe('ReattachOrganisationUseCase (intégration application) — détection de cycle', () => {
  it('rattache normalement une organisation à une nouvelle maison mère sans cycle', async () => {
    const findByIdMock = jest.fn().mockImplementation((id: string) => Promise.resolve(org(id)));
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const publishMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachOrganisationUseCase,
        {
          provide: ORGANISATION_REPOSITORY,
          useValue: {
            findById: findByIdMock,
            save: saveMock,
            isDescendantOf: jest.fn().mockResolvedValue(false),
          },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: publishMock } },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachOrganisationUseCase);
    await expect(useCase.execute('org-filiale', 'org-mere')).resolves.toBeUndefined();

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledTimes(1);
  });

  it('REFUSE un rattachement qui créerait un cycle (la cible est déjà une descendante)', async () => {
    const findByIdMock = jest.fn().mockImplementation((id: string) => Promise.resolve(org(id)));
    const isDescendantOfMock = jest.fn().mockResolvedValue(true); // org-cible descend bien d'org-source
    const saveMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachOrganisationUseCase,
        {
          provide: ORGANISATION_REPOSITORY,
          useValue: { findById: findByIdMock, save: saveMock, isDescendantOf: isDescendantOfMock },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachOrganisationUseCase);

    // org-source tente de se rattacher à org-cible, qui est déjà sa propre descendante
    // (ex. org-source → org-intermediaire → org-cible) : boucle refusée.
    await expect(useCase.execute('org-source', 'org-cible')).rejects.toThrow(CircularParentingError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('propage OrganisationNotFoundError si l\'organisation à rattacher n\'existe pas', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachOrganisationUseCase,
        {
          provide: ORGANISATION_REPOSITORY,
          useValue: { findById: jest.fn().mockResolvedValue(null), save: jest.fn(), isDescendantOf: jest.fn() },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachOrganisationUseCase);
    await expect(useCase.execute('org-inexistante', 'org-cible')).rejects.toThrow(OrganisationNotFoundError);
  });

  it('propage OrganisationNotFoundError si la nouvelle maison mère ciblée n\'existe pas', async () => {
    const findByIdMock = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve(org('org-source'))) // l'organisation existe
      .mockImplementationOnce(() => Promise.resolve(null)); // la cible n'existe pas

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachOrganisationUseCase,
        {
          provide: ORGANISATION_REPOSITORY,
          useValue: { findById: findByIdMock, save: jest.fn(), isDescendantOf: jest.fn() },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachOrganisationUseCase);
    await expect(useCase.execute('org-source', 'org-cible-inexistante')).rejects.toThrow(
      OrganisationNotFoundError,
    );
  });

  it('permet le détachement (organisationMereId = null) sans jamais consulter isDescendantOf', async () => {
    const findByIdMock = jest.fn().mockResolvedValue(org('org-1'));
    const isDescendantOfMock = jest.fn();
    const saveMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachOrganisationUseCase,
        {
          provide: ORGANISATION_REPOSITORY,
          useValue: { findById: findByIdMock, save: saveMock, isDescendantOf: isDescendantOfMock },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachOrganisationUseCase);
    await useCase.execute('org-1', null);

    expect(isDescendantOfMock).not.toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
