import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterUserDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'Le téléphone doit être au format E.164, ex. +224620000000.' })
  phone?: string;

  @IsString()
  @MinLength(12, { message: 'Le mot de passe doit contenir au moins 12 caractères.' })
  @MaxLength(128)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nomAffichage!: string;

  @IsOptional() @IsUUID() paysId?: string;
  @IsOptional() @IsUUID() uniteAdministrativeId?: string;
  @IsOptional() @IsUUID() villeId?: string;
  @IsOptional() @IsUUID() langueId?: string;
  @IsOptional() @IsUUID() deviseId?: string;
  @IsOptional() @IsString() @MaxLength(64) fuseauHoraire?: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @IsUUID()
  refreshTokenId!: string;

  @IsString()
  @IsNotEmpty()
  refreshTokenPlain!: string;
}

/**
 * KER-ID-02 : échange une session Supabase déjà authentifiée nativement par un produit
 * (signInWithOtp/verifyOtp) contre une session GSG ID. `supabaseProjectUrl` doit correspondre
 * à un projet de la liste blanche SUPABASE_ALLOWED_PROJECT_URLS.
 */
export class ExchangeSupabaseSessionDto {
  @IsUrl(
    { protocols: ['https'], require_protocol: true, require_tld: false },
    { message: 'supabaseProjectUrl doit être une URL https valide.' },
  )
  supabaseProjectUrl!: string;

  @IsString()
  @IsNotEmpty()
  supabaseAccessToken!: string;

  @IsUUID()
  produitId!: string;
}

export class VerifyMfaChallengeDto {
  @IsString()
  @IsNotEmpty()
  mfaChallengeToken!: string;

  @IsString()
  @Matches(/^[0-9A-Za-z-]{6,12}$/, { message: 'Code MFA ou code de récupération invalide.' })
  code!: string;
}

export class ConfirmMfaEnrollmentDto {
  @IsUUID()
  factorId!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code TOTP doit contenir 6 chiffres.' })
  code!: string;
}

export class LinkExternalIdentityDto {
  @IsUUID()
  produitId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  externalUserId!: string;
}

export class UpdateReferentielDto {
  @IsOptional() @IsUUID() paysId?: string;
  @IsOptional() @IsUUID() uniteAdministrativeId?: string;
  @IsOptional() @IsUUID() villeId?: string;
  @IsOptional() @IsUUID() langueId?: string;
  @IsOptional() @IsUUID() deviseId?: string;
  @IsOptional() @IsString() @MaxLength(64) fuseauHoraire?: string;
}

export class AssignRoleDto {
  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsUUID()
  gsgOrgId?: string;
}

export class RegisterUserResponseDto {
  @IsUUID()
  gsgId!: string;
}
