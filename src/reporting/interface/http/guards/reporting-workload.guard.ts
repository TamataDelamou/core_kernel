import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppConfiguration } from '../../../../config/configuration';
import {
  REPORTING_JWT_VERIFIER,
  ReportingJwtVerifier,
  ReportingWorkloadClaims,
} from '../../../infrastructure/security/reporting-jwt-verifier';

export const REPORTING_REQUIRED_SCOPE = 'control-plane:reporting-required-scope';

export const RequireReportingScope = (scope: 'reporting.audit.write' | 'reporting.metrics.write') =>
  SetMetadata(REPORTING_REQUIRED_SCOPE, scope);

export interface ReportingPrincipal {
  applicationId: string;
  instanceId: string;
  environment: ReportingWorkloadClaims['environment'];
  scopes: string[];
}

export type ReportingRequest = Request & { reportingPrincipal?: ReportingPrincipal };

@Injectable()
export class ReportingWorkloadGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<AppConfiguration>,
    private readonly reflector: Reflector,
    @Inject(REPORTING_JWT_VERIFIER) private readonly verifyToken: ReportingJwtVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reporting = this.config.get('reporting', { infer: true });
    if (!reporting || !reporting.ingestEnabled) {
      throw new NotFoundException('Endpoint indisponible.');
    }

    const request = context.switchToHttp().getRequest<ReportingRequest>();
    const authorization = request.headers.authorization;
    if (!authorization || !/^Bearer [^\s]+$/.test(authorization)) {
      throw new UnauthorizedException('Authentification interservice invalide.');
    }

    let claims: ReportingWorkloadClaims;
    try {
      claims = await this.verifyToken(authorization.slice('Bearer '.length));
    } catch {
      // Do not log or return token contents, issuer errors, or JWKS response details.
      throw new UnauthorizedException('Authentification interservice invalide.');
    }

    const workloadKey = `${claims.applicationId}:${claims.instanceId}:${claims.environment}`;
    if (!reporting.allowedWorkloads.includes(workloadKey)) {
      throw new ForbiddenException('Identité de service non autorisée pour cette plateforme.');
    }

    const requiredScope = this.reflector.getAllAndOverride<string>(REPORTING_REQUIRED_SCOPE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const scopes = claims.scope.split(/\s+/).filter(Boolean);
    if (requiredScope && !scopes.includes(requiredScope)) {
      throw new ForbiddenException('Autorisation interservice insuffisante.');
    }

    request.reportingPrincipal = {
      applicationId: claims.applicationId,
      instanceId: claims.instanceId,
      environment: claims.environment,
      scopes,
    };
    return true;
  }
}
