import { Test } from '@nestjs/testing';
import {
  CreateGrilleTarifaireUseCase,
  TransitionGrilleTarifaireWorkflowUseCase,
} from '../../../src/product/application/use-cases/grille-tarifaire.use-cases';
import {
  GRILLE_TARIFAIRE_REPOSITORY,
  OFFRE_REPOSITORY,
} from '../../../src/product/domain/repositories/product.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { CURRENCY_VALIDATION_PORT } from '../../../src/common/kernel-ports/currency-validation.port';
import {
  GrilleTarifaireNotFoundError,
  OffreNotFoundError,
  UncertifiedCurrencyError,
} from '../../../src/product/domain/exceptions/product.exceptions';
import { OverlappingPricingGridError, GrilleTarifaire } from '../../../src/product/domain/entities/grille-tarifaire.entity';
import { Offre } from '../../../src/product/domain/entities/offre.entity';

const fakeOffre = Offre.create({
  id: 'offre-1',
  produitId: 'produit-1',
  code: 'abo-standard',
  nom: 'Abonnement Standard',
  type: 'abonnement',
  periodeFacturation: 'mensuelle',
});

async function buildUseCase(params: {
  currencyValidationMock: { isCertified: jest.Mock };
  grillesPubliees?: GrilleTarifaire[];
  latestVersion?: GrilleTarifaire | null;
}) {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const moduleRef = await Test.createTestingModule({
    providers: [
      CreateGrilleTarifaireUseCase,
      { provide: OFFRE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(fakeOffre) } },
      {
        provide: GRILLE_TARIFAIRE_REPOSITORY,
        useValue: {
          findLatestVersion: jest.fn().mockResolvedValue(params.latestVersion ?? null),
          findPublieesByOffreEtDevise: jest.fn().mockResolvedValue(params.grillesPubliees ?? []),
          save: saveMock,
        },
      },
      { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      { provide: CURRENCY_VALIDATION_PORT, useValue: params.currencyValidationMock },
    ],
  }).compile();

  return { useCase: moduleRef.get(CreateGrilleTarifaireUseCase), saveMock };
}

