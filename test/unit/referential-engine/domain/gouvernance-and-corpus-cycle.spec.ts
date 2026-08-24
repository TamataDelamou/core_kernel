import {
  InvalidStatutConfianceError,
  MetadonneesGouvernance,
  MissingOrganismeCertificateurError,
} from '../../../../src/referential-engine/domain/entities/gouvernance';
import { wouldCreateCycleInCorpus } from '../../../../src/referential-engine/domain/entities/corpus-element.entity';
import {
  assertCorpusTransitionAllowed,
  CorpusWorkflowTransitionError,
} from '../../../../src/referential-engine/domain/entities/corpus-workflow';

describe('MetadonneesGouvernance (domaine) — KER-ENG-05/06', () => {
  it('refuse un organisme certificateur vide', () => {
    expect(() =>
      MetadonneesGouvernance.create({ organismeCertificateur: '   ', statutConfiance: 'ELEVE', source: 'X' }),
    ).toThrow(MissingOrganismeCertificateurError);
  });

  it('refuse un statut de confiance inconnu', () => {
    expect(() =>
      MetadonneesGouvernance.create({
        organismeCertificateur: 'Ministère',
        statutConfiance: 'INCONNU' as never,
        source: 'X',
      }),
    ).toThrow(InvalidStatutConfianceError);
  });

  it('estVerifie est faux uniquement pour A_VERIFIER', () => {
    const eleve = MetadonneesGouvernance.create({ organismeCertificateur: 'X', statutConfiance: 'ELEVE', source: 'Y' });
    const moyen = MetadonneesGouvernance.create({ organismeCertificateur: 'X', statutConfiance: 'MOYEN', source: 'Y' });
    const aVerifier = MetadonneesGouvernance.create({ organismeCertificateur: 'X', statutConfiance: 'A_VERIFIER', source: 'Y' });

    expect(eleve.estVerifie).toBe(true);
    expect(moyen.estVerifie).toBe(true);
    expect(aVerifier.estVerifie).toBe(false);
  });

  it('horodate automatiquement la dernière vérification si non fournie', () => {
    const avant = Date.now();
    const gouvernance = MetadonneesGouvernance.create({ organismeCertificateur: 'X', statutConfiance: 'ELEVE', source: 'Y' });
    const apres = Date.now();

    const timestamp = gouvernance.toSnapshot().dateDerniereVerification.getTime();
    expect(timestamp).toBeGreaterThanOrEqual(avant);
    expect(timestamp).toBeLessThanOrEqual(apres);
  });
});

describe('wouldCreateCycleInCorpus (domaine) — détection de cycle sans Materialized Path', () => {
  it('aucun cycle : le nouveau parent n\'est pas un descendant', () => {
    const elements = [
      { id: 'chapitre-1', parentId: null },
      { id: 'chapitre-2', parentId: null },
      { id: 'article-1', parentId: 'chapitre-1' },
    ];
    expect(wouldCreateCycleInCorpus(elements, 'article-1', 'chapitre-2')).toBe(false);
  });

  it('cycle détecté : rattachement à son propre enfant direct', () => {
    const elements = [
      { id: 'chapitre-1', parentId: null },
      { id: 'article-1', parentId: 'chapitre-1' },
    ];
    expect(wouldCreateCycleInCorpus(elements, 'chapitre-1', 'article-1')).toBe(true);
  });

  it('cycle détecté : rattachement à un petit-enfant (profondeur 2)', () => {
    const elements = [
      { id: 'chapitre-1', parentId: null },
      { id: 'article-1', parentId: 'chapitre-1' },
      { id: 'sous-article-1', parentId: 'article-1' },
    ];
    expect(wouldCreateCycleInCorpus(elements, 'chapitre-1', 'sous-article-1')).toBe(true);
  });

  it('rattachement à SOI-MÊME : cycle détecté (cas limite)', () => {
    const elements = [{ id: 'article-1', parentId: null }];
    expect(wouldCreateCycleInCorpus(elements, 'article-1', 'article-1')).toBe(true);
  });

  it('remontée vers le parent actuel : aucun cycle', () => {
    const elements = [
      { id: 'chapitre-1', parentId: null },
      { id: 'article-1', parentId: 'chapitre-1' },
    ];
    expect(wouldCreateCycleInCorpus(elements, 'article-1', 'chapitre-1')).toBe(false);
  });

  it('ne boucle jamais indéfiniment si une autre boucle existe déjà ailleurs dans les données', () => {
    const elements = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
      { id: 'isole', parentId: null },
    ];
    expect(() => wouldCreateCycleInCorpus(elements, 'isole', 'a')).not.toThrow();
  });
});

describe('assertCorpusTransitionAllowed — workflow à 3 états du corpus', () => {
  it('autorise brouillon -> publie -> archive', () => {
    expect(() => assertCorpusTransitionAllowed('brouillon', 'publie')).not.toThrow();
    expect(() => assertCorpusTransitionAllowed('publie', 'archive')).not.toThrow();
  });

  it('refuse de sauter directement de brouillon à archive', () => {
    expect(() => assertCorpusTransitionAllowed('brouillon', 'archive')).toThrow(CorpusWorkflowTransitionError);
  });

  it('refuse tout retour arrière depuis archive (état terminal)', () => {
    expect(() => assertCorpusTransitionAllowed('archive', 'publie')).toThrow(CorpusWorkflowTransitionError);
    expect(() => assertCorpusTransitionAllowed('archive', 'brouillon')).toThrow(CorpusWorkflowTransitionError);
  });

  it('n\'a jamais d\'état "en_revision" ni "valide" — seulement 3 états, contrairement au workflow des nœuds', () => {
    expect(() => assertCorpusTransitionAllowed('brouillon', 'en_revision' as never)).toThrow();
  });
});
