import { ExecutionContext, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AppConfiguration } from '../../../src/config/configuration';
import { ReportingWorkloadGuard, REPORTING_REQUIRED_SCOPE } from '../../../src/reporting/interface/http/guards/reporting-workload.guard';
import { ReportingJwtVerifier, ReportingWorkloadClaims } from '../../../src/reporting/infrastructure/security/reporting-jwt-verifier';

const claims: ReportingWorkloadClaims = {
  iss: 'https://issuer.example.test',
  aud: 'gsg-control-plane',
  sub: 'tradelink-prod-eu1',
  exp: Math.floor(Date.now() / 1000) + 300,
  iat: Math.floor(Date.now() / 1000),
  token_use: 'workload',
  applicationId: 'tradelink',
  instanceId: 'tradelink-prod-eu1',
  environment: 'test',
  scope: 'reporting.audit.write reporting.metrics.write',
};

function context(request: { headers: Record<string, string>; reportingPrincipal?: unknown }): ExecutionContext {
  const handler = function handler() {};
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

function buildGuard(enabled: boolean, verify: ReportingJwtVerifier, requiredScope = 'reporting.audit.write') {
  const config = {
    get: jest.fn(() => ({
      ingestEnabled: enabled,
      allowedWorkloads: ['tradelink:tradelink-prod-eu1:test'],
    })),
  } as unknown as ConfigService<AppConfiguration>;
  const reflector = { getAllAndOverride: jest.fn(() => requiredScope) } as unknown as Reflector;
  return new ReportingWorkloadGuard(config, reflector, verify);
}

describe('ReportingWorkloadGuard', () => {
  it('rend 404 et n’appelle pas le vérificateur lorsque l’ingestion est désactivée', async () => {
    const verify = jest.fn();
    const guard = buildGuard(false, verify);
    const req = { headers: { authorization: 'Bearer token' } };
    await expect(guard.canActivate(context(req))).rejects.toBeInstanceOf(NotFoundException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('refuse les requêtes sans Bearer token ou avec une preuve cryptographique invalide', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('signature-details-ne-doivent-pas-sortir'));
    const guard = buildGuard(true, verify);
    await expect(guard.canActivate(context({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(context({ headers: { authorization: 'Bearer malformed' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('n’accorde pas un scope absent et attache uniquement les claims minimaux au principal', async () => {
    const verify = jest.fn().mockResolvedValue({ ...claims, scope: 'reporting.metrics.write' });
    const guard = buildGuard(true, verify);
    await expect(
      guard.canActivate(context({ headers: { authorization: 'Bearer signed' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const valid = jest.fn().mockResolvedValue(claims);
    const validGuard = buildGuard(true, valid, 'reporting.audit.write');
    const req: { headers: Record<string, string>; reportingPrincipal?: unknown } = {
      headers: { authorization: 'Bearer signed' },
    };
    await expect(validGuard.canActivate(context(req))).resolves.toBe(true);
    expect(req.reportingPrincipal).toEqual({
      applicationId: 'tradelink',
      instanceId: 'tradelink-prod-eu1',
      environment: 'test',
      scopes: ['reporting.audit.write', 'reporting.metrics.write'],
    });
    expect(REPORTING_REQUIRED_SCOPE).toBe('control-plane:reporting-required-scope');
  });

  it('refuse une identité signée mais absente de l’allowlist de déploiement', async () => {
    const verify = jest.fn().mockResolvedValue({ ...claims, instanceId: 'rogue-instance', sub: 'rogue-instance' });
    const guard = buildGuard(true, verify);
    await expect(
      guard.canActivate(context({ headers: { authorization: 'Bearer signed' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
