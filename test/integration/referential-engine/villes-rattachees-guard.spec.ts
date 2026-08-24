import { Test } from '@nestjs/testing';
import {
  ReattachNoeudUseCase,
  SetNoeudActivationUseCase,
} from '../../../src/referential-engine/application/use-cases/noeud-hierarchique.use-cases';
import {
  COMPTEUR_VILLES_RATTACHEES_REPOSITORY,
  NOEUD_HIERARCHIQUE_REPOSITORY,
} from '../../../src/referential-engine/domain/repositories/referential-engine.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { NodeHasAttachedVillesError } from '../../../src/referential-engine/domain/exceptions/referential-engine.exceptions';
import { NoeudHierarchique } from '../../../src/referential-engine/domain/entities/noeud-hierarchique.entity';

function racine(id = 'noeud-1'): NoeudHierarchique {
  return NoeudHierarchique.createRoot({ id, paysId: 'pays-gn', codeDomaine: 'administratif', appellationLocale: 'X' });
}

describe('ReattachNoeudUseCase (intégration application) — KER-ADM-04, volet villes rattachées', () => {
  it('REFUSE le réattachement si le compteur local est supérieur à zéro', async () => {
    const noeud = racine('noeud-1');
    const nouveauParent = racine('nouveau-parent');
    const saveMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachNoeudUseCase,
        {
          provide: NOEUD_HIERARCHIQUE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockImplementation((id: string) =>
              Promise.resolve(id === 'noeud-1' ? noeud : id === 'nouveau-parent' ? nouveauParent : null),
            ),
            findChildren: jest.fn().mockResolvedValue([]),
            save: saveMock,
          },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
        {
          provide: COMPTEUR_VILLES_RATTACHEES_REPOSITORY,
          useValue: { getCompte: jest.fn().mockResolvedValue(3) },
        },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachNoeudUseCase);
    await expect(useCase.execute('noeud-1', 'nouveau-parent')).rejects.toThrow(NodeHasAttachedVillesError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('autorise le réattachement si le compteur local est à zéro (et aucun enfant publié)', async () => {
    const noeud = racine('noeud-1');
    const nouveauParent = racine('nouveau-parent');
    const saveMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachNoeudUseCase,
        {
          provide: NOEUD_HIERARCHIQUE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockImplementation((id: string) =>
              Promise.resolve(id === 'noeud-1' ? noeud : id === 'nouveau-parent' ? nouveauParent : null),
            ),
            findChildren: jest.fn().mockResolvedValue([]),
            save: saveMock,
          },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: COMPTEUR_VILLES_RATTACHEES_REPOSITORY,
          useValue: { getCompte: jest.fn().mockResolvedValue(0) },
        },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachNoeudUseCase);
    await useCase.execute('noeud-1', 'nouveau-parent');
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});

describe('SetNoeudActivationUseCase (intégration application) — KER-ADM-04, volet villes rattachées', () => {
  it('REFUSE la désactivation si le compteur local est supérieur à zéro', async () => {
    const noeud = racine('noeud-1');
    const saveMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        SetNoeudActivationUseCase,
        {
          provide: NOEUD_HIERARCHIQUE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockResolvedValue(noeud),
            findChildren: jest.fn().mockResolvedValue([]),
            save: saveMock,
          },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
        {
          provide: COMPTEUR_VILLES_RATTACHEES_REPOSITORY,
          useValue: { getCompte: jest.fn().mockResolvedValue(1) },
        },
      ],
    }).compile();

    const useCase = moduleRef.get(SetNoeudActivationUseCase);
    await expect(useCase.deactivate('noeud-1')).rejects.toThrow(NodeHasAttachedVillesError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('les deux garde-fous (enfants publiés, villes rattachées) restent indépendants et cumulatifs', async () => {
    const noeud = racine('noeud-1');
    const enfantPublie = NoeudHierarchique.createChild({ id: 'enfant-1', parent: noeud, appellationLocale: 'X' });
    enfantPublie.submitForReview();
    enfantPublie.validate();
    enfantPublie.publish();

    const moduleRef = await Test.createTestingModule({
      providers: [
        SetNoeudActivationUseCase,
        {
          provide: NOEUD_HIERARCHIQUE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockResolvedValue(noeud),
            findChildren: jest.fn().mockResolvedValue([enfantPublie]),
            save: jest.fn(),
          },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
        // Compteur à zéro : SEUL le garde-fou "enfants publiés" doit bloquer ici.
        { provide: COMPTEUR_VILLES_RATTACHEES_REPOSITORY, useValue: { getCompte: jest.fn().mockResolvedValue(0) } },
      ],
    }).compile();

    const useCase = moduleRef.get(SetNoeudActivationUseCase);
    await expect(useCase.deactivate('noeud-1')).rejects.toThrow();
  });
});
