import { Test } from '@nestjs/testing';
import {
  CreateNoeudUseCase,
  MissingRootNodeFieldsError,
  ReattachNoeudUseCase,
  SetNoeudActivationUseCase,
} from '../../../src/referential-engine/application/use-cases/noeud-hierarchique.use-cases';
import {
  NIVEAU_ADMINISTRATIF_REPOSITORY,
  NOEUD_HIERARCHIQUE_REPOSITORY,
} from '../../../src/referential-engine/domain/repositories/referential-engine.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import {
  NoeudHierarchiqueNotFoundError,
  UndefinedNiveauForRangError,
} from '../../../src/referential-engine/domain/exceptions/referential-engine.exceptions';
import {
  CircularReattachmentError,
  NodeHasPublishedChildrenError,
  NoeudHierarchique,
} from '../../../src/referential-engine/domain/entities/noeud-hierarchique.entity';
import { NiveauAdministratif } from '../../../src/referential-engine/domain/entities/niveau-administratif.entity';

function racine(id: string, paysId = 'pays-gn'): NoeudHierarchique {
  return NoeudHierarchique.createRoot({ id, paysId, codeDomaine: 'administratif', appellationLocale: 'X' });
}

describe('CreateNoeudUseCase (intégration application) — validation du niveau (KER-ADM-01)', () => {
  it('refuse la création d\'une racine si aucun NiveauAdministratif de rang 1 n\'est défini pour le pays', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateNoeudUseCase,
        { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useValue: { save: jest.fn() } },
        {
          provide: NIVEAU_ADMINISTRATIF_REPOSITORY,
          useValue: { findByPaysAndRang: jest.fn().mockResolvedValue(null) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateNoeudUseCase);
    await expect(
      useCase.execute({ paysId: 'pays-sans-niveau', codeDomaine: 'administratif', parentId: null, appellationLocale: 'X' }),
    ).rejects.toThrow(UndefinedNiveauForRangError);
  });

  it('refuse la création d\'une racine sans paysId ni codeDomaine', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateNoeudUseCase,
        { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useValue: { save: jest.fn() } },
        { provide: NIVEAU_ADMINISTRATIF_REPOSITORY, useValue: { findByPaysAndRang: jest.fn() } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateNoeudUseCase);
    await expect(
      useCase.execute({ parentId: null, appellationLocale: 'X' }),
    ).rejects.toThrow(MissingRootNodeFieldsError);
  });

  it('crée une racine si le niveau 1 est défini pour ce pays', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateNoeudUseCase,
        { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useValue: { save: saveMock } },
        {
          provide: NIVEAU_ADMINISTRATIF_REPOSITORY,
          useValue: {
            findByPaysAndRang: jest
              .fn()
              .mockResolvedValue(NiveauAdministratif.create({ id: 'niveau-1', paysId: 'pays-gn', rang: 1, nom: 'Région' })),
          },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateNoeudUseCase);
    await expect(
      useCase.execute({ paysId: 'pays-gn', codeDomaine: 'administratif', parentId: null, appellationLocale: 'Conakry' }),
    ).resolves.toHaveProperty('id');
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('refuse la création d\'un enfant si le niveau du parent+1 n\'est pas défini', async () => {
    const parent = racine('racine-1');
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateNoeudUseCase,
        { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(parent), save: jest.fn() } },
        { provide: NIVEAU_ADMINISTRATIF_REPOSITORY, useValue: { findByPaysAndRang: jest.fn().mockResolvedValue(null) } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateNoeudUseCase);
    await expect(
      useCase.execute({ parentId: 'racine-1', appellationLocale: 'Kaloum' }),
    ).rejects.toThrow(UndefinedNiveauForRangError);
  });
});

