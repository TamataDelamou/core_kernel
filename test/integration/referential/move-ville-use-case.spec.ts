import { Test } from '@nestjs/testing';
import { MoveVilleUseCase } from '../../../src/referential/application/use-cases/ville.use-cases';
import { VILLE_REPOSITORY } from '../../../src/referential/domain/repositories/referential.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_ENGINE_LOOKUP_PORT } from '../../../src/common/kernel-ports/referential-engine-lookup.port';
import {
  UnpublishedHierarchicalNodeError,
  VilleNotFoundError,
} from '../../../src/referential/domain/exceptions/referential.exceptions';
import { Ville } from '../../../src/referential/domain/entities/ville.entity';

// Fonction plutôt que constante partagée : chaque test doit recevoir sa PROPRE instance
// fraîche. Une constante module-scope unique, mutée par `ville.updateDetails(...)` à
// l'intérieur du use-case réel, aurait fait fuiter l'état d'un test vers le suivant — c'est
// exactement le bug qui a produit un faux échec ici (voir aussi le correctif ci-dessous sur
// `??` vs vérification de présence de clé).
function villeFictive(): Ville {
  return Ville.create({
    id: 'ville-1',
    paysId: 'pays-gn',
    nom: 'Conakry',
    referentielHierarchiqueId: 'ancien-noeud',
  });
}

async function buildUseCase(overrides: { existsAndPublishedMock?: jest.Mock; villeExistante?: Ville | null }) {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const publishMock = jest.fn().mockResolvedValue(undefined);
  // `??` aurait remplacé un `villeExistante: null` explicite (voulant simuler "introuvable")
  // par la valeur par défaut — `null` est une valeur "nullish", exactement ce que `??`
  // court-circuite. Vérifier la présence de la clé distingue "non fourni" de "fourni à null".
  const villeResolue = 'villeExistante' in overrides ? overrides.villeExistante : villeFictive();
  const moduleRef = await Test.createTestingModule({
    providers: [
      MoveVilleUseCase,
      {
        provide: VILLE_REPOSITORY,
        useValue: {
          findById: jest.fn().mockResolvedValue(villeResolue),
          save: saveMock,
        },
      },
      { provide: EVENT_PUBLISHER, useValue: { publish: publishMock } },
      {
        provide: REFERENTIAL_ENGINE_LOOKUP_PORT,
        useValue: { existsAndPublished: overrides.existsAndPublishedMock ?? jest.fn().mockResolvedValue(true) },
      },
    ],
  }).compile();

  return { useCase: moduleRef.get(MoveVilleUseCase), saveMock, publishMock };
}

describe('MoveVilleUseCase (intégration application) — KER-ADM-04, alimente le compteur via VILLE_MOVED', () => {
  it('REFUSE si la ville n\'existe pas', async () => {
    const { useCase } = await buildUseCase({ villeExistante: null });
    await expect(useCase.execute('ville-inexistante', 'nouveau-noeud')).rejects.toThrow(VilleNotFoundError);
  });

  it('REFUSE si le nouveau nœud n\'existe pas ou n\'est pas publié', async () => {
    const { useCase, saveMock } = await buildUseCase({ existsAndPublishedMock: jest.fn().mockResolvedValue(false) });
    await expect(useCase.execute('ville-1', 'noeud-non-publie')).rejects.toThrow(UnpublishedHierarchicalNodeError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('publie VILLE_MOVED avec l\'ANCIEN et le NOUVEAU nœud — condition du compteur côté referential-engine', async () => {
    const { useCase, publishMock } = await buildUseCase({});

    await useCase.execute('ville-1', 'nouveau-noeud');

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'referential.ville.moved',
        chargeUtile: {
          id: 'ville-1',
          ancienReferentielHierarchiqueId: 'ancien-noeud',
          nouveauReferentielHierarchiqueId: 'nouveau-noeud',
        },
      }),
    );
  });

  it('accepte un déplacement vers "aucun nœud" (détachement complet, sans validation de nœud)', async () => {
    const existsAndPublishedMock = jest.fn();
    const { useCase, publishMock } = await buildUseCase({ existsAndPublishedMock });

    await useCase.execute('ville-1', null);

    expect(existsAndPublishedMock).not.toHaveBeenCalled();
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chargeUtile: expect.objectContaining({ nouveauReferentielHierarchiqueId: null }),
      }),
    );
  });
});
