import { Test } from '@nestjs/testing';
import {
  AssertOrganisationCanAccessCatalogueUseCase,
  CreateCatalogueUseCase,
} from '../../../src/product/application/use-cases/catalogue.use-cases';
import { CATALOGUE_REPOSITORY } from '../../../src/product/domain/repositories/product.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { ORGANISATION_LOOKUP_PORT } from '../../../src/common/kernel-ports/organisation-lookup.port';
import { PRODUCT_LOOKUP_PORT } from '../../../src/common/kernel-ports/product-lookup.port';
import {
  CatalogueAccessDeniedError,
  CatalogueNotFoundError,
  OrganisationScopeNotFoundError,
} from '../../../src/product/domain/exceptions/product.exceptions';
import { Catalogue, CatalogueScope } from '../../../src/product/domain/entities/catalogue.entity';

describe('CreateCatalogueUseCase (intégration application) — validation du scope organisation', () => {
  it('REFUSE la création d\'un catalogue scopé à une organisation inexistante ou désactivée', async () => {
    const saveMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateCatalogueUseCase,
        { provide: CATALOGUE_REPOSITORY, useValue: { save: saveMock } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { existsAndActive: jest.fn().mockResolvedValue(false) } },
        { provide: PRODUCT_LOOKUP_PORT, useValue: { existsAndActive: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateCatalogueUseCase);
    await expect(
      useCase.execute({
        produitId: 'produit-1',
        nom: 'Catalogue Org X',
        scopeType: 'organisation',
        scopeCibleId: 'org-inexistante',
      }),
    ).rejects.toThrow(OrganisationScopeNotFoundError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('crée le catalogue si l\'organisation existe et est active', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateCatalogueUseCase,
        { provide: CATALOGUE_REPOSITORY, useValue: { save: saveMock } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { existsAndActive: jest.fn().mockResolvedValue(true) } },
        { provide: PRODUCT_LOOKUP_PORT, useValue: { existsAndActive: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateCatalogueUseCase);
    const result = await useCase.execute({
      produitId: 'produit-1',
      nom: 'Catalogue Org Valide',
      scopeType: 'organisation',
      scopeCibleId: 'org-1',
    });

    expect(result.id).toBeDefined();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('un catalogue "portefeuille_global" ne consulte jamais Org Registry', async () => {
    const existsAndActiveMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateCatalogueUseCase,
        { provide: CATALOGUE_REPOSITORY, useValue: { save: jest.fn().mockResolvedValue(undefined) } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { existsAndActive: existsAndActiveMock } },
        { provide: PRODUCT_LOOKUP_PORT, useValue: { existsAndActive: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateCatalogueUseCase);
    await useCase.execute({ produitId: 'produit-1', nom: 'Catalogue Global', scopeType: 'portefeuille_global' });

    expect(existsAndActiveMock).not.toHaveBeenCalled();
  });
});

describe('AssertOrganisationCanAccessCatalogueUseCase (intégration application) — fermeture du scope', () => {
  function buildCatalogueOrganisation(cibleId: string): Catalogue {
    return Catalogue.reconstitute({
      id: 'catalogue-1',
      produitId: 'produit-1',
      nom: 'Catalogue Groupe X',
      scope: CatalogueScope.organisation(cibleId),
      estActif: true,
      statutWorkflow: 'publie',
      creeLe: new Date(),
      modifieLe: new Date(),
    });
  }

  it('un catalogue "portefeuille_global" est TOUJOURS accessible, sans consulter Org Registry', async () => {
    const catalogueGlobal = Catalogue.reconstitute({
      id: 'catalogue-global',
      produitId: 'produit-1',
      nom: 'Global',
      scope: CatalogueScope.portefeuilleGlobal(),
      estActif: true,
      statutWorkflow: 'publie',
      creeLe: new Date(),
      modifieLe: new Date(),
    });
    const isDescendantOrSelfMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssertOrganisationCanAccessCatalogueUseCase,
        { provide: CATALOGUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(catalogueGlobal) } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { isDescendantOrSelf: isDescendantOrSelfMock } },
      ],
    }).compile();

    const useCase = moduleRef.get(AssertOrganisationCanAccessCatalogueUseCase);
    await expect(useCase.execute('catalogue-global', 'org-nimporte-laquelle')).resolves.toBe(catalogueGlobal);
    expect(isDescendantOrSelfMock).not.toHaveBeenCalled();
  });

  it('autorise l\'organisation elle-même à accéder à SON catalogue', async () => {
    const catalogue = buildCatalogueOrganisation('org-1');
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssertOrganisationCanAccessCatalogueUseCase,
        { provide: CATALOGUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(catalogue) } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { isDescendantOrSelf: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    const useCase = moduleRef.get(AssertOrganisationCanAccessCatalogueUseCase);
    await expect(useCase.execute('catalogue-1', 'org-1')).resolves.toBe(catalogue);
  });

  it('autorise une FILIALE à accéder au catalogue de sa maison mère (héritage descendant)', async () => {
    const catalogueMaisonMere = buildCatalogueOrganisation('org-mere');
    const isDescendantOrSelfMock = jest.fn().mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssertOrganisationCanAccessCatalogueUseCase,
        { provide: CATALOGUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(catalogueMaisonMere) } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { isDescendantOrSelf: isDescendantOrSelfMock } },
      ],
    }).compile();

    const useCase = moduleRef.get(AssertOrganisationCanAccessCatalogueUseCase);
    await useCase.execute('catalogue-1', 'org-filiale');

    // Vérifie l'ordre exact des arguments : (organisation demandeuse, organisation cible du scope)
    expect(isDescendantOrSelfMock).toHaveBeenCalledWith('org-filiale', 'org-mere');
  });

  it('REFUSE l\'accès à une organisation qui n\'a AUCUN lien de filiation avec la cible du scope', async () => {
    const catalogueAutreOrg = buildCatalogueOrganisation('org-cible');
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssertOrganisationCanAccessCatalogueUseCase,
        { provide: CATALOGUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(catalogueAutreOrg) } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { isDescendantOrSelf: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    const useCase = moduleRef.get(AssertOrganisationCanAccessCatalogueUseCase);
    await expect(useCase.execute('catalogue-1', 'org-sans-lien')).rejects.toThrow(
      CatalogueAccessDeniedError,
    );
  });

  it('un catalogue "zone_geographique" est accessible sans consulter la hiérarchie organisationnelle', async () => {
    const catalogueGeo = Catalogue.reconstitute({
      id: 'catalogue-geo',
      produitId: 'produit-1',
      nom: 'Catalogue Guinée',
      scope: CatalogueScope.zoneGeographique('pays-gn'),
      estActif: true,
      statutWorkflow: 'publie',
      creeLe: new Date(),
      modifieLe: new Date(),
    });
    const isDescendantOrSelfMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssertOrganisationCanAccessCatalogueUseCase,
        { provide: CATALOGUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(catalogueGeo) } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { isDescendantOrSelf: isDescendantOrSelfMock } },
      ],
    }).compile();

    const useCase = moduleRef.get(AssertOrganisationCanAccessCatalogueUseCase);
    await expect(useCase.execute('catalogue-geo', 'org-quelconque')).resolves.toBe(catalogueGeo);
    expect(isDescendantOrSelfMock).not.toHaveBeenCalled();
  });

  it('propage CatalogueNotFoundError si le catalogue n\'existe pas', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssertOrganisationCanAccessCatalogueUseCase,
        { provide: CATALOGUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(null) } },
        { provide: ORGANISATION_LOOKUP_PORT, useValue: { isDescendantOrSelf: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(AssertOrganisationCanAccessCatalogueUseCase);
    await expect(useCase.execute('catalogue-inexistant', 'org-1')).rejects.toThrow(
      CatalogueNotFoundError,
    );
  });
});
