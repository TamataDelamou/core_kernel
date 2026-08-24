export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface AccessTokenPayload {
  gsgId: string;
  roles: string[];
  /**
   * Organisations pour lesquelles gsgId détient au moins un rôle scopé (KER-ORG-03).
   * Permet à un consommateur du jeton (ex. GET /v1/audit/trail) de fermer un contrôle de
   * portée multi-tenant sans round-trip supplémentaire vers GSG ID à chaque requête.
   */
  gsgOrgIds: string[];
  mfaVerified: boolean;
}

export interface IssuedTokenPair {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenPlain: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

/** Port du domaine pour l'émission et la vérification des jetons JWT (GSG ID — OIDC/OAuth2). */
export interface TokenService {
  issueAccessToken(payload: AccessTokenPayload): Promise<{ token: string; expiresInSeconds: number }>;
  generateRefreshTokenPlain(): string;
  hashRefreshToken(plainToken: string): string;
  /** Jeton court (2 min) attestant qu'un mot de passe a été validé, en attente du second facteur. */
  issueMfaChallengeToken(gsgId: string): Promise<string>;
  verifyMfaChallengeToken(token: string): Promise<{ gsgId: string }>;
}

export const MFA_SERVICE = Symbol('MFA_SERVICE');

export interface GeneratedTotpSecret {
  secretBase32: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/** Port du domaine pour la génération/vérification TOTP et le chiffrement du secret au repos. */
export interface MfaService {
  generateTotpSecret(accountLabel: string): Promise<GeneratedTotpSecret>;
  verifyTotpCode(secretBase32: string, code: string): boolean;
  encryptSecret(secretBase32: string): string;
  decryptSecret(encryptedSecret: string): string;
  generateRecoveryCodes(count: number): string[];
  hashRecoveryCode(code: string): string;
}
