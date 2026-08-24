import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GetAppConfigDto {
  @IsUUID()
  gsgOrgId!: string;

  @IsOptional()
  @IsUUID()
  uniteOperationnelleId?: string;
}

export class UpdateConfigurationGlobaleDto {
  @IsOptional() @IsUUID() deviseId?: string;
  @IsOptional() @IsUUID() langueId?: string;
  @IsOptional() @IsString() @MaxLength(100) fuseauHoraire?: string;
  @IsOptional() @IsString() @MaxLength(50) formatDate?: string;
  @IsOptional() @IsString() @MaxLength(50) formatNombre?: string;
}
