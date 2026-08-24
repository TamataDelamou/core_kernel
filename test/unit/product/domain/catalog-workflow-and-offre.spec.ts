import {
  assertCatalogTransitionAllowed,
  CatalogWorkflowTransitionError,
} from '../../../../src/product/domain/entities/catalog-workflow';
import { Catalogue, CatalogueScope, InvalidCatalogueScopeError } from '../../../../src/product/domain/entities/catalogue.entity';
import { Offre, IncompatibleBillingPeriodError } from '../../../../src/product/domain/entities/offre.entity';
import { Produit, InvalidCodeProduitError } from '../../../../src/product/domain/entities/produit.entity';

describe('Workflow catalogue à 4 états (KER-PRD) — assertCatalogTransitionAllowed', () => {
  it.each([
    ['brouillon', 'valide'],
    ['valide', 'publie'],
    ['valide', 'brouillon'],
    ['publie', 'archive'],
  ] as const)('autorise %s → %s', (from, to) => {
    expect(() => assertCatalogTransitionAllowed(from, to)).not.toThrow();
  });

  it.each([
    ['brouillon', 'publie'],
    ['brouillon', 'archive'],
    ['valide', 'archive'],
    ['publie', 'brouillon'],
    ['publie', 'valide'],
    ['archive', 'brouillon'],
    ['archive', 'valide'],
    ['archive', 'publie'],
  ] as const)('refuse %s → %s', (from, to) => {
    expect(() => assertCatalogTransitionAllowed(from, to)).toThrow(CatalogWorkflowTransitionError);
  });

  it('"archive" est un état terminal absolu — aucune sortie possible', () => {
    (['brouillon', 'valide', 'publie', 'archive'] as const).forEach((to) => {
      expect(() => assertCatalogTransitionAllowed('archive', to)).toThrow();
    });
  });
});

describe('CatalogueScope (Value Object) — KER-PRD multi-catalogues', () => {
  it('un scope "portefeuille_global" ne porte jamais de cibleId', () => {
    const scope = CatalogueScope.portefeuilleGlobal();
    expect(scope.getType()).toBe('portefeuille_global');
    expect(scope.getCibleId()).toBeNull();
  });

  it('un scope "organisation" exige un organisationId non vide', () => {
    expect(() => CatalogueScope.organisation('')).toThrow(InvalidCatalogueScopeError);
    expect(CatalogueScope.organisation('org-1').getCibleId()).toBe('org-1');
  });

  it('un scope "zone_geographique" exige un paysId non vide', () => {
    expect(() => CatalogueScope.zoneGeographique('')).toThrow(InvalidCatalogueScopeError);
    expect(CatalogueScope.zoneGeographique('pays-gn').getCibleId()).toBe('pays-gn');
  });

  it('reconstitute refuse un scope non global sans cibleId', () => {
    expect(() => CatalogueScope.reconstitute('organisation', null)).toThrow(
      InvalidCatalogueScopeError,
    );
  });

  it('deux scopes de même type et même cible sont égaux', () => {
    const a = CatalogueScope.organisation('org-1');
    const b = CatalogueScope.organisation('org-1');
    expect(a.equals(b)).toBe(true);
  });
});

describe('Catalogue — cycle de vie complet jusqu\'à l\'archivage', () => {
  it('parcourt brouillon → valide → publie → archive sans erreur', () => {
    const catalogue = Catalogue.create({
      id: 'cat-1',
      nom: 'Catalogue Guinée',
      scope: CatalogueScope.zoneGeographique('pays-gn'),
    });

    catalogue.validate();
    catalogue.publish();
    catalogue.archive();

    expect(catalogue.statutWorkflow).toBe('archive');
  });

  it('la désactivation (estActif) est indépendante du statut de workflow', () => {
    const catalogue = Catalogue.create({
      id: 'cat-1',
      nom: 'Test',
      scope: CatalogueScope.portefeuilleGlobal(),
    });
    catalogue.validate();
    catalogue.publish();
    catalogue.deactivate();

    expect(catalogue.estActif).toBe(false);
    expect(catalogue.statutWorkflow).toBe('publie'); // le workflow n'est pas affecté
  });
});

describe('Produit — validation du code', () => {
  it('normalise le code en minuscules', () => {
    const produit = Produit.create({ id: 'p1', catalogueId: 'cat-1', code: 'PACK-ESSENTIEL', nom: 'Pack' });
    expect(produit.code).toBe('pack-essentiel');
  });

  it('refuse un code trop court', () => {
    expect(() => Produit.create({ id: 'p1', catalogueId: 'cat-1', code: 'a', nom: 'Pack' })).toThrow(
      InvalidCodeProduitError,
    );
  });

  it('refuse un code contenant des caractères non autorisés', () => {
    expect(() =>
      Produit.create({ id: 'p1', catalogueId: 'cat-1', code: 'pack essentiel!', nom: 'Pack' }),
    ).toThrow(InvalidCodeProduitError);
  });
});

describe('Offre — invariant de compatibilité type/période de facturation (KER-PRD)', () => {
  it('accepte une offre "ponctuel" avec une période "unique"', () => {
    expect(() =>
      Offre.create({
        id: 'o1',
        produitId: 'p1',
        code: 'achat-unique',
        nom: 'Achat unique',
        type: 'ponctuel',
        periodeFacturation: 'unique',
      }),
    ).not.toThrow();
  });

  it('refuse une offre "ponctuel" avec une période "mensuelle"', () => {
    expect(() =>
      Offre.create({
        id: 'o1',
        produitId: 'p1',
        code: 'achat-mensuel-invalide',
        nom: 'Invalide',
        type: 'ponctuel',
        periodeFacturation: 'mensuelle',
      }),
    ).toThrow(IncompatibleBillingPeriodError);
  });

  it('accepte une offre "abonnement" avec une période "mensuelle" ou "annuelle"', () => {
    expect(() =>
      Offre.create({
        id: 'o1',
        produitId: 'p1',
        code: 'abo-mensuel',
        nom: 'Abonnement mensuel',
        type: 'abonnement',
        periodeFacturation: 'mensuelle',
      }),
    ).not.toThrow();
    expect(() =>
      Offre.create({
        id: 'o2',
        produitId: 'p1',
        code: 'abo-annuel',
        nom: 'Abonnement annuel',
        type: 'abonnement',
        periodeFacturation: 'annuelle',
      }),
    ).not.toThrow();
  });

  it('refuse une offre "abonnement" avec une période "unique"', () => {
    expect(() =>
      Offre.create({
        id: 'o1',
        produitId: 'p1',
        code: 'abo-invalide',
        nom: 'Invalide',
        type: 'abonnement',
        periodeFacturation: 'unique',
      }),
    ).toThrow(IncompatibleBillingPeriodError);
  });

  it('refuse une offre "usage" avec une période "unique"', () => {
    expect(() =>
      Offre.create({
        id: 'o1',
        produitId: 'p1',
        code: 'usage-invalide',
        nom: 'Invalide',
        type: 'usage',
        periodeFacturation: 'unique',
      }),
    ).toThrow(IncompatibleBillingPeriodError);
  });

  it('accepte une offre "usage" avec une période "mensuelle"', () => {
    expect(() =>
      Offre.create({
        id: 'o1',
        produitId: 'p1',
        code: 'usage-mensuel',
        nom: 'Usage mensuel',
        type: 'usage',
        periodeFacturation: 'mensuelle',
      }),
    ).not.toThrow();
  });
});
