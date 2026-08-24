import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppConfiguration } from '../../config/configuration';

export interface AuthenticatedRequestUser {
  gsgId: string;
  roles: string[];
  /** Organisations pour lesquelles gsgId détient au moins un rôle scopé (KER-ORG-03). */
  gsgOrgIds: string[];
  mfaVerified: boolean;
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfiguration>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Jeton d\'accès manquant.');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('jwt.accessSecret', { infer: true }),
        issuer: this.configService.get('jwt.issuer', { infer: true }),
        audience: this.configService.get('jwt.audience', { infer: true }),
      });

      const user: AuthenticatedRequestUser = {
        gsgId: payload.sub,
        roles: payload.roles ?? [],
        gsgOrgIds: payload.gsgOrgIds ?? [],
        mfaVerified: payload.mfaVerified ?? false,
      };

      (request as Request & { user: AuthenticatedRequestUser }).user = user;
      return true;
    } catch {
      // OWASP: message d'erreur volontairement générique — ne jamais révéler la cause précise
      // (jeton expiré vs signature invalide vs malformé) pour ne pas faciliter le rejeu ciblé.
      throw new UnauthorizedException('Jeton d\'accès invalide ou expiré.');
    }
  }
}
