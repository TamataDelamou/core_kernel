import { Test } from '@nestjs/testing';
import { CreateReferentielRegleUseCase } from '../../../src/referential-engine/application/use-cases/referentiel-regle.use-cases';
import {
  NOEUD_HIERARCHIQUE_REPOSITORY,
  REFERENTIEL_REGLE_REPOSITORY,
} from '../../../src/referential-engine/domain/repositories/referential-engine.repositories';
import { EVENT_PUBLISHER } from '../../../src/common/kernel-ports/event-publisher.interface';
import { RegleNotAttachedToTerminalNodeError } from '../../../src/referential-engine/domain/entities/referentiel-regle.entity';
import { NoeudHierarchique } from '../../../src/referential-engine/domain/entities/noeud-hierarchique.entity';

function buildNoeud(estNoeudTerminal: boolean): NoeudHierarchique {
  return NoeudHierarchique.createRoot({
    id: 'noeud-1',
    paysId: 'pays-gn',
    codeDomaine: 'administratif',
    appellationLocale: 'X',
    estNoeudTerminal,
  });
}

const COMMAND_BASE = {
  referentielHierarchiqueId: 'noeud-1',
  nom: 'Taux de TVA standard',
  valeur: '18',
  organismeCertificateur: 'Direction Générale des Impôts',
  statutConfiance: 'ELEVE' as const,
  source: 'Code général des impôts, article 12',
};

describe('CreateReferentielRegleUseCase (intégration application) — KER-ENG-08, nœud terminal obligatoire', () => {
  it('REFUSE le rattachement à un nœud NON terminal', async () => {
    const saveMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateReferentielRegleUseCase,
        { provide: REFERENTIEL_REGLE_REPOSITORY, useValue: { save: saveMock } },
        { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(buildNoeud(false)) } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateReferentielRegleUseCase);
    await expect(useCase.execute(COMMAND_BASE)).rejects.toThrow(RegleNotAttachedToTerminalNodeError);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('REFUSE si le nœud référencé n\'existe pas du tout', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateReferentielRegleUseCase,
        { provide: REFERENTIEL_REGLE_REPOSITORY, useValue: { save: jest.fn() } },
        { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(null) } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateReferentielRegleUseCase);
    await expect(useCase.execute(COMMAND_BASE)).rejects.toThrow(RegleNotAttachedToTerminalNodeError);
  });

  it('crée la règle si le nœud est bien terminal, avec le codeDomaine hérité du nœud', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateReferentielRegleUseCase,
        { provide: REFERENTIEL_REGLE_REPOSITORY, useValue: { save: saveMock } },
        { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(buildNoeud(true)) } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateReferentielRegleUseCase);
    const result = await useCase.execute(COMMAND_BASE);

    expect(result.id).toBeDefined();
    expect(saveMock).toHaveBeenCalledTimes(1);
    const regleSauvegardee = saveMock.mock.calls[0][0].toSnapshot();
    expect(regleSauvegardee.codeDomaine).toBe('administratif');
    expect(regleSauvegardee.gouvernance.toSnapshot().organismeCertificateur).toBe(
      'Direction Générale des Impôts',
    );
  });

  it('REFUSE (via MetadonneesGouvernance) un organisme certificateur vide, avant tout accès au repository', async () => {
    const saveMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateReferentielRegleUseCase,
        { provide: REFERENTIEL_REGLE_REPOSITORY, useValue: { save: saveMock } },
        { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useValue: { findById: jest.fn().mockResolvedValue(buildNoeud(true)) } },
        { provide: EVENT_PUBLISHER, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    const useCase = moduleRef.get(CreateReferentielRegleUseCase);
    await expect(useCase.execute({ ...COMMAND_BASE, organismeCertificateur: '   ' })).rejects.toThrow();
    expect(saveMock).not.toHaveBeenCalled();
  });
});
