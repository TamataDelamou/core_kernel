import {
  InvalidLocaleCodeError,
  Locale,
} from '../../../../src/referential/domain/entities/locale-et-traduction.entity';

describe('Locale (domaine) — KER-NOM-04, validation BCP 47 stricte', () => {
  it.each(['fr', 'fr-GN', 'en-US', 'spa-419', 'pt-BR'])('accepte le code BCP 47 valide "%s"', (code) => {
    expect(() => Locale.create({ id: 'locale-1', code, libelle: 'Test' })).not.toThrow();
  });

  it.each([
    'FR-gn',
    'fr_GN',
    'french',
    'fr-Gn',
    '',
    'fr-GNN',
  ])('refuse le code "%s" hors du sous-ensemble BCP 47 accepté', (code) => {
    expect(() => Locale.create({ id: 'locale-1', code, libelle: 'Test' })).toThrow(InvalidLocaleCodeError);
  });

  it('démarre toujours sans statut par défaut et active', () => {
    const locale = Locale.create({ id: 'locale-1', code: 'fr-GN', libelle: 'Français (Guinée)' });
    expect(locale.estParDefaut).toBe(false);
    expect(locale.estActif).toBe(true);
  });

  it('marquerCommeDefaut / retirerStatutDefaut basculent le statut', () => {
    const locale = Locale.create({ id: 'locale-1', code: 'fr-GN', libelle: 'X' });
    locale.marquerCommeDefaut();
    expect(locale.estParDefaut).toBe(true);
    locale.retirerStatutDefaut();
    expect(locale.estParDefaut).toBe(false);
  });
});