describe('ReattachNoeudUseCase (intégration application) — cycle et garde-fou KER-ADM-04', () => {
  it('REFUSE le réattachement si le nœud a un enfant publié et actif', async () => {
    const noeud = racine('noeud-1');
    const enfantPublie = NoeudHierarchique.createChild({ id: 'enfant-1', parent: noeud, appellationLocale: 'X' });
    enfantPublie.submitForReview();
    enfantPublie.validate();
    enfantPublie.publish();

    const saveMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachNoeudUseCase,
        {
          provide: NOEUD_HIERARCHIQUE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockResolvedValue(noeud),
            findChildren: jest.fn().mockResolvedValue([enfantPublie]),
            save: saveMock,
          },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachNoeudUseCase);
    await expect(useCase.execute('noeud-1', 'autre-parent')).rejects.toThrow(NodeHasPublishedChildrenError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('REFUSE le réattachement s\'il créerait un cycle (nouveau parent = descendant)', async () => {
    const racineNoeud = racine('racine-1');
    const enfant = NoeudHierarchique.createChild({ id: 'enfant-1', parent: racineNoeud, appellationLocale: 'X' });
    const petitEnfant = NoeudHierarchique.createChild({ id: 'petit-enfant-1', parent: enfant, appellationLocale: 'Y' });

    const findByIdMock = jest.fn().mockImplementation((id: string) => {
      if (id === 'racine-1') return Promise.resolve(racineNoeud);
      if (id === 'petit-enfant-1') return Promise.resolve(petitEnfant);
      return Promise.resolve(null);
    });
    const saveMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachNoeudUseCase,
        {
          provide: NOEUD_HIERARCHIQUE_REPOSITORY,
          useValue: { findById: findByIdMock, findChildren: jest.fn().mockResolvedValue([]), save: saveMock },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachNoeudUseCase);
    // racine-1 tente de se rattacher à son propre petit-enfant : cycle.
    await expect(useCase.execute('racine-1', 'petit-enfant-1')).rejects.toThrow(CircularReattachmentError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('autorise un réattachement légitime (pas de cycle, pas d\'enfant publié)', async () => {
    const ancienParent = racine('ancien-parent');
    const nouveauParent = racine('nouveau-parent');
    const noeud = NoeudHierarchique.createChild({ id: 'noeud-1', parent: ancienParent, appellationLocale: 'X' });

    const findByIdMock = jest.fn().mockImplementation((id: string) => {
      if (id === 'noeud-1') return Promise.resolve(noeud);
      if (id === 'nouveau-parent') return Promise.resolve(nouveauParent);
      return Promise.resolve(null);
    });
    const saveMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachNoeudUseCase,
        {
          provide: NOEUD_HIERARCHIQUE_REPOSITORY,
          useValue: { findById: findByIdMock, findChildren: jest.fn().mockResolvedValue([]), save: saveMock },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachNoeudUseCase);
    await useCase.execute('noeud-1', 'nouveau-parent');

    expect(saveMock).toHaveBeenCalledTimes(1);
    const noeudSauvegarde = saveMock.mock.calls[0][0] as NoeudHierarchique;
    expect(noeudSauvegarde.chemin).toBe('/nouveau-parent/noeud-1/');
  });

  it('propage NoeudHierarchiqueNotFoundError si le nœud à réattacher n\'existe pas', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReattachNoeudUseCase,
        { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(null) } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(ReattachNoeudUseCase);
    await expect(useCase.execute('inexistant', 'peu-importe')).rejects.toThrow(NoeudHierarchiqueNotFoundError);
  });
});

describe('SetNoeudActivationUseCase (intégration application) — garde-fou sur la désactivation', () => {
  it('REFUSE la désactivation si un enfant est publié et actif', async () => {
    const noeud = racine('noeud-1');
    const enfantPublie = NoeudHierarchique.createChild({ id: 'enfant-1', parent: noeud, appellationLocale: 'X' });
    enfantPublie.submitForReview();
    enfantPublie.validate();
    enfantPublie.publish();

    const saveMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SetNoeudActivationUseCase,
        {
          provide: NOEUD_HIERARCHIQUE_REPOSITORY,
          useValue: {
            findById: jest.fn().mockResolvedValue(noeud),
            findChildren: jest.fn().mockResolvedValue([enfantPublie]),
            save: saveMock,
          },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(SetNoeudActivationUseCase);
    await expect(useCase.deactivate('noeud-1')).rejects.toThrow(NodeHasPublishedChildrenError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('autorise la désactivation si aucun enfant n\'est publié et actif', async () => {
    const noeud = racine('noeud-1');
    const saveMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SetNoeudActivationUseCase,
        {
          provide: NOEUD_HIERARCHIQUE_REPOSITORY,
          useValue: { findById: jest.fn().mockResolvedValue(noeud), findChildren: jest.fn().mockResolvedValue([]), save: saveMock },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    const useCase = moduleRef.get(SetNoeudActivationUseCase);
    await useCase.deactivate('noeud-1');
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
