import { Test } from '@nestjs/testing';
import { CreateCatalogueUseCase } from '../../../src/product/application/use-cases/catalogue.use-cases';
import { CATALOGUE_REPOSITORY } from '../../../src/product/domain/repositories/product.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { ORGANISATION_LOOKUP_PORT } from '../../../src/common/kernel-ports/organisation-lookup.port';
import { PRODUCT_LOOKUP_PORT } from '../../../src/common/kernel-ports/product-lookup.port';
import { UnregisteredProductError } from '../../../src/product/domain/exceptions/product.exceptions';

async function buildUseCase(overrides: { existsAndActiveMock: jest.Mock; organisationLookupMock?: jest.Mock }) {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const moduleRef = await Test.createTestingModule({
    providers: [
      CreateCatalogueUseCase,
      { provide: CATALOGUE_REPOSITORY, useValue: { save: saveMock } },
      { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      {
        provide: ORGANISATION_LOOKUP_PORT,
        useValue: { existsAndActive: overrides.organisationLookupMock ?? jest.fn() },
      },
      { provide: PRODUCT_LOOKUP_PORT, useValue: { existsAndActive: overrides.existsAndActiveMock } },
    ],
  }).compile();

  return { useCase: moduleRef.get(CreateCatalogueUseCase), saveMock };
}

describe('CreateCatalogueUseCase (intégration application) — KER-PROD-01, fermeture des UUID libres', () => {
  it('REFUSE la création si le produitId n\'existe pas ou est désactivé dans le registre', async () => {
    const { useCase, saveMock } = await buildUseCase({ existsAndActiveMock: jest.fn().mockResolvedValue(false) });

    await expect(
      useCase.execute({ produitId: 'produit-fantome', nom: 'Catalogue X', scopeType: 'portefeuille_global' }),
    ).rejects.toThrow(UnregisteredProductError);

    expect(saveMock).not.toHaveBeenCalled();
  });

  it('vérifie le produit AVANT le scope organisation (échoue au plus tôt, sans consulter Org Registry)', async () => {
    const organisationLookupMock = jest.fn();
    const { useCase } = await buildUseCase({
      existsAndActiveMock: jest.fn().mockResolvedValue(false),
      organisationLookupMock,
    });

    await expect(
      useCase.execute({
        produitId: 'produit-fantome',
        nom: 'X',
        scopeType: 'organisation',
        scopeCibleId: 'org-1',
      }),
    ).rejects.toThrow(UnregisteredProductError);

    expect(organisationLookupMock).not.toHaveBeenCalled();
  });

  it('crée le catalogue si le produit existe et est actif', async () => {
    const { useCase, saveMock } = await buildUseCase({ existsAndActiveMock: jest.fn().mockResolvedValue(true) });

    const result = await useCase.execute({
      produitId: 'produit-reel',
      nom: 'Catalogue AssoShop',
      scopeType: 'portefeuille_global',
    });

    expect(result.id).toBeDefined();
    expect(saveMock).toHaveBeenCalledTimes(1);
    const catalogueSauvegarde = saveMock.mock.calls[0][0];
    expect(catalogueSauvegarde.produitId).toBe('produit-reel');
  });
});