describe('CreateGrilleTarifaireUseCase (intégration application) — KER-PRD devise certifiée', () => {
  const commandeValide = {
    offreId: 'offre-1',
    deviseId: 'devise-xof',
    montantMinorUnit: 1000000,
    periodeFacturation: 'mensuelle',
    dateEffective: new Date('2026-01-01T00:00:00Z'),
  };

  it('REFUSE la création si la devise n\'est pas certifiée', async () => {
    const { useCase, saveMock } = await buildUseCase({
      currencyValidationMock: { isCertified: jest.fn().mockResolvedValue(false) },
    });

    await expect(useCase.execute(commandeValide)).rejects.toThrow(UncertifiedCurrencyError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('crée la grille si la devise est certifiée (publiée et active dans le référentiel)', async () => {
    const { useCase, saveMock } = await buildUseCase({
      currencyValidationMock: { isCertified: jest.fn().mockResolvedValue(true) },
    });

    const result = await useCase.execute(commandeValide);

    expect(result.id).toBeDefined();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('ne consulte JAMAIS un autre mécanisme que CurrencyValidationPort pour la certification', async () => {
    const isCertifiedMock = jest.fn().mockResolvedValue(true);
    const { useCase } = await buildUseCase({ currencyValidationMock: { isCertified: isCertifiedMock } });

    await useCase.execute(commandeValide);

    expect(isCertifiedMock).toHaveBeenCalledWith('devise-xof');
    expect(isCertifiedMock).toHaveBeenCalledTimes(1);
  });

  it('propage OffreNotFoundError avant même de consulter la certification de devise', async () => {
    const isCertifiedMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateGrilleTarifaireUseCase,
        { provide: OFFRE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(null) } },
        {
          provide: GRILLE_TARIFAIRE_REPOSITORY,
          useValue: { findLatestVersion: jest.fn(), findPublieesByOffreEtDevise: jest.fn(), save: jest.fn() },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
        { provide: CURRENCY_VALIDATION_PORT, useValue: { isCertified: isCertifiedMock } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateGrilleTarifaireUseCase);
    await expect(useCase.execute(commandeValide)).rejects.toThrow(OffreNotFoundError);
    expect(isCertifiedMock).not.toHaveBeenCalled();
  });

  it('incrémente automatiquement la version à partir de la dernière grille existante', async () => {
    const derniereGrille = GrilleTarifaire.create({
      id: 'grille-v2',
      offreId: 'offre-1',
      version: 2,
      deviseId: 'devise-xof',
      montantMinorUnit: 900000,
      periodeFacturation: 'mensuelle',
      dateEffective: new Date('2025-01-01'),
      dateFin: new Date('2025-12-01'),
    });

    const { useCase, saveMock } = await buildUseCase({
      currencyValidationMock: { isCertified: jest.fn().mockResolvedValue(true) },
      latestVersion: derniereGrille,
    });

    await useCase.execute(commandeValide);

    const grilleSauvegardee = saveMock.mock.calls[0][0] as GrilleTarifaire;
    expect(grilleSauvegardee.version).toBe(3);
  });

  it('REFUSE une nouvelle grille dont la fenêtre chevauche une grille déjà publiée (même devise)', async () => {
    const grillePubliee = GrilleTarifaire.create({
      id: 'grille-publiee',
      offreId: 'offre-1',
      version: 1,
      deviseId: 'devise-xof',
      montantMinorUnit: 800000,
      periodeFacturation: 'mensuelle',
      dateEffective: new Date('2025-06-01'),
      dateFin: null, // en vigueur indéfiniment
    });

    const { useCase, saveMock } = await buildUseCase({
      currencyValidationMock: { isCertified: jest.fn().mockResolvedValue(true) },
      grillesPubliees: [grillePubliee],
    });

    await expect(useCase.execute(commandeValide)).rejects.toThrow(OverlappingPricingGridError);
    expect(saveMock).not.toHaveBeenCalled();
  });
});

describe('TransitionGrilleTarifaireWorkflowUseCase.publish — re-vérification à la publication', () => {
  it('REFUSE de publier une grille "valide" si un chevauchement existe avec une grille publiée entre-temps', async () => {
    const grilleAPublier = GrilleTarifaire.create({
      id: 'grille-a-publier',
      offreId: 'offre-1',
      version: 2,
      deviseId: 'devise-xof',
      montantMinorUnit: 1000000,
      periodeFacturation: 'mensuelle',
      dateEffective: new Date('2026-01-01'),
      dateFin: null,
    });
    grilleAPublier.validate(); // statut "valide", prête à être publiée

    const grilleDejaPublieeEntreTemps = GrilleTarifaire.create({
      id: 'grille-concurrente',
      offreId: 'offre-1',
      version: 3,
      deviseId: 'devise-xof',
      montantMinorUnit: 1100000,
      periodeFacturation: 'mensuelle',
      dateEffective: new Date('2026-02-01'),
      dateFin: null,
    });

    const saveMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransitionGrilleTarifaireWorkflowUseCase,
        {
          provide: GRILLE_TARIFAIRE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockResolvedValue(grilleAPublier),
            findPublieesByOffreEtDevise: jest.fn().mockResolvedValue([grilleDejaPublieeEntreTemps]),
            save: saveMock,
          },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(TransitionGrilleTarifaireWorkflowUseCase);
    await expect(useCase.publish('grille-a-publier')).rejects.toThrow(OverlappingPricingGridError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('propage GrilleTarifaireNotFoundError si la grille n\'existe pas', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransitionGrilleTarifaireWorkflowUseCase,
        {
          provide: GRILLE_TARIFAIRE_REPOSITORY,
          useValue: { findById: jest.fn().mockResolvedValue(null), findPublieesByOffreEtDevise: jest.fn(), save: jest.fn() },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(TransitionGrilleTarifaireWorkflowUseCase);
    await expect(useCase.publish('grille-inexistante')).rejects.toThrow(GrilleTarifaireNotFoundError);
  });
});
