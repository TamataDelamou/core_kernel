import 'reflect-metadata';
import { validateEnvironment } from '../../../src/config/validation.schema';

function validEnvironment(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_USERNAME: 'test',
    DB_PASSWORD: 'test-password',
    DB_DATABASE: 'test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
    MFA_ENCRYPTION_KEY_HEX: 'a'.repeat(64),
    SUPABASE_ALLOWED_PROJECT_URLS: 'https://test-project.supabase.co',
    ...overrides,
  };
}

const enabledReporting = {
  REPORTING_INGEST_ENABLED: 'true',
  REPORTING_JWT_ISSUER: 'https://workload.example.test',
  REPORTING_JWT_JWKS_URL: 'https://trusted.example.test/jwks.json',
  REPORTING_JWT_AUDIENCE: 'gsg-control-plane',
  REPORTING_JWKS_ALLOWED_HOSTS: 'trusted.example.test',
  REPORTING_ALLOWED_WORKLOADS: 'tradelink:tradelink-prod-eu1:production',
  REPORTING_ALLOWED_AUDIT_EVENT_TYPES: 'trade.catalogue.viewed,trade.quote.created',
  REPORTING_AUDIT_RETENTION_DAYS: 90,
  REPORTING_METRICS_RETENTION_DAYS: 14,
};

describe('Reporting configuration fail-closed', () => {
  it('valide le service sans reporting parce que les nouveaux endpoints sont désactivés par défaut', () => {
    const config = validateEnvironment(validEnvironment());
    expect(config.REPORTING_INGEST_ENABLED).toBeUndefined();
  });

  it('accepte l’activation uniquement avec trust, workloads et politiques de rétention explicites', () => {
    expect(() => validateEnvironment(validEnvironment(enabledReporting))).not.toThrow();
  });

  it('refuse l’activation si issuer, JWKS, audience, allowlist workload ou rétention manquent', () => {
    expect(() =>
      validateEnvironment(validEnvironment({ REPORTING_INGEST_ENABLED: 'true' })),
    ).toThrow(/Configuration invalide au démarrage/);
    expect(() =>
      validateEnvironment(validEnvironment({ ...enabledReporting, REPORTING_ALLOWED_WORKLOADS: '' })),
    ).toThrow(/Configuration invalide au démarrage/);
    expect(() =>
      validateEnvironment(validEnvironment({ ...enabledReporting, REPORTING_ALLOWED_AUDIT_EVENT_TYPES: '' })),
    ).toThrow(/Configuration invalide au démarrage/);
  });

  it('refuse un JWKS HTTP ou un hôte qui ne figure pas dans l’allowlist', () => {
    expect(() =>
      validateEnvironment(
        validEnvironment({ ...enabledReporting, REPORTING_JWT_JWKS_URL: 'http://attacker.example.test/jwks.json' }),
      ),
    ).toThrow(/Configuration invalide au démarrage/);

    expect(() =>
      validateEnvironment(
        validEnvironment({ ...enabledReporting, REPORTING_JWT_JWKS_URL: 'https://attacker.example.test/jwks.json' }),
      ),
    ).toThrow(/hôte doit figurer dans REPORTING_JWKS_ALLOWED_HOSTS/);
  });

  it('n’autorise que RS256/ES256 et borne les batches', () => {
    expect(() =>
      validateEnvironment(validEnvironment({ ...enabledReporting, REPORTING_JWT_ALGORITHMS: 'HS256' })),
    ).toThrow(/Configuration invalide au démarrage/);
    expect(() =>
      validateEnvironment(validEnvironment({ ...enabledReporting, REPORTING_MAX_AUDIT_BATCH_ITEMS: 501 })),
    ).toThrow(/Configuration invalide au démarrage/);
  });
});
