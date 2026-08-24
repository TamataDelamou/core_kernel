import {
  BRIQUES_NOYAU_VALIDES,
  InvalidBriqueError,
  InvalidCodeProduitPortefeuilleError,
  ProduitPortefeuille,
} from '../../../../src/product-registry/domain/entities/produit-portefeuille.entity';

describe('ProduitPortefeuille (domaine Product Registry) — KER-PROD-01/04', () => {
  it('normalise le code en minuscules', () => {
    const produit = ProduitPortefeuille.create({ id: 'p1', code: 'AssoShop', nom: 'AssoShop' });
    expect(produit.code).toBe('assoshop');
  });

  it('refuse un code trop court', () => {
    expect(() => ProduitPortefeuille.create({ id: 'p1', code: 'a', nom: 'X' })).toThrow(
      InvalidCodeProduitPortefeuilleError,
    );
  });

  it('refuse un code contenant des caractères non autorisés', () => {
    expect(() => ProduitPortefeuille.create({ id: 'p1', code: 'Asso Shop!', nom: 'X' })).toThrow(
      InvalidCodeProduitPortefeuilleError,
    );
  });

  it('démarre actif, sans brique déclarée par défaut', () => {
    const produit = ProduitPortefeuille.create({ id: 'p1', code: 'ecclesias360', nom: 'Ecclesias 360' });
    expect(produit.estActif).toBe(true);
    expect(produit.toSnapshot().briquesConsommees).toEqual([]);
  });

  it('accepte une liste de briques valides à la création', () => {
    const produit = ProduitPortefeuille.create({
      id: 'p1',
      code: 'assoshop',
      nom: 'AssoShop',
      briquesConsommees: ['gsg_id', 'org_registry'],
    });
    expect(produit.toSnapshot().briquesConsommees).toEqual(['gsg_id', 'org_registry']);
  });

  it('refuse une brique inconnue à la création', () => {
    expect(() =>
      ProduitPortefeuille.create({
        id: 'p1',
        code: 'assoshop',
        nom: 'AssoShop',
        briquesConsommees: ['brique_inexistante' as never],
      }),
    ).toThrow(InvalidBriqueError);
  });

  it('déclare de nouvelles briques consommées, en dédupliquant', () => {
    const produit = ProduitPortefeuille.create({ id: 'p1', code: 'assoshop', nom: 'AssoShop' });
    produit.declareBriquesConsommees(['gsg_id', 'gsg_id', 'audit']);
    expect(produit.toSnapshot().briquesConsommees).toEqual(['gsg_id', 'audit']);
  });

  it('refuse de déclarer une brique inconnue', () => {
    const produit = ProduitPortefeuille.create({ id: 'p1', code: 'assoshop', nom: 'AssoShop' });
    expect(() => produit.declareBriquesConsommees(['brique_inexistante' as never])).toThrow(InvalidBriqueError);
  });

  it('couvre exactement les 8 briques du noyau attendues (KER-PROD-04)', () => {
    expect([...BRIQUES_NOYAU_VALIDES].sort()).toEqual(
      ['audit', 'billing', 'design_system', 'event_bus', 'gsg_id', 'gsg_referential', 'org_registry', 'referential_engine'].sort(),
    );
  });

  it('désactive et réactive sans perdre les briques déclarées', () => {
    const produit = ProduitPortefeuille.create({
      id: 'p1',
      code: 'assoshop',
      nom: 'AssoShop',
      briquesConsommees: ['gsg_id'],
    });
    produit.deactivate();
    expect(produit.estActif).toBe(false);
    produit.reactivate();
    expect(produit.estActif).toBe(true);
    expect(produit.toSnapshot().briquesConsommees).toEqual(['gsg_id']);
  });
});
