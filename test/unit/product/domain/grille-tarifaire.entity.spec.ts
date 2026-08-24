import {
  GrilleTarifaire,
  InvalidMontantError,
  InvalidValidityWindowError,
  InvalidVersionError,
  OverlappingPricingGridError,
  assertNoOverlapWithExisting,
  rangesOverlap,
} from '../../../../src/product/domain/entities/grille-tarifaire.entity';
import { CatalogWorkflowTransitionError } from '../../../../src/product/domain/entities/catalog-workflow';

function creerGrille(overrides: Partial<{
  id: string;
  version: number;
  deviseId: string;
  dateEffective: Date;
  dateFin: Date | null;
}> = {}): GrilleTarifaire {
  return GrilleTarifaire.create({
    id: overrides.id ?? 'grille-1',
    offreId: 'offre-1',
    version: overrides.version ?? 1,
    deviseId: overrides.deviseId ?? 'devise-xof',
    montantMinorUnit: 500000, // 5000.00 XOF en unité mineure (2 décimales) — juste un exemple
    periodeFacturation: 'mensuelle',
    dateEffective: overrides.dateEffective ?? new Date('2026-01-01T00:00:00Z'),
    dateFin: overrides.dateFin === undefined ? null : overrides.dateFin,
  });
}

describe('GrilleTarifaire (domaine Product Catalog) — validation à la création', () => {
  it('refuse un montant non entier', () => {
    expect(() =>
      GrilleTarifaire.create({
        id: 'g1',
        offreId: 'offre-1',
        version: 1,
        deviseId: 'devise-xof',
        montantMinorUnit: 10.5,
        periodeFacturation: 'mensuelle',
        dateEffective: new Date(),
      }),
    ).toThrow(InvalidMontantError);
  });

  it('refuse un montant négatif', () => {
    expect(() =>
      GrilleTarifaire.create({
        id: 'g1',
        offreId: 'offre-1',
        version: 1,
        deviseId: 'devise-xof',
        montantMinorUnit: -100,
        periodeFacturation: 'mensuelle',
        dateEffective: new Date(),
      }),
    ).toThrow(InvalidMontantError);
  });

  it('accepte un montant entier positif ou nul (gratuit)', () => {
    expect(() => creerGrille()).not.toThrow();
    expect(() =>
      GrilleTarifaire.create({
        id: 'g1',
        offreId: 'offre-1',
        version: 1,
        deviseId: 'devise-xof',
        montantMinorUnit: 0,
        periodeFacturation: 'mensuelle',
        dateEffective: new Date(),
      }),
    ).not.toThrow();
  });

  it('refuse une version non strictement positive', () => {
    expect(() => creerGrille({ version: 0 })).toThrow(InvalidVersionError);
  });

  it('refuse une dateFin antérieure ou égale à dateEffective', () => {
    const dateEffective = new Date('2026-01-01T00:00:00Z');
    expect(() => creerGrille({ dateEffective, dateFin: dateEffective })).toThrow(
      InvalidValidityWindowError,
    );
    expect(() =>
      creerGrille({ dateEffective, dateFin: new Date('2025-12-31T00:00:00Z') }),
    ).toThrow(InvalidValidityWindowError);
  });
});

describe('rangesOverlap (fonction pure) — KER-PRD chevauchement de fenêtres', () => {
  it('deux fenêtres disjointes ne se chevauchent pas', () => {
    expect(
      rangesOverlap(
        new Date('2026-01-01'),
        new Date('2026-02-01'),
        new Date('2026-03-01'),
        new Date('2026-04-01'),
      ),
    ).toBe(false);
  });

  it('deux fenêtres qui se recouvrent partiellement se chevauchent', () => {
    expect(
      rangesOverlap(
        new Date('2026-01-01'),
        new Date('2026-03-01'),
        new Date('2026-02-01'),
        new Date('2026-04-01'),
      ),
    ).toBe(true);
  });

  it('une succession propre (fin de A = début de B) ne se chevauche PAS (bornes fin exclusives)', () => {
    const jonction = new Date('2026-02-01');
    expect(rangesOverlap(new Date('2026-01-01'), jonction, jonction, new Date('2026-03-01'))).toBe(
      false,
    );
  });

  it('deux fenêtres sans fin déterminée (null) se chevauchent toujours si elles ont commencé', () => {
    expect(rangesOverlap(new Date('2026-01-01'), null, new Date('2026-02-01'), null)).toBe(true);
  });

  it('une fenêtre sans fin qui commence après la fin de l\'autre ne se chevauche pas', () => {
    expect(
      rangesOverlap(new Date('2026-01-01'), new Date('2026-02-01'), new Date('2026-03-01'), null),
    ).toBe(false);
  });

  it('une fenêtre incluse entièrement dans une autre se chevauche', () => {
    expect(
      rangesOverlap(
        new Date('2026-01-01'),
        new Date('2026-12-01'),
        new Date('2026-03-01'),
        new Date('2026-04-01'),
      ),
    ).toBe(true);
  });
});

