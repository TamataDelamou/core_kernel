import { Test } from '@nestjs/testing';
import { CreateVilleUseCase } from '../../../src/referential/application/use-cases/ville.use-cases';
import {
  PAYS_REPOSITORY,
  VILLE_REPOSITORY,
} from '../../../src/referential/domain/repositories/referential.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_ENGINE_LOOKUP_PORT } from '../../../src/common/kernel-ports/referential-engine-lookup.port';
import { UnpublishedHierarchicalNodeError } from '../../../src/referential/domain/exceptions/referential.exceptions';
import { Pays } from '../../../src/referential/domain/entities/pays.entity';

const PAYS_FICTIF = Pays.create({ id: 'pays-gn', codeIso: 'GN', nom: 'Guinée' });

async function buildUseCase(existsAndPublishedMock: jest.Mock) {
  const saveMock = jest.fn().mockResolvedValue(undefined);
  const moduleRef = await Test.createTestingModule({
    providers: [
      CreateVilleUseCase,
      { provide: PAYS_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(PAYS_FICTIF) } },
      { provide: VILLE_REPOSITORY, useValue: { save: saveMock } },
      { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      { provide: REFERENTIAL_ENGINE_LOOKUP_PORT, useValue: { existsAndPublished: existsAndPublishedMock } },
    ],
  }).compile();

  return { useCase: moduleRef.get(CreateVilleUseCase), saveMock };
}

describe('CreateVilleUseCase (intégration application) — KER-ADM-03, fermeture via ReferentialEngineLookupPort', () => {
  it('crée la ville SANS jamais consulter le port si referentielHierarchiqueId est absent', async () => {
    const existsAndPublishedMock = jest.fn();
    const { useCase, saveMock } = await buildUseCase(existsAndPublishedMock);

    await useCase.execute({ paysId: 'pays-gn', nom: 'Conakry' });

    expect(existsAndPublishedMock).not.toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('REFUSE la création si le nœud référencé n\'existe pas ou n\'est pas publié', async () => {
    const { useCase, saveMock } = await buildUseCase(jest.fn().mockResolvedValue(false));

    await expect(
      useCase.execute({ paysId: 'pays-gn', nom: 'Conakry', referentielHierarchiqueId: 'noeud-brouillon' }),
    ).rejects.toThrow(UnpublishedHierarchicalNodeError);

    expect(saveMock).not.toHaveBeenCalled();
  });

  it('crée la ville si le nœud référencé existe et est publié', async () => {
    const existsAndPublishedMock = jest.fn().mockResolvedValue(true);
    const { useCase, saveMock } = await buildUseCase(existsAndPublishedMock);

    await useCase.execute({ paysId: 'pays-gn', nom: 'Conakry', referentielHierarchiqueId: 'noeud-publie' });

    expect(existsAndPublishedMock).toHaveBeenCalledWith('noeud-publie');
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
