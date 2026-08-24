import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MaxLength,
} from 'class-validator';

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
export class CreateCatalogueDto {
  @IsUUID()
  produitId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nom!: string;

  @IsIn(['portefeuille_global', 'organisation', 'zone_geographique'])
  scopeType!: 'portefeuille_global' | 'organisation' | 'zone_geographique';

  @IsOptional()
  @IsUUID()
  scopeCibleId?: string;
}

export class UpdateCatalogueDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) nom?: string;
}

// ---------------------------------------------------------------------------
// Produit
// ---------------------------------------------------------------------------
export class CreateProduitDto {
  @IsUUID()
  catalogueId!: string;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{1,63}$/, {
    message: 'code doit contenir 2 à 64 caractères (minuscules, chiffres, ._- uniquement).',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateProduitDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) nom?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

// ---------------------------------------------------------------------------
// Offre
// ---------------------------------------------------------------------------
export class CreateOffreDto {
  @IsUUID()
  produitId!: string;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{1,63}$/, {
    message: 'code doit contenir 2 à 64 caractères (minuscules, chiffres, ._- uniquement).',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nom!: string;

  @IsIn(['abonnement', 'usage', 'ponctuel'])
  type!: 'abonnement' | 'usage' | 'ponctuel';

  @IsIn(['mensuelle', 'annuelle', 'unique'])
  periodeFacturation!: 'mensuelle' | 'annuelle' | 'unique';
}

export class UpdateOffreDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) nom?: string;
}

// ---------------------------------------------------------------------------
// Feature / Entitlement
// ---------------------------------------------------------------------------
export class CreateFeatureDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{1,63}$/, {
    message: 'code doit contenir 2 à 64 caractères (minuscules, chiffres, ._- uniquement).',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class AttachEntitlementDto {
  @IsUUID()
  featureId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  limite?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unite?: string;
}

// ---------------------------------------------------------------------------
// GrilleTarifaire
// ---------------------------------------------------------------------------
export class CreateGrilleTarifaireDto {
  @IsUUID()
  deviseId!: string;

  @IsInt()
  @Min(0)
  montantMinorUnit!: number;

  @IsIn(['mensuelle', 'annuelle', 'unique'])
  periodeFacturation!: 'mensuelle' | 'annuelle' | 'unique';

  @IsDateString()
  dateEffective!: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;
}

export class ResolveActivePriceQueryDto {
  @IsUUID() deviseId!: string;
  @IsOptional() @IsDateString() instant?: string;
}
