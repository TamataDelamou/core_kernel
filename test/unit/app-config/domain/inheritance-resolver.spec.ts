import { resolveChamp, resolveTousLesChamps } from '../../../../src/app-config/domain/entities/inheritance-resolver';

describe('resolveChamp (domaine app-config) — KER-INH-01/02, chaîne d\'héritage pure', () => {
  it('renvoie la valeur du niveau le plus spécifique quand plusieurs niveaux la définissent', () => {
    const niveaux = [{ deviseId: 'devise-utilisateur' }, { deviseId: 'devise-agence' }, { deviseId: 'devise-pays' }];
    expect(resolveChamp(niveaux, 'deviseId')).toBe('devise-utilisateur');
  });

  it('KER-INH-02 : un champ non défini (undefined) à un niveau ne bloque jamais la remontée', () => {
    const niveaux = [{}, { deviseId: 'devise-agence' }];
    expect(resolveChamp(niveaux, 'deviseId')).toBe('devise-agence');
  });

  it('KER-INH-02 : un champ explicitement null à un niveau ne bloque jamais la remontée non plus', () => {
    const niveaux = [{ deviseId: null }, { deviseId: 'devise-agence' }];
    expect(resolveChamp(niveaux, 'deviseId')).toBe('devise-agence');
  });

  it('remonte jusqu\'au dernier niveau (Global) si aucun niveau intermédiaire ne définit le champ', () => {
    const niveaux = [{}, {}, {}, { deviseId: 'devise-globale' }];
    expect(resolveChamp(niveaux, 'deviseId')).toBe('devise-globale');
  });

  it('renvoie null si AUCUN niveau, y compris le dernier, ne définit le champ', () => {
    const niveaux = [{}, {}, {}, {}];
    expect(resolveChamp(niveaux, 'deviseId')).toBeNull();
  });

  it('renvoie null sur une liste de niveaux vide', () => {
    expect(resolveChamp([], 'deviseId')).toBeNull();
  });

  it('résout chaque champ indépendamment des autres (un champ peut venir de l\'utilisateur, un autre du pays)', () => {
    const niveaux = [
      { deviseId: 'devise-utilisateur' },
      {},
      { langueId: 'langue-organisation' },
      { fuseauHoraire: 'Africa/Conakry' },
    ];

    expect(resolveChamp(niveaux, 'deviseId')).toBe('devise-utilisateur');
    expect(resolveChamp(niveaux, 'langueId')).toBe('langue-organisation');
    expect(resolveChamp(niveaux, 'fuseauHoraire')).toBe('Africa/Conakry');
    expect(resolveChamp(niveaux, 'formatDate')).toBeNull();
  });

  it('un niveau intermédiaire "vide" (agence sans référentiel propre) est transparent, pas bloquant', () => {
    const niveaux = [{}, {}, { deviseId: 'devise-organisation' }];
    expect(resolveChamp(niveaux, 'deviseId')).toBe('devise-organisation');
  });
});

describe('resolveTousLesChamps — résolution simultanée des 6 champs héritables', () => {
  it('résout les 6 champs en une seule passe, chacun depuis son propre niveau gagnant', () => {
    const niveaux = [
      { deviseId: 'devise-utilisateur' },
      { langueId: 'langue-agence' },
      { fuseauHoraire: 'Africa/Dakar' },
      { formatDate: 'YYYY-MM-DD', formatNombre: '#.##0,00', adresseGabarit: 'gabarit-pays' },
    ];

    expect(resolveTousLesChamps(niveaux)).toEqual({
      deviseId: 'devise-utilisateur',
      langueId: 'langue-agence',
      fuseauHoraire: 'Africa/Dakar',
      formatDate: 'YYYY-MM-DD',
      formatNombre: '#.##0,00',
      adresseGabarit: 'gabarit-pays',
    });
  });

  it('renvoie null pour chaque champ jamais défini à aucun niveau', () => {
    expect(resolveTousLesChamps([{}, {}])).toEqual({
      deviseId: null,
      langueId: null,
      fuseauHoraire: null,
      formatDate: null,
      formatNombre: null,
      adresseGabarit: null,
    });
  });
});