describe('assertNoOverlapWithExisting — règle d\'incompatibilité de grilles tarifaires', () => {
  it('n\'échoue pas s\'il n\'existe aucune grille publiée concurrente', () => {
    const candidate = creerGrille({ id: 'candidate' });
    expect(() => assertNoOverlapWithExisting(candidate, [])).not.toThrow();
  });

  it('refuse un chevauchement avec une grille publiée existante dans la MÊME devise', () => {
    const existante = creerGrille({
      id: 'existante',
      deviseId: 'devise-xof',
      dateEffective: new Date('2026-01-01'),
      dateFin: new Date('2026-06-01'),
    });
    const candidate = creerGrille({
      id: 'candidate',
      deviseId: 'devise-xof',
      dateEffective: new Date('2026-03-01'),
      dateFin: new Date('2026-09-01'),
    });

    expect(() => assertNoOverlapWithExisting(candidate, [existante])).toThrow(
      OverlappingPricingGridError,
    );
  });

  it('ignore une grille existante dans une AUTRE devise, même sur la même période', () => {
    const existanteAutreDevise = creerGrille({
      id: 'existante',
      deviseId: 'devise-eur',
      dateEffective: new Date('2026-01-01'),
      dateFin: new Date('2026-06-01'),
    });
    const candidate = creerGrille({
      id: 'candidate',
      deviseId: 'devise-xof',
      dateEffective: new Date('2026-03-01'),
      dateFin: new Date('2026-09-01'),
    });

    expect(() => assertNoOverlapWithExisting(candidate, [existanteAutreDevise])).not.toThrow();
  });

  it('n\'entre jamais en conflit avec elle-même (republication de la même grille)', () => {
    const grille = creerGrille({ id: 'grille-republiee' });
    expect(() => assertNoOverlapWithExisting(grille, [grille])).not.toThrow();
  });

  it('accepte une succession propre de tarifs (fin de l\'un = début du suivant)', () => {
    const ancienneGrille = creerGrille({
      id: 'ancienne',
      dateEffective: new Date('2026-01-01'),
      dateFin: new Date('2026-06-01'),
    });
    const nouvelleGrille = creerGrille({
      id: 'nouvelle',
      dateEffective: new Date('2026-06-01'),
      dateFin: null,
    });

    expect(() => assertNoOverlapWithExisting(nouvelleGrille, [ancienneGrille])).not.toThrow();
  });
});

describe('GrilleTarifaire — cycle de vie (KER-PRD : Brouillon → Validé → Publié → Archivé)', () => {
  it('démarre toujours en statut "brouillon"', () => {
    expect(creerGrille().statutWorkflow).toBe('brouillon');
  });

  it('suit le parcours nominal complet jusqu\'à l\'archivage', () => {
    const grille = creerGrille();
    grille.validate();
    expect(grille.statutWorkflow).toBe('valide');
    grille.publish();
    expect(grille.statutWorkflow).toBe('publie');
    grille.archive();
    expect(grille.statutWorkflow).toBe('archive');
  });

  it('refuse d\'archiver directement un brouillon (saute publié)', () => {
    const grille = creerGrille();
    expect(() => grille.archive()).toThrow(CatalogWorkflowTransitionError);
  });

  it('refuse d\'archiver une grille encore en statut "valide" (pas publiée)', () => {
    const grille = creerGrille();
    grille.validate();
    expect(() => grille.archive()).toThrow(CatalogWorkflowTransitionError);
  });

  it('une grille archivée est un état terminal : aucune transition sortante', () => {
    const grille = creerGrille();
    grille.validate();
    grille.publish();
    grille.archive();

    expect(() => grille.validate()).toThrow(CatalogWorkflowTransitionError);
    expect(() => grille.publish()).toThrow(CatalogWorkflowTransitionError);
    expect(() => grille.rejectToDraft()).toThrow(CatalogWorkflowTransitionError);
  });

  it('permet un rejet vers brouillon depuis "valide" avant publication', () => {
    const grille = creerGrille();
    grille.validate();
    grille.rejectToDraft();
    expect(grille.statutWorkflow).toBe('brouillon');
  });
});

describe('GrilleTarifaire — isEffectiveAt (résolution temporelle)', () => {
  it('est effective à une date comprise dans sa fenêtre', () => {
    const grille = creerGrille({ dateEffective: new Date('2026-01-01'), dateFin: new Date('2026-06-01') });
    expect(grille.isEffectiveAt(new Date('2026-03-01'))).toBe(true);
  });

  it('est effective exactement à dateEffective (borne inclusive)', () => {
    const debut = new Date('2026-01-01');
    const grille = creerGrille({ dateEffective: debut, dateFin: new Date('2026-06-01') });
    expect(grille.isEffectiveAt(debut)).toBe(true);
  });

  it('n\'est plus effective exactement à dateFin (borne exclusive)', () => {
    const fin = new Date('2026-06-01');
    const grille = creerGrille({ dateEffective: new Date('2026-01-01'), dateFin: fin });
    expect(grille.isEffectiveAt(fin)).toBe(false);
  });

  it('reste effective indéfiniment si dateFin est null', () => {
    const grille = creerGrille({ dateEffective: new Date('2026-01-01'), dateFin: null });
    expect(grille.isEffectiveAt(new Date('2099-01-01'))).toBe(true);
  });
});
