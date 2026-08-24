import {
  NoeudHierarchique,
  wouldCreateCycle,
  assertNoPublishedChildren,
  NodeHasPublishedChildrenError,
  CrossCountryReattachmentError,
} from '../../../../src/referential-engine/domain/entities/noeud-hierarchique.entity';
import {
  WorkflowEngineTransitionError,
  assertEngineTransitionAllowed,
} from '../../../../src/referential-engine/domain/entities/workflow';

function creerRacine(id = 'racine-1'): NoeudHierarchique {
  return NoeudHierarchique.createRoot({
    id,
    paysId: 'pays-gn',
    codeDomaine: 'administratif',
    appellationLocale: 'Conakry (région)',
  });
}

describe('NoeudHierarchique — Materialized Path', () => {
  it('un nœud racine porte un chemin égal à "/soi-même/"', () => {
    const racine = creerRacine('racine-1');
    expect(racine.chemin).toBe('/racine-1/');
    expect(racine.parentId).toBeNull();
    expect(racine.rangNormalise).toBe(1);
  });

  it('un enfant concatène le chemin du parent avec son propre id', () => {
    const racine = creerRacine('racine-1');
    const enfant = NoeudHierarchique.createChild({
      id: 'enfant-1',
      parent: racine,
      appellationLocale: 'Kaloum (préfecture)',
    });

    expect(enfant.chemin).toBe('/racine-1/enfant-1/');
    expect(enfant.parentId).toBe('racine-1');
    expect(enfant.rangNormalise).toBe(2);
  });

  it('un petit-enfant hérite du pays et du codeDomaine, jamais fournis directement', () => {
    const racine = creerRacine('racine-1');
    const enfant = NoeudHierarchique.createChild({ id: 'enfant-1', parent: racine, appellationLocale: 'X' });
    const petitEnfant = NoeudHierarchique.createChild({ id: 'petit-enfant-1', parent: enfant, appellationLocale: 'Y' });

    expect(petitEnfant.chemin).toBe('/racine-1/enfant-1/petit-enfant-1/');
    expect(petitEnfant.paysId).toBe('pays-gn');
    expect(petitEnfant.codeDomaine).toBe('administratif');
    expect(petitEnfant.rangNormalise).toBe(3);
  });

  it('reattachToParent recalcule le chemin ET le rang normalisé', () => {
    const racineA = creerRacine('racine-a');
    const racineB = creerRacine('racine-b');
    const enfant = NoeudHierarchique.createChild({ id: 'enfant-1', parent: racineA, appellationLocale: 'X' });

    enfant.reattachToParent(racineB);

    expect(enfant.chemin).toBe('/racine-b/enfant-1/');
    expect(enfant.parentId).toBe('racine-b');
    expect(enfant.rangNormalise).toBe(2);
  });

  it('reattachToParent(null) transforme le nœud en nouvelle racine', () => {
    const racine = creerRacine();
    const enfant = NoeudHierarchique.createChild({ id: 'enfant-1', parent: racine, appellationLocale: 'X' });

    enfant.reattachToParent(null);

    expect(enfant.chemin).toBe('/enfant-1/');
    expect(enfant.parentId).toBeNull();
    expect(enfant.rangNormalise).toBe(1);
  });

  it('refuse un rattachement à un parent d\'un AUTRE pays', () => {
    const racineGuinee = NoeudHierarchique.createRoot({
      id: 'racine-gn',
      paysId: 'pays-gn',
      codeDomaine: 'administratif',
      appellationLocale: 'X',
    });
    const racineSenegal = NoeudHierarchique.createRoot({
      id: 'racine-sn',
      paysId: 'pays-sn',
      codeDomaine: 'administratif',
      appellationLocale: 'Y',
    });
    const enfant = NoeudHierarchique.createChild({ id: 'enfant-1', parent: racineGuinee, appellationLocale: 'Z' });

    expect(() => enfant.reattachToParent(racineSenegal)).toThrow(CrossCountryReattachmentError);
  });
});

