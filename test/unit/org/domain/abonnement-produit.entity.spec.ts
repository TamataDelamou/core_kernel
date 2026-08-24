import {
  AbonnementProduit,
  InvalidAbonnementTransitionError,
} from '../../../../src/org/domain/entities/abonnement-produit.entity';

function creerAbonnement(): AbonnementProduit {
  return AbonnementProduit.create({
    id: 'abo-1',
    organisationId: 'org-1',
    produitId: 'produit-assoshop',
    dateDebut: new Date('2026-01-01T00:00:00Z'),
  });
}

describe('AbonnementProduit (domaine Org Registry) — KER-ORG-03', () => {
  it('démarre toujours au statut "actif"', () => {
    expect(creerAbonnement().statut).toBe('actif');
  });

  describe('transitions valides', () => {
    it('actif → suspendu → actif', () => {
      const abo = creerAbonnement();
      abo.suspend();
      expect(abo.statut).toBe('suspendu');
      abo.reactivate();
      expect(abo.statut).toBe('actif');
    });

    it('actif → résilié (état terminal)', () => {
      const abo = creerAbonnement();
      abo.resiliate(new Date('2026-06-01T00:00:00Z'));
      expect(abo.statut).toBe('resilie');
      expect(abo.isActive()).toBe(false);
    });

    it('suspendu → résilié', () => {
      const abo = creerAbonnement();
      abo.suspend();
      abo.resiliate(new Date('2026-06-01T00:00:00Z'));
      expect(abo.statut).toBe('resilie');
    });
  });

  describe('transitions invalides', () => {
    it('refuse de suspendre un abonnement déjà suspendu', () => {
      const abo = creerAbonnement();
      abo.suspend();
      expect(() => abo.suspend()).toThrow(InvalidAbonnementTransitionError);
    });

    it('refuse de réactiver un abonnement déjà actif', () => {
      const abo = creerAbonnement();
      expect(() => abo.reactivate()).toThrow(InvalidAbonnementTransitionError);
    });

    it('refuse de réactiver un abonnement résilié (état terminal)', () => {
      const abo = creerAbonnement();
      abo.resiliate(new Date());
      expect(() => abo.reactivate()).toThrow(InvalidAbonnementTransitionError);
    });

    it('refuse de résilier un abonnement déjà résilié', () => {
      const abo = creerAbonnement();
      abo.resiliate(new Date());
      expect(() => abo.resiliate(new Date())).toThrow(InvalidAbonnementTransitionError);
    });

    it('refuse de suspendre un abonnement résilié', () => {
      const abo = creerAbonnement();
      abo.resiliate(new Date());
      expect(() => abo.suspend()).toThrow(InvalidAbonnementTransitionError);
    });
  });

  describe('KER-ORG-03 — indépendance des abonnements', () => {
    it('deux abonnements distincts de la même organisation évoluent indépendamment', () => {
      const aboA = AbonnementProduit.create({
        id: 'abo-a',
        organisationId: 'org-1',
        produitId: 'produit-assoshop',
        dateDebut: new Date(),
      });
      const aboB = AbonnementProduit.create({
        id: 'abo-b',
        organisationId: 'org-1',
        produitId: 'produit-tradelink',
        dateDebut: new Date(),
      });

      aboA.suspend();

      expect(aboA.statut).toBe('suspendu');
      expect(aboB.statut).toBe('actif'); // aucun effet de bord d'un abonnement sur l'autre
    });
  });
});
