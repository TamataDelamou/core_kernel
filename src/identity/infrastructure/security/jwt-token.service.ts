import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import {
  AccessTokenPayload,
  TokenService,
} from '../../domain/services/token-and-mfa.interface';
import { AppConfiguration } from '../../../config/configuration';

const MFA_CHALLENGE_TTL_SECONDS = 120;

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfiguration>,
  ) {}

  async issueAccessToken(
    payload: AccessTokenPayload,
  ): Promise<{ token: string; expiresInSeconds: number }> {
    const expiresInSeconds = this.configService.get('jwt.accessTtlSeconds', { infer: true }) as number;

    const token = await this.jwtService.signAsync(
      {
        sub: payload.gsgId,
        roles: payload.roles,
        gsgOrgIds: payload.gsgOrgIds,
        mfaVerified: payload.mfaVerified,
        typ: 'access',
      },
      {
        secret: this.configService.get('jwt.accessSecret', { infer: true }),
        expiresIn: expiresInSeconds,
        issuer: this.configService.get('jwt.issuer', { infer: true }),
        audience: this.configService.get('jwt.audience', { infer: true }),
      },
    );

    return { token, expiresInSeconds };
  }

  generateRefreshTokenPlain(): string {
    // 256 bits d'entropie, encodage URL-safe — jamais dérivé d'un identifiant prévisible.
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(plainToken: string): string {
    // Un refresh token est un secret à haute entropie (contrairement à un mot de passe) :
    // SHA-256 est suffisant ici et permet une recherche indexée en base (Argon2 ne le permet pas).
    return createHash('sha256').update(plainToken).digest('hex');
  }

  async issueMfaChallengeToken(gsgId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: gsgId, typ: 'mfa_challenge' },
      {
        secret: this.configService.get('jwt.accessSecret', { infer: true }),
        expiresIn: MFA_CHALLENGE_TTL_SECONDS,
        issuer: this.configService.get('jwt.issuer', { infer: true }),
        audience: this.configService.get('jwt.audience', { infer: true }),
      },
    );
  }

  async verifyMfaChallengeToken(token: string): Promise<{ gsgId: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('jwt.accessSecret', { infer: true }),
        issuer: this.configService.get('jwt.issuer', { infer: true }),
        audience: this.configService.get('jwt.audience', { infer: true }),
      });

      if (payload.typ !== 'mfa_challenge') {
        throw new UnauthorizedException('Jeton de challenge MFA invalide.');
      }

      return { gsgId: payload.sub };
    } catch {
      throw new UnauthorizedException('Jeton de challenge MFA invalide ou expiré.');
    }
  }
}