describe('wouldCreateCycle (fonction pure) — détection de cycle sans requête récursive', () => {
  it('un nœud rattaché à un parent qui n\'est PAS son descendant : aucun cycle', () => {
    // /racine/branche-a/  vers  /racine/branche-b/  — aucun chevauchement de préfixe.
    expect(wouldCreateCycle('/racine/branche-a/', '/racine/branche-b/')).toBe(false);
  });

  it('un nœud rattaché à SON PROPRE descendant direct : cycle détecté', () => {
    // Le nœud /racine/A/ tenterait de se rattacher à /racine/A/B/, son propre enfant.
    expect(wouldCreateCycle('/racine/A/', '/racine/A/B/')).toBe(true);
  });

  it('un nœud rattaché à un descendant profond (petit-enfant) : cycle détecté', () => {
    expect(wouldCreateCycle('/racine/A/', '/racine/A/B/C/D/')).toBe(true);
  });

  it('un nœud rattaché à LUI-MÊME : cycle détecté (cas limite)', () => {
    expect(wouldCreateCycle('/racine/A/', '/racine/A/')).toBe(true);
  });

  it('un nœud rattaché à son PARENT (remontée d\'un niveau) : aucun cycle', () => {
    expect(wouldCreateCycle('/racine/A/B/', '/racine/A/')).toBe(false);
  });

  it('deux branches de préfixe textuel similaire mais sans relation d\'ascendance : aucun faux positif', () => {
    // "/racine/A/" et "/racine/AB/" partagent un préfixe de caractères mais ne sont PAS
    // dans une relation ancêtre-descendant — le slash final évite ce piège classique du
    // Materialized Path (comparer par segments, pas par simple préfixe de caractères bruts).
    expect(wouldCreateCycle('/racine/A/', '/racine/AB/')).toBe(false);
  });
});

describe('assertNoPublishedChildren (fonction pure) — garde-fou KER-ADM-04', () => {
  function enfantAvecStatut(statut: 'brouillon' | 'en_revision' | 'valide' | 'publie', estActif: boolean) {
    const racine = creerRacine();
    const enfant = NoeudHierarchique.createChild({ id: `enfant-${statut}-${estActif}`, parent: racine, appellationLocale: 'X' });
    if (statut === 'en_revision' || statut === 'valide' || statut === 'publie') enfant.submitForReview();
    if (statut === 'valide' || statut === 'publie') enfant.validate();
    if (statut === 'publie') enfant.publish();
    if (!estActif) enfant.deactivate();
    return enfant;
  }

  it('n\'échoue pas si aucun enfant n\'est publié', () => {
    const enfants = [enfantAvecStatut('brouillon', true), enfantAvecStatut('valide', true)];
    expect(() => assertNoPublishedChildren(enfants)).not.toThrow();
  });

  it('refuse si au moins un enfant est publié ET actif', () => {
    const enfants = [enfantAvecStatut('brouillon', true), enfantAvecStatut('publie', true)];
    expect(() => assertNoPublishedChildren(enfants)).toThrow(NodeHasPublishedChildrenError);
  });

  it('n\'échoue PAS si l\'enfant publié est désactivé (estActif=false)', () => {
    // Un enfant publié mais désactivé n'est plus "en usage" — la contrainte KER-ADM-04 ne
    // porte que sur les enfants publiés ET actifs simultanément.
    const enfants = [enfantAvecStatut('publie', false)];
    expect(() => assertNoPublishedChildren(enfants)).not.toThrow();
  });

  it('n\'échoue jamais sur une liste vide', () => {
    expect(() => assertNoPublishedChildren([])).not.toThrow();
  });
});

describe('Workflow Referential Engine (copie locale isolée) — 4 états exacts, sans ARCHIVE', () => {
  it.each([
    ['brouillon', 'en_revision'],
    ['en_revision', 'valide'],
    ['en_revision', 'brouillon'],
    ['valide', 'publie'],
    ['valide', 'en_revision'],
  ] as const)('autorise %s → %s', (from, to) => {
    expect(() => assertEngineTransitionAllowed(from, to)).not.toThrow();
  });

  it('refuse de sauter directement de "brouillon" à "publie"', () => {
    expect(() => assertEngineTransitionAllowed('brouillon', 'publie')).toThrow(WorkflowEngineTransitionError);
  });

  it('"publie" est un état terminal : aucune transition sortante', () => {
    (['brouillon', 'en_revision', 'valide', 'publie'] as const).forEach((to) => {
      expect(() => assertEngineTransitionAllowed('publie', to)).toThrow();
    });
  });
});
