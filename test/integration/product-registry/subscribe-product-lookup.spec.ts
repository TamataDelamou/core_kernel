import { Test } from '@nestjs/testing';
import { SubscribeToProduitUseCase } from '../../../src/org/application/use-cases/abonnement.use-cases';
import {
  ABONNEMENT_PRODUIT_REPOSITORY,
  ORGANISATION_REPOSITORY,
} from '../../../src/org/domain/repositories/org.repositories';
import { UnregisteredProductError } from '../../../src/org/domain/exceptions/org.exceptions';
import { Organisation } from '../../../src/org/domain/entities/organisation.entity';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { PRODUCT_LOOKUP_PORT } from '../../../src/common/kernel-ports/product-lookup.port';

const ORGANISATION_FICTIVE = Organisation.create({
  id: 'org-1',
  nom: 'Test',
  referentiel: {
    paysId: null,
    uniteAdministrativeId: null,
    villeId: null,
    deviseId: null,
    langueId: null,
    fuseauHoraire: null,
  },
});

async function buildUseCase(existsAndActiveMock: jest.Mock) {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const moduleRef = await Test.createTestingModule({
    providers: [
      SubscribeToProduitUseCase,
      { provide: ORGANISATION_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(ORGANISATION_FICTIVE) } },
      {
        provide: ABONNEMENT_PRODUIT_REPOSITORY,
        useValue: { findByOrganisationAndProduit: jest.fn().mockResolvedValue(null), save: saveMock },
      },
      { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      { provide: PRODUCT_LOOKUP_PORT, useValue: { existsAndActive: existsAndActiveMock } },
    ],
  }).compile();

  return { useCase: moduleRef.get(SubscribeToProduitUseCase), saveMock };
}

describe('SubscribeToProduitUseCase (intégration application) — KER-PROD-01, fermeture des UUID libres', () => {
  it('REFUSE la souscription si le produitId n\'existe pas ou est désactivé', async () => {
    const { useCase, saveMock } = await buildUseCase(jest.fn().mockResolvedValue(false));

    await expect(
      useCase.execute({ organisationId: 'org-1', produitId: 'produit-fantome', dateDebut: new Date() }),
    ).rejects.toThrow(UnregisteredProductError);

    expect(saveMock).not.toHaveBeenCalled();
  });

  it('vérifie le produit APRÈS l\'organisation mais AVANT la recherche d\'un abonnement existant', async () => {
    const findByOrganisationAndProduitMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscribeToProduitUseCase,
        { provide: ORGANISATION_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(ORGANISATION_FICTIVE) } },
        {
          provide: ABONNEMENT_PRODUIT_REPOSITORY,
          useValue: { findByOrganisationAndProduit: findByOrganisationAndProduitMock, save: jest.fn() },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
        { provide: PRODUCT_LOOKUP_PORT, useValue: { existsAndActive: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    const useCase = moduleRef.get(SubscribeToProduitUseCase);
    await expect(
      useCase.execute({ organisationId: 'org-1', produitId: 'produit-fantome', dateDebut: new Date() }),
    ).rejects.toThrow(UnregisteredProductError);

    expect(findByOrganisationAndProduitMock).not.toHaveBeenCalled();
  });

  it('crée l\'abonnement si le produit existe et est actif', async () => {
    const { useCase, saveMock } = await buildUseCase(jest.fn().mockResolvedValue(true));

    const result = await useCase.execute({
      organisationId: 'org-1',
      produitId: 'produit-reel',
      dateDebut: new Date(),
    });

    expect(result.id).toBeDefined();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
