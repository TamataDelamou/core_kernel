import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload, JWTVerifyGetKey, RemoteJWKSetOptions } from 'jose';
import { AppConfiguration } from '../../../config/configuration';

export const REPORTING_JWT_VERIFIER = Symbol('REPORTING_JWT_VERIFIER');
export const REPORTING_JWKS_FACTORY = Symbol('REPORTING_JWKS_FACTORY');
export type ReportingJwksFactory = (url: URL, options: RemoteJWKSetOptions) => JWTVerifyGetKey;

export interface ReportingWorkloadClaims extends JWTPayload {
  token_use: 'workload';
  applicationId: string;
  instanceId: string;
  environment: 'development' | 'test' | 'staging' | 'production';
  scope: string;
}

export type ReportingJwtVerifier = (token: string) => Promise<ReportingWorkloadClaims>;

/**
 * Verifies machine tokens independently of GSG ID user JWTs. The remote JWKS URL is fixed
 * by validated deployment configuration and restricted to an explicit HTTPS host allowlist.
 */
@Injectable()
export class ConfiguredReportingJwtVerifier {
  readonly verify: ReportingJwtVerifier;

  constructor(
    config: ConfigService<AppConfiguration>,
    @Optional() @Inject(REPORTING_JWKS_FACTORY) jwksFactory?: ReportingJwksFactory,
  ) {
    const reporting = config.get('reporting', { infer: true });
    if (!reporting) throw new Error('Reporting configuration is missing.');
    if (!reporting.ingestEnabled) {
      this.verify = async () => {
        throw new Error('Reporting ingestion is disabled.');
      };
      return;
    }

    const jwksUrl = new URL(reporting.jwtJwksUrl);
    if (
      jwksUrl.protocol !== 'https:' ||
      !reporting.jwksAllowedHosts.includes(jwksUrl.hostname.toLowerCase())
    ) {
      throw new Error('Reporting JWKS URL is outside the configured HTTPS host allowlist.');
    }

    const jwksOptions: RemoteJWKSetOptions = {
      timeoutDuration: 4_000,
      cooldownDuration: 10_000,
      cacheMaxAge: 300_000,
    };
    const remoteJwks = jwksFactory
      ? jwksFactory(jwksUrl, jwksOptions)
      : createRemoteJWKSet(jwksUrl, jwksOptions);
    const allowedAlgorithms = reporting.jwtAlgorithms;
    const issuer = reporting.jwtIssuer;
    const audience = reporting.jwtAudience;

    this.verify = async (token: string): Promise<ReportingWorkloadClaims> => {
      const { payload } = await jwtVerify(token, remoteJwks, {
        issuer,
        audience,
        algorithms: allowedAlgorithms,
        maxTokenAge: '5m',
        clockTolerance: 5,
        requiredClaims: ['sub', 'iss', 'aud', 'exp', 'iat'],
      });

      if (
        payload.token_use !== 'workload' ||
        typeof payload.sub !== 'string' ||
        typeof payload.applicationId !== 'string' ||
        typeof payload.instanceId !== 'string' ||
        typeof payload.environment !== 'string' ||
        typeof payload.scope !== 'string'
      ) {
        throw new Error('Workload token claims are incomplete.');
      }

      if (payload.sub !== payload.instanceId) {
        throw new Error('Workload token subject must identify its instance.');
      }

      return payload as ReportingWorkloadClaims;
    };
  }
}
