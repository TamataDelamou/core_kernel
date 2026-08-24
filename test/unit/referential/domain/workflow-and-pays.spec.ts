import { assertTransitionAllowed, WorkflowTransitionError } from '../../../../src/referential/domain/entities/workflow';
import { Pays, InvalidCodeIsoPaysError } from '../../../../src/referential/domain/entities/pays.entity';

function creerPays(): Pays {
  return Pays.create({ id: 'pays-1', codeIso: 'gn', nom: 'Guinée' });
}

describe('Workflow de publication (KER-AUD-04) — assertTransitionAllowed', () => {
  it.each([
    ['brouillon', 'en_revision'],
    ['en_revision', 'valide'],
    ['en_revision', 'brouillon'],
    ['valide', 'publie'],
    ['valide', 'en_revision'],
  ] as const)('autorise %s → %s', (from, to) => {
    expect(() => assertTransitionAllowed(from, to)).not.toThrow();
  });

  it.each([
    ['brouillon', 'valide'],
    ['brouillon', 'publie'],
    ['en_revision', 'publie'],
    ['publie', 'brouillon'],
    ['publie', 'en_revision'],
    ['publie', 'valide'],
  ] as const)('refuse %s → %s', (from, to) => {
    expect(() => assertTransitionAllowed(from, to)).toThrow(WorkflowTransitionError);
  });

  it('"publie" est un état terminal : aucune transition sortante autorisée', () => {
    expect(() => assertTransitionAllowed('publie', 'brouillon')).toThrow();
    expect(() => assertTransitionAllowed('publie', 'en_revision')).toThrow();
    expect(() => assertTransitionAllowed('publie', 'valide')).toThrow();
  });
});

describe('Pays (domaine GSG Referential) — KER-REF-01', () => {
  describe('validation du code ISO 3166-1 alpha-2', () => {
    it('normalise le code ISO en majuscules', () => {
      const pays = creerPays();
      expect(pays.codeIso).toBe('GN');
    });

    it('refuse un code ISO de longueur incorrecte', () => {
      expect(() => Pays.create({ id: 'x', codeIso: 'GIN', nom: 'Guinée' })).toThrow(
        InvalidCodeIsoPaysError,
      );
    });

    it('refuse un code ISO contenant des chiffres', () => {
      expect(() => Pays.create({ id: 'x', codeIso: 'G1', nom: 'Guinée' })).toThrow(
        InvalidCodeIsoPaysError,
      );
    });
  });

  describe('cycle de vie du workflow', () => {
    it('démarre toujours en statut "brouillon"', () => {
      expect(creerPays().statutWorkflow).toBe('brouillon');
    });

    it('suit le parcours nominal brouillon → en_revision → valide → publie', () => {
      const pays = creerPays();
      pays.submitForReview();
      expect(pays.statutWorkflow).toBe('en_revision');
      pays.validate();
      expect(pays.statutWorkflow).toBe('valide');
      pays.publish();
      expect(pays.statutWorkflow).toBe('publie');
    });

    it('refuse de publier directement un brouillon (saute le workflow)', () => {
      const pays = creerPays();
      expect(() => pays.publish()).toThrow(WorkflowTransitionError);
    });

    it('permet un retour en brouillon depuis en_revision (rejet)', () => {
      const pays = creerPays();
      pays.submitForReview();
      pays.rejectToDraft();
      expect(pays.statutWorkflow).toBe('brouillon');
    });

    it('un pays publié reste immuable en termes de workflow (état terminal)', () => {
      const pays = creerPays();
      pays.submitForReview();
      pays.validate();
      pays.publish();
      expect(() => pays.submitForReview()).toThrow(WorkflowTransitionError);
    });
  });

  describe('KER-ADM-04 — désactivation sans suppression', () => {
    it('déserve et réactive sans jamais affecter le statut de workflow', () => {
      const pays = creerPays();
      pays.submitForReview();
      pays.validate();
      pays.publish();

      pays.deactivate();
      expect(pays.estActif).toBe(false);
      expect(pays.statutWorkflow).toBe('publie');

      pays.reactivate();
      expect(pays.estActif).toBe(true);
    });
  });
});
