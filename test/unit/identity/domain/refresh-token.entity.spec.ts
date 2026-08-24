import {
  RefreshToken,
  RefreshTokenAlreadyUsedError,
  RefreshTokenExpiredError,
  RefreshTokenRevokedError,
} from '../../../../src/identity/domain/entities/rbac-and-tokens.entity';

function issueToken(overrides: Partial<{ expireLe: Date }> = {}): RefreshToken {
  const now = new Date('2026-01-01T00:00:00Z');
  return RefreshToken.issue({
    id: 'token-1',
    gsgId: 'user-1',
    tokenHash: 'sha256-hash-placeholder',
    familyId: 'family-1',
    emisLe: now,
    expireLe: overrides.expireLe ?? new Date('2026-02-01T00:00:00Z'),
    ipEmission: '127.0.0.1',
    userAgent: 'jest-test-runner',
  });
}

describe('RefreshToken (domaine GSG ID) — rotation et détection de rejeu', () => {
  it('valide et consomme un jeton non expiré, non révoqué, jamais utilisé', () => {
    const token = issueToken();
    const maintenant = new Date('2026-01-15T00:00:00Z');

    expect(() => token.assertValidAndConsume(maintenant)).not.toThrow();
    expect(token.toSnapshot().consommeLe).toEqual(maintenant);
  });

  it('refuse la consommation d\'un jeton déjà consommé (rejeu — OWASP ASVS 3.3.1)', () => {
    const token = issueToken();
    const t1 = new Date('2026-01-10T00:00:00Z');
    const t2 = new Date('2026-01-11T00:00:00Z');

    token.assertValidAndConsume(t1);
    expect(() => token.assertValidAndConsume(t2)).toThrow(RefreshTokenAlreadyUsedError);
  });

  it('refuse un jeton expiré', () => {
    const token = issueToken({ expireLe: new Date('2026-01-05T00:00:00Z') });
    const apresExpiration = new Date('2026-01-06T00:00:00Z');

    expect(() => token.assertValidAndConsume(apresExpiration)).toThrow(RefreshTokenExpiredError);
  });

  it('refuse un jeton révoqué, même non expiré et jamais consommé', () => {
    const token = issueToken();
    token.revoke(new Date('2026-01-02T00:00:00Z'));

    expect(() => token.assertValidAndConsume(new Date('2026-01-03T00:00:00Z'))).toThrow(
      RefreshTokenRevokedError,
    );
  });

  it('priorise la révocation sur l\'expiration (un jeton révoqué reste révoqué même expiré)', () => {
    const token = issueToken({ expireLe: new Date('2026-01-02T00:00:00Z') });
    token.revoke(new Date('2026-01-01T12:00:00Z'));

    // Même après la date d'expiration, l'erreur remontée doit rester "révoqué" et non
    // "expiré" — l'ordre de vérification dans l'entité doit refléter la sévérité métier.
    expect(() => token.assertValidAndConsume(new Date('2026-01-05T00:00:00Z'))).toThrow(
      RefreshTokenRevokedError,
    );
  });

  it('conserve le même familyId après émission (nécessaire à la révocation en cascade)', () => {
    const token = issueToken();
    expect(token.familyId).toBe('family-1');
  });
});
