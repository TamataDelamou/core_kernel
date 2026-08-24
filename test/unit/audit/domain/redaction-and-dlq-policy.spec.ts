import { redactSensitiveFields } from '../../../../src/audit/domain/services/redaction';
import { shouldMoveToDeadLetter } from '../../../../src/audit/domain/entities/evenement-en-echec.entity';

describe('redactSensitiveFields (domaine Audit) — KER-AUD-03, défense en profondeur', () => {
  it('rédige un champ sensible au premier niveau', () => {
    const resultat = redactSensitiveFields({ email: 'user@example.com', password: 'secret123' });
    expect(resultat.email).toBe('user@example.com');
    expect(resultat.password).toBe('[REDACTED]');
  });

  it('rédige un champ sensible imbriqué à n\'importe quelle profondeur', () => {
    const resultat = redactSensitiveFields({
      utilisateur: { profil: { token: 'abc123', nom: 'Test' } },
    });
    const utilisateur = resultat.utilisateur as Record<string, unknown>;
    const profil = utilisateur.profil as Record<string, unknown>;
    expect(profil.token).toBe('[REDACTED]');
    expect(profil.nom).toBe('Test');
  });

  it('rédige les champs sensibles à l\'intérieur d\'un tableau', () => {
    const resultat = redactSensitiveFields({
      tentatives: [{ code: '123456' }, { code: '654321' }],
    });
    const tentatives = resultat.tentatives as Array<Record<string, unknown>>;
    expect(tentatives[0].code).toBe('[REDACTED]');
    expect(tentatives[1].code).toBe('[REDACTED]');
  });

  it('reconnaît les variantes de casse et de séparateur (snake_case, camelCase)', () => {
    const resultat = redactSensitiveFields({
      password_hash: 'x',
      passwordHash: 'y',
      REFRESH_TOKEN: 'z',
    });
    expect(resultat.password_hash).toBe('[REDACTED]');
    expect(resultat.passwordHash).toBe('[REDACTED]');
    expect(resultat.REFRESH_TOKEN).toBe('[REDACTED]');
  });

  it('laisse intactes les valeurs non sensibles, y compris imbriquées', () => {
    const original = { gsgId: 'user-1', referentiel: { paysId: 'pays-gn', langueId: 'langue-fr' } };
    const resultat = redactSensitiveFields(original);
    expect(resultat).toEqual(original);
  });

  it('ne boucle jamais indéfiniment sur une structure très profondément imbriquée', () => {
    let profond: Record<string, unknown> = { valeur: 'fin' };
    for (let i = 0; i < 20; i++) {
      profond = { niveau: profond };
    }
    expect(() => redactSensitiveFields(profond)).not.toThrow();
  });
});

describe('shouldMoveToDeadLetter (domaine Audit) — seuil de bascule DLQ', () => {
  it('ne bascule pas tant que le nombre de livraisons est inférieur ou égal au maximum', () => {
    expect(shouldMoveToDeadLetter(1, 5)).toBe(false);
    expect(shouldMoveToDeadLetter(5, 5)).toBe(false);
  });

  it('bascule dès que le nombre de livraisons dépasse strictement le maximum', () => {
    expect(shouldMoveToDeadLetter(6, 5)).toBe(true);
  });
});
