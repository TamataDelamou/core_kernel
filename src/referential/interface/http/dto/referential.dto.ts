import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// ---------------------------------------------------------------------------
// Pays (KER-REF-01, KER-REF-09)
// ---------------------------------------------------------------------------
export class CreatePaysDto {
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'codeIso doit être au format ISO 3166-1 alpha-2, ex. GN.' })
  codeIso!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nom!: string;

  @IsOptional() @IsString() @MaxLength(255) organismeRegionalPrincipal?: string;
  @IsOptional() @IsString() notesSouverainete?: string;
  @IsOptional() @IsString() adresseGabarit?: string;
  @IsOptional() @IsString() @MaxLength(64) fuseauHoraire?: string;
}

export class UpdatePaysDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) nom?: string;
  @IsOptional() @IsString() @MaxLength(255) organismeRegionalPrincipal?: string;
  @IsOptional() @IsString() notesSouverainete?: string;
  @IsOptional() @IsString() adresseGabarit?: string;
  @IsOptional() @IsString() @MaxLength(64) fuseauHoraire?: string;
}

// ---------------------------------------------------------------------------
// Devise (KER-REF-02, KER-REF-03, KER-REF-08)
// ---------------------------------------------------------------------------
export class CreateDeviseDto {
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'codeIso4217 doit être au format ISO 4217, ex. XOF.' })
  codeIso4217!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nom!: string;

  @IsOptional() @IsString() @MaxLength(100) zoneMonetaire?: string;

  @IsInt()
  @Min(0)
  @Max(4)
  decimales!: number;
}

export class AttachDeviseToPaysDto {
  @IsUUID() paysId!: string;
  @IsUUID() deviseId!: string;
  @IsDateString() dateDebut!: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsBoolean() devisePrincipale!: boolean;
}

// ---------------------------------------------------------------------------
// Langue (KER-REF-06)
// ---------------------------------------------------------------------------
export class CreateLangueDto {
  @IsString()
  @Matches(/^[A-Za-z]{2,3}$/, { message: 'codeIso639 doit être au format ISO 639, ex. fr.' })
  codeIso639!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nom!: string;
}

export class AttachLangueToPaysDto {
  @IsUUID() paysId!: string;
  @IsUUID() langueId!: string;

  @IsIn(['officielle', 'nationale', 'enseignement_initial', 'vehiculaire'])
  statut!: 'officielle' | 'nationale' | 'enseignement_initial' | 'vehiculaire';

  @IsInt()
  @Min(0)
  ordre!: number;
}

// ---------------------------------------------------------------------------
// BlocRegional (KER-REF-07)
// ---------------------------------------------------------------------------
export class CreateBlocRegionalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nom!: string;

  @IsIn(['economique', 'juridique', 'monetaire', 'examinateur'])
  type!: 'economique' | 'juridique' | 'monetaire' | 'examinateur';
}

export class AddPaysToBlocRegionalDto {
  @IsUUID() paysId!: string;
  @IsUUID() blocRegionalId!: string;
  @IsDateString() dateAdhesion!: string;
}

export class WithdrawPaysFromBlocRegionalDto {
  @IsDateString() dateRetrait!: string;
}

// ---------------------------------------------------------------------------
// TauxChange (KER-REF-04)
// ---------------------------------------------------------------------------
export class SetTauxChangeDto {
  @IsUUID() deviseBaseId!: string;
  @IsUUID() deviseCibleId!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'taux doit être un nombre décimal positif en chaîne, ex. "655.957".' })
  taux!: string;

  @IsDateString() validDu!: string;
  @IsOptional() @IsDateString() validAu?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  source!: string;
}

export class ResolveExchangeRateQueryDto {
  @IsUUID() deviseBaseId!: string;
  @IsUUID() deviseCibleId!: string;
  @IsOptional() @IsDateString() instant?: string;
}

// ---------------------------------------------------------------------------
// Ville (KER-ADM-03)
// ---------------------------------------------------------------------------
export class CreateVilleDto {
  @IsUUID() paysId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nom!: string;

  @IsOptional() @IsUUID() referentielHierarchiqueId?: string;
}

export class MoveVilleDto {
  @IsOptional()
  @IsUUID()
  nouveauReferentielHierarchiqueId?: string | null;
}

// ---------------------------------------------------------------------------
// Locale et Traduction (KER-NOM-04)
// ---------------------------------------------------------------------------
export class CreateLocaleDto {
  @Matches(/^[a-z]{2,3}(-([A-Z]{2}|\d{3}))?$/, {
    message: 'Le code doit respecter le format BCP 47 (ex. "fr-GN", "en-US").',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  libelle!: string;
}

export class UpdateLocaleDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) libelle?: string;
}

export class CreateTraductionDto {
  @IsUUID() localeId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  cle!: string;

  @IsString()
  @IsNotEmpty()
  valeur!: string;
}

export class UpdateTraductionDto {
  @IsString()
  @IsNotEmpty()
  valeur!: string;
}
