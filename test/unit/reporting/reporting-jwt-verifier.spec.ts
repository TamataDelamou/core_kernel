import { ConfigService } from '@nestjs/config';
import { createLocalJWKSet, exportJWK, generateKeyPair, JWK, KeyLike, SignJWT } from 'jose';
import { AppConfiguration } from '../../../src/config/configuration';
import {
  ConfiguredReportingJwtVerifier,
  ReportingJwksFactory,
} from '../../../src/reporting/infrastructure/security/reporting-jwt-verifier';

const issuer = 'https://issuer.example.test';
const audience = 'gsg-control-plane';
const now = Math.floor(Date.now() / 1000);

async function verifierFor(algorithm: 'RS256' | 'PS256' = 'RS256') {
  const pair = await generateKeyPair(algorithm);
  const publicJwk = await exportJWK(pair.publicKey);
  publicJwk.kid = 'reporting-test-key';
  publicJwk.alg = algorithm;
  publicJwk.use = 'sig';
  const local = createLocalJWKSet({ keys: [publicJwk as JWK] });
  const factory: ReportingJwksFactory = () => local;
  const config = {
    get: jest.fn(() => ({
      ingestEnabled: true,
      jwtJwksUrl: 'https://trusted.example.test/jwks.json',
      jwksAllowedHosts: ['trusted.example.test'],
      jwtAlgorithms: ['RS256', 'ES256'],
      jwtIssuer: issuer,
      jwtAudience: audience,
    })),
  } as unknown as ConfigService<AppConfiguration>;
  const verifier = new ConfiguredReportingJwtVerifier(config, factory);
  return { verifier, privateKey: pair.privateKey, algorithm };
}

async function token(
  privateKey: KeyLike,
  algorithm: string,
  claims: Record<string, unknown> = {},
): Promise<string> {
  return new SignJWT({
    token_use: 'workload',
    applicationId: 'tradelink',
    instanceId: 'tradelink-prod-eu1',
    environment: 'production',
    scope: 'reporting.audit.write',
    ...claims,
  })
    .setProtectedHeader({ alg: algorithm, kid: 'reporting-test-key', typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject('tradelink-prod-eu1')
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

describe('ConfiguredReportingJwtVerifier', () => {
  it('ne construit pas de JWKS et échoue fermé lorsque le reporting est désactivé', async () => {
    const config = {
      get: jest.fn(() => ({
        ingestEnabled: false,
        jwtJwksUrl: '',
        jwksAllowedHosts: [],
        jwtAlgorithms: [],
        jwtIssuer: '',
        jwtAudience: '',
      })),
    } as unknown as ConfigService<AppConfiguration>;
    const verifier = new ConfiguredReportingJwtVerifier(config);
    await expect(verifier.verify('not-a-token')).rejects.toThrow('Reporting ingestion is disabled.');
  });

  it('vérifie une signature RS256 et les claims de workload', async () => {
    const { verifier, privateKey } = await verifierFor('RS256');
    const signed = await token(privateKey, 'RS256');
    await expect(verifier.verify(signed)).resolves.toMatchObject({
      token_use: 'workload',
      applicationId: 'tradelink',
      instanceId: 'tradelink-prod-eu1',
      environment: 'production',
      scope: 'reporting.audit.write',
    });
  });

  it('rejette une mauvaise audience, un mauvais issuer et une identité subject incohérente', async () => {
    const { verifier, privateKey } = await verifierFor('RS256');
    const wrongAudience = await new SignJWT({
      token_use: 'workload', applicationId: 'tradelink', instanceId: 'tradelink-prod-eu1', environment: 'production', scope: 'reporting.audit.write',
    }).setProtectedHeader({ alg: 'RS256', kid: 'reporting-test-key' }).setIssuer(issuer).setAudience('another-service').setSubject('tradelink-prod-eu1').setIssuedAt(now).setExpirationTime(now + 300).sign(privateKey);
    await expect(verifier.verify(wrongAudience)).rejects.toThrow();

    const wrongIssuer = await new SignJWT({
      token_use: 'workload', applicationId: 'tradelink', instanceId: 'tradelink-prod-eu1', environment: 'production', scope: 'reporting.audit.write',
    }).setProtectedHeader({ alg: 'RS256', kid: 'reporting-test-key' }).setIssuer('https://untrusted.example.test').setAudience(audience).setSubject('tradelink-prod-eu1').setIssuedAt(now).setExpirationTime(now + 300).sign(privateKey);
    await expect(verifier.verify(wrongIssuer)).rejects.toThrow();

    const inconsistentSubject = await token(privateKey, 'RS256', { instanceId: 'another-instance' });
    await expect(verifier.verify(inconsistentSubject)).rejects.toThrow(/subject must identify its instance/);
  });

  it('refuse les algorithmes hors liste autorisée, même avec une clé et signature valides', async () => {
    const { verifier, privateKey } = await verifierFor('PS256');
    const signed = await token(privateKey, 'PS256');
    await expect(verifier.verify(signed)).rejects.toThrow();
  });

  it('refuse un claim token_use absent ou incorrect', async () => {
    const { verifier, privateKey } = await verifierFor('RS256');
    const signed = await token(privateKey, 'RS256', { token_use: 'access' });
    await expect(verifier.verify(signed)).rejects.toThrow(/claims are incomplete/);
  });
});
