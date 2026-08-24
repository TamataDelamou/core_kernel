import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHasher } from '../../domain/services/password-hasher.interface';

/**
 * OWASP Password Storage Cheat Sheet — Argon2id, m=19 MiB, t=2, p=1 (profil recommandé
 * pour un service à fort débit d'authentification ; ajuster selon le budget CPU/mémoire
 * observé en charge réelle, jamais réduire en dessous des seuils OWASP minimaux).
 */
@Injectable()
export class Argon2PasswordHasherService implements PasswordHasher {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, this.options);
  }

  async verify(plainPassword: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainPassword);
    } catch {
      // Un hash malformé ou incompatible ne doit jamais lever d'exception non contrôlée
      // jusqu'au use-case — il est traité comme un échec de vérification.
      return false;
    }
  }
}
