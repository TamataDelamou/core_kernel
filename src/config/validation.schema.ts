import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  Matches,
  IsUrl,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'staging', 'production'])
  NODE_ENV!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsInt()
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_DATABASE!: string;

  @IsOptional()
  @IsBooleanString()
  DB_SSL?: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @IsInt()
  REDIS_PORT!: number;

  // OWASP ASVS 2.10 — secrets de signature JWT robustes, jamais de valeur par défaut acceptée.
  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères (256 bits recommandés).',
  })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_REFRESH_SECRET doit contenir au moins 32 caractères (256 bits recommandés).',
  })
  JWT_REFRESH_SECRET!: string;

  // Clé AES-256-GCM (64 caractères hexadécimaux = 32 octets) chiffrant les secrets TOTP au repos.
  @IsString()
  @MinLength(64, { message: 'MFA_ENCRYPTION_KEY_HEX doit contenir 64 caractères hexadécimaux (256 bits).' })
  MFA_ENCRYPTION_KEY_HEX!: string;

  // KER-ID-02 : au moins un projet Supabase de confiance doit être déclaré pour que l'échange
  // de session (SupabaseSessionExchangeUseCase) soit utilisable — sinon aucun produit ne
  // pourrait jamais faire reconnaître ses utilisateurs par GSG ID.
  @IsString()
  @IsNotEmpty({
    message:
      'SUPABASE_ALLOWED_PROJECT_URLS est requis (liste blanche séparée par des virgules, anti-SSRF).',
  })
  SUPABASE_ALLOWED_PROJECT_URLS!: string;

  @IsOptional()
  @IsBooleanString()
  REPORTING_INGEST_ENABLED?: string;

  @ValidateIf((value: EnvironmentVariables) => value.REPORTING_INGEST_ENABLED === 'true')
  @IsString()
  @IsNotEmpty()
  REPORTING_JWT_ISSUER?: string;

  @ValidateIf((value: EnvironmentVariables) => value.REPORTING_INGEST_ENABLED === 'true')
  @IsUrl({ protocols: ['https'], require_protocol: true })
  REPORTING_JWT_JWKS_URL?: string;

  @ValidateIf((value: EnvironmentVariables) => value.REPORTING_INGEST_ENABLED === 'true')
  @IsString()
  @IsNotEmpty()
  REPORTING_JWT_AUDIENCE?: string;

  @ValidateIf((value: EnvironmentVariables) => value.REPORTING_INGEST_ENABLED === 'true')
  @IsString()
  @IsNotEmpty()
  REPORTING_JWKS_ALLOWED_HOSTS?: string;

  @ValidateIf((value: EnvironmentVariables) => value.REPORTING_INGEST_ENABLED === 'true')
  @Matches(/^[a-z][a-z0-9-]{1,63}:[a-z][a-z0-9-]{1,95}:(development|test|staging|production)(,[a-z][a-z0-9-]{1,63}:[a-z][a-z0-9-]{1,95}:(development|test|staging|production))*$/)
  REPORTING_ALLOWED_WORKLOADS?: string;

  @ValidateIf((value: EnvironmentVariables) => value.REPORTING_INGEST_ENABLED === 'true')
  @Matches(/^[a-z][a-z0-9]*(\.[a-z0-9_-]+){1,7}(,[a-z][a-z0-9]*(\.[a-z0-9_-]+){1,7})*$/)
  REPORTING_ALLOWED_AUDIT_EVENT_TYPES?: string;

  @IsOptional()
  @Matches(/^(RS256|ES256)(,(RS256|ES256))*$/)
  REPORTING_JWT_ALGORITHMS?: string;

  @ValidateIf((value: EnvironmentVariables) => value.REPORTING_INGEST_ENABLED === 'true')
  @IsInt()
  @Min(1)
  REPORTING_AUDIT_RETENTION_DAYS?: number;

  @ValidateIf((value: EnvironmentVariables) => value.REPORTING_INGEST_ENABLED === 'true')
  @IsInt()
  @Min(1)
  REPORTING_METRICS_RETENTION_DAYS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  REPORTING_MAX_AUDIT_BATCH_ITEMS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  REPORTING_MAX_METRIC_BATCH_ITEMS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  REPORTING_MAX_METRICS_PER_SNAPSHOT?: number;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join(' | ');
    throw new Error(
      `Configuration invalide au démarrage de GSG ID — arrêt volontaire (fail-fast) : ${details}`,
    );
  }

  if (validatedConfig.NODE_ENV === 'production') {
    if (validatedConfig.JWT_ACCESS_SECRET === validatedConfig.JWT_REFRESH_SECRET) {
      throw new Error(
        'JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être distincts en production.',
      );
    }
  }

  if (validatedConfig.REPORTING_INGEST_ENABLED === 'true') {
    let jwksUrl: URL;
    try {
      jwksUrl = new URL(validatedConfig.REPORTING_JWT_JWKS_URL ?? '');
    } catch {
      throw new Error('REPORTING_JWT_JWKS_URL doit être une URL HTTPS valide.');
    }
    const allowedHosts = (validatedConfig.REPORTING_JWKS_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    if (jwksUrl.protocol !== 'https:' || !allowedHosts.includes(jwksUrl.hostname.toLowerCase())) {
      throw new Error(
        'REPORTING_JWT_JWKS_URL doit utiliser HTTPS et son hôte doit figurer dans REPORTING_JWKS_ALLOWED_HOSTS.',
      );
    }
  }

  return validatedConfig;
}
