import { Test } from '@nestjs/testing';
import { RegleLookupAdapter } from '../../../src/referential-engine/infrastructure/adapters/regle-lookup.adapter';
import { CorpusLookupAdapter } from '../../../src/referential-engine/infrastructure/adapters/corpus-lookup.adapter';
import {
  CORPUS_ELEMENT_REPOSITORY,
  CORPUS_VERSIONNE_REPOSITORY,
  REFERENTIEL_REGLE_REPOSITORY,
} from '../../../src/referential-engine/domain/repositories/referential-engine.repositories';
import { ReferentielRegle } from '../../../src/referential-engine/domain/entities/referentiel-regle.entity';
import { MetadonneesGouvernance } from '../../../src/referential-engine/domain/entities/gouvernance';
import { CorpusVersionne } from '../../../src/referential-engine/domain/entities/corpus-versionne.entity';
import { CorpusElement } from '../../../src/referential-engine/domain/entities/corpus-element.entity';

describe('RegleLookupAdapter (intégration application) — KER-ENG-06 à la frontière du port', () => {
  it('ne renvoie que ce que le repository lui donne via findPublieesEtVerifieesByNoeud (jamais un autre appel)', async () => {
    const regle = ReferentielRegle.create({
      id: 'regle-1',
      referentielHierarchiqueId: 'noeud-1',
      codeDomaine: 'fiscal',
      nom: 'Taux de TVA',
      sigle: 'TVA',
      valeur: '18',
      gouvernance: MetadonneesGouvernance.create({
        organismeCertificateur: 'DGI',
        statutConfiance: 'ELEVE',
        source: 'Code des impôts',
      }),
    });

    const findPublieesEtVerifieesByNoeudMock = jest.fn().mockResolvedValue([regle]);
    const findByNoeudMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        RegleLookupAdapter,
        {
          provide: REFERENTIEL_REGLE_REPOSITORY,
          useValue: {
            findPublieesEtVerifieesByNoeud: findPublieesEtVerifieesByNoeudMock,
            findByNoeud: findByNoeudMock,
          },
        },
      ],
    }).compile();

    const adapter = moduleRef.get(RegleLookupAdapter);
    const resultat = await adapter.getReglesForNoeud('noeud-1');

    expect(findPublieesEtVerifieesByNoeudMock).toHaveBeenCalledWith('noeud-1');
    expect(findByNoeudMock).not.toHaveBeenCalled();
    expect(resultat).toEqual([
      { id: 'regle-1', nom: 'Taux de TVA', sigle: 'TVA', valeur: '18', organismeCertificateur: 'DGI' },
    ]);
  });

  it('renvoie un tableau vide si aucune règle publiée et vérifiée n\'existe pour ce nœud', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RegleLookupAdapter,
        {
          provide: REFERENTIEL_REGLE_REPOSITORY,
          useValue: { findPublieesEtVerifieesByNoeud: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    const adapter = moduleRef.get(RegleLookupAdapter);
    expect(await adapter.getReglesForNoeud('noeud-1')).toEqual([]);
  });
});

describe('CorpusLookupAdapter (intégration application) — jamais un corpus brouillon', () => {
  it('renvoie null si aucun corpus publié n\'existe (jamais un brouillon en repli)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CorpusLookupAdapter,
        {
          provide: CORPUS_VERSIONNE_REPOSITORY,
          useValue: { findPublieByPaysAndCodeDomaine: jest.fn().mockResolvedValue(null) },
        },
        { provide: CORPUS_ELEMENT_REPOSITORY, useValue: { findByCorpusVersionne: jest.fn() } },
      ],
    }).compile();

    const adapter = moduleRef.get(CorpusLookupAdapter);
    expect(await adapter.getCorpusPublie('pays-gn', 'education')).toBeNull();
  });

  it('assemble le corpus publié avec ses éléments', async () => {
    const corpus = CorpusVersionne.create({
      id: 'corpus-1',
      paysId: 'pays-gn',
      codeDomaine: 'education',
      libelleVersion: 'Année scolaire 2026-2027',
      gouvernance: MetadonneesGouvernance.create({
        organismeCertificateur: "Ministère de l'Éducation",
        statutConfiance: 'ELEVE',
        source: 'Programme officiel',
      }),
    });
    corpus.publish();

    const element = CorpusElement.create({
      id: 'element-1',
      corpusVersionneId: 'corpus-1',
      referentielHierarchiqueId: 'noeud-1',
      nom: 'Mathématiques',
      valeurOuCoefficient: '4',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CorpusLookupAdapter,
        {
          provide: CORPUS_VERSIONNE_REPOSITORY,
          useValue: { findPublieByPaysAndCodeDomaine: jest.fn().mockResolvedValue(corpus) },
        },
        {
          provide: CORPUS_ELEMENT_REPOSITORY,
          useValue: { findByCorpusVersionne: jest.fn().mockResolvedValue([element]) },
        },
      ],
    }).compile();

    const adapter = moduleRef.get(CorpusLookupAdapter);
    const resultat = await adapter.getCorpusPublie('pays-gn', 'education');

    expect(resultat).toEqual({
      id: 'corpus-1',
      libelleVersion: 'Année scolaire 2026-2027',
      organismeCertificateur: "Ministère de l'Éducation",
      elements: [{ id: 'element-1', parentId: null, nom: 'Mathématiques', valeurOuCoefficient: '4', ordre: 0 }],
    });
  });
});
