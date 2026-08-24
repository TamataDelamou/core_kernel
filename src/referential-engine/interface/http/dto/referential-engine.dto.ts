import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateNiveauAdministratifDto {
  @IsUUID() paysId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  rang!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom!: string;
}

export class CreateNoeudDto {
  @IsOptional() @IsUUID() paysId?: string;
  @IsOptional() @IsIn(['administratif']) codeDomaine?: string;
  @IsOptional() @IsUUID() parentId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  appellationLocale!: string;

  @IsOptional() @IsInt() @Min(0) ordre?: number;
  @IsOptional() @IsBoolean() estNoeudTerminal?: boolean;
}

export class UpdateNoeudDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) appellationLocale?: string;
  @IsOptional() @IsInt() @Min(0) ordre?: number;
}

export class ReattachNoeudDto {
  @IsOptional()
  @IsUUID()
  nouveauParentId?: string | null;
}

export class GouvernanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organismeCertificateur!: string;

  @IsIn(['ELEVE', 'MOYEN', 'A_VERIFIER'])
  statutConfiance!: 'ELEVE' | 'MOYEN' | 'A_VERIFIER';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  source!: string;
}

export class CreateReferentielRegleDto extends GouvernanceDto {
  @IsUUID() referentielHierarchiqueId!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) nom!: string;
  @IsOptional() @IsString() @MaxLength(50) sigle?: string;
  @IsString() @IsNotEmpty() @MaxLength(500) valeur!: string;
}

export class UpdateReferentielRegleDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) nom?: string;
  @IsOptional() @IsString() @MaxLength(50) sigle?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) valeur?: string;
}

export class CreateCorpusVersionneDto extends GouvernanceDto {
  @IsUUID() paysId!: string;
  @IsOptional() @IsIn(['administratif']) codeDomaine?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) libelleVersion!: string;
}

export class UpdateCorpusVersionneDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) libelleVersion?: string;
}

export class AttachCorpusElementDto {
  @IsUUID() corpusVersionneId!: string;
  @IsUUID() referentielHierarchiqueId!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) nom!: string;
  @IsOptional() @IsString() @MaxLength(200) valeurOuCoefficient?: string;
  @IsOptional() @IsInt() @Min(0) ordre?: number;
}

export class UpdateCorpusElementDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) nom?: string;
  @IsOptional() @IsString() @MaxLength(200) valeurOuCoefficient?: string;
  @IsOptional() @IsInt() @Min(0) ordre?: number;
}

export class ReattachCorpusElementDto {
  @IsOptional()
  @IsUUID()
  nouveauParentId?: string | null;
}
