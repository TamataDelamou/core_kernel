import { TauxChange, InvalidTauxError } from '../../../../src/referential/domain/entities/relations.entity';

function creerTaux(overrides: Partial<{ validDu: Date; validAu: Date | null; taux: string }> = {}): TauxChange {
  return TauxChange.create({
    id: 'taux-1',
    deviseBaseId: 'devise-xof',
    deviseCibleId: 'devise-eur',
    taux: overrides.taux ?? '655.9570000000',
    validDu: overrides.validDu ?? new Date('2026-01-01T00:00:00Z'),
    validAu: overrides.validAu === undefined ? null : overrides.validAu,
    source: 'BCEAO',
  });
}

describe('TauxChange (domaine GSG Referential) — KER-REF-04', () => {
  describe('validation à la création', () => {
    it('refuse un taux non numérique', () => {
      expect(() => creerTaux({ taux: 'abc' })).toThrow(InvalidTauxError);
    });

    it('refuse un taux négatif', () => {
      expect(() => creerTaux({ taux: '-1' })).toThrow(InvalidTauxError);
    });

    it('refuse un taux nul', () => {
      expect(() => creerTaux({ taux: '0' })).toThrow(InvalidTauxError);
    });

    it('accepte un taux décimal positif en chaîne', () => {
      expect(() => creerTaux({ taux: '655.957' })).not.toThrow();
    });

    it('refuse une date de fin antérieure ou égale à la date de début', () => {
      const validDu = new Date('2026-01-01T00:00:00Z');
      expect(() => creerTaux({ validDu, validAu: validDu })).toThrow();
      expect(() =>
        creerTaux({ validDu, validAu: new Date('2025-12-31T00:00:00Z') }),
      ).toThrow();
    });
  });

  describe('isValidAt — résolution temporelle', () => {
    it('est valide à un instant compris entre validDu et validAu', () => {
      const taux = creerTaux({
        validDu: new Date('2026-01-01T00:00:00Z'),
        validAu: new Date('2026-06-01T00:00:00Z'),
      });
      expect(taux.isValidAt(new Date('2026-03-01T00:00:00Z'))).toBe(true);
    });

    it('est valide exactement à validDu (borne inclusive)', () => {
      const validDu = new Date('2026-01-01T00:00:00Z');
      const taux = creerTaux({ validDu, validAu: new Date('2026-06-01T00:00:00Z') });
      expect(taux.isValidAt(validDu)).toBe(true);
    });

    it('est valide exactement à validAu (borne inclusive)', () => {
      const validAu = new Date('2026-06-01T00:00:00Z');
      const taux = creerTaux({ validDu: new Date('2026-01-01T00:00:00Z'), validAu });
      expect(taux.isValidAt(validAu)).toBe(true);
    });

    it('n\'est jamais valide avant validDu', () => {
      const taux = creerTaux({ validDu: new Date('2026-01-01T00:00:00Z') });
      expect(taux.isValidAt(new Date('2025-12-31T23:59:59Z'))).toBe(false);
    });

    it('n\'est plus valide après validAu s\'il est défini', () => {
      const taux = creerTaux({
        validDu: new Date('2026-01-01T00:00:00Z'),
        validAu: new Date('2026-06-01T00:00:00Z'),
      });
      expect(taux.isValidAt(new Date('2026-06-02T00:00:00Z'))).toBe(false);
    });

    it('reste valide indéfiniment si validAu est null ("en vigueur jusqu\'à nouvel ordre")', () => {
      const taux = creerTaux({ validDu: new Date('2026-01-01T00:00:00Z'), validAu: null });
      expect(taux.isValidAt(new Date('2099-01-01T00:00:00Z'))).toBe(true);
    });
  });

  describe('KER-REF-04 — jamais de parité 1:1 implicite', () => {
    it('la classe TauxChange elle-même ne fournit aucune valeur par défaut : ' +
      'c\'est ResolveExchangeRateUseCase qui porte le refus explicite si aucun candidat ne matche isValidAt',
      () => {
        const taux = creerTaux({
          validDu: new Date('2026-01-01T00:00:00Z'),
          validAu: new Date('2026-02-01T00:00:00Z'),
        });
        // En dehors de la fenêtre de validité, isValidAt renvoie false — aucune méthode
        // de l'entité ne "invente" un taux de repli. Le refus est de la responsabilité
        // de l'appelant (testé en intégration sur ResolveExchangeRateUseCase).
        expect(taux.isValidAt(new Date('2027-01-01T00:00:00Z'))).toBe(false);
      });
  });
});
