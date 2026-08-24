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

  return validatedConfig;
}
