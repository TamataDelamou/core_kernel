import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReferentielOrganisationDto {
  @IsOptional() @IsUUID() paysId?: string;
  @IsOptional() @IsUUID() uniteAdministrativeId?: string;
  @IsOptional() @IsUUID() villeId?: string;
  @IsOptional() @IsUUID() deviseId?: string;
  @IsOptional() @IsUUID() langueId?: string;
  @IsOptional() @IsString() @MaxLength(64) fuseauHoraire?: string;
}

export class CreateOrganisationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nom!: string;

  @IsOptional()
  @IsUUID()
  organisationMereId?: string;

  @ValidateNested()
  @Type(() => ReferentielOrganisationDto)
  referentiel!: ReferentielOrganisationDto;
}

export class UpdateOrganisationDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) nom?: string;
}

export class ReattachOrganisationDto {
  @IsOptional()
  @IsUUID()
  organisationMereId?: string | null;
}

export class CreateUniteOperationnelleDto {
  @IsUUID()
  organisationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nom!: string;

  @ValidateNested()
  @Type(() => ReferentielOrganisationDto)
  referentiel!: ReferentielOrganisationDto;
}

export class SubscribeToProduitDto {
  @IsUUID()
  produitId!: string;

  @IsDateString()
  dateDebut!: string;
}

export class ResiliateAbonnementDto {
  @IsDateString()
  dateFin!: string;
}
