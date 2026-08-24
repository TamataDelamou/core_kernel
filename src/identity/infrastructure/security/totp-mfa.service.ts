import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { GeneratedTotpSecret, MfaService } from '../../domain/services/token-and-mfa.interface';
import { AppConfiguration } from '../../../config/configuration';

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

@Injectable()
export class TotpMfaService implements MfaService {
  constructor(private readonly configService: ConfigService<AppConfiguration>) {
    const window = this.configService.get('mfa.totpWindow', { infer: true }) as number;
    authenticator.options = { window };
  }

  async generateTotpSecret(accountLabel: string): Promise<GeneratedTotpSecret> {
    const issuer = this.configService.get('mfa.issuerName', { infer: true }) as string;
    const secretBase32 = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(accountLabel, issuer, secretBase32);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secretBase32, otpauthUrl, qrCodeDataUrl };
  }

  verifyTotpCode(secretBase32: string, code: string): boolean {
    try {
      return authenticator.verify({ token: code, secret: secretBase32 });
    } catch {
      return false;
    }
  }

  encryptSecret(secretBase32: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(AES_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format persisté : iv:authTag:ciphertext (chacun en hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptSecret(encryptedSecret: string): string {
    const key = this.getEncryptionKey();
    const [ivHex, authTagHex, cipherTextHex] = encryptedSecret.split(':');
    if (!ivHex || !authTagHex || !cipherTextHex) {
      throw new Error('Format de secret MFA chiffré invalide.');
    }

    const decipher = createDecipheriv(AES_ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherTextHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  generateRecoveryCodes(count: number): string[] {
    return Array.from({ length: count }, () =>
      randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'),
    );
  }

  hashRecoveryCode(code: string): string {
    // Les codes de récupération sont à usage unique et à forte entropie : SHA-256 suffit
    // (contrairement au mot de passe, aucun besoin de ralentissement délibéré type Argon2).
    return createHash('sha256').update(code.toUpperCase()).digest('hex');
  }

  private getEncryptionKey(): Buffer {
    const hex = this.configService.get('mfa.encryptionKeyHex', { infer: true }) as string;
    const key = Buffer.from(hex, 'hex');
    if (key.length !== 32) {
      throw new Error('MFA_ENCRYPTION_KEY_HEX doit représenter exactement 32 octets (256 bits).');
    }
    return key;
  }
}
