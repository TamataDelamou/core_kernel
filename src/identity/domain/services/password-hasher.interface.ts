export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/**
 * Port du domaine pour le hachage de mot de passe. L'implémentation concrète
 * (Argon2id — recommandation OWASP Password Storage Cheat Sheet) vit en infrastructure.
 */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, hash: string): Promise<boolean>;
}
