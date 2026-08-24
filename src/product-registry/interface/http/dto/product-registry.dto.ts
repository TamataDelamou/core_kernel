import { ArrayUnique, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BRIQUES_NOYAU_VALIDES } from '../../../domain/entities/produit-portefeuille.entity';

export class CreateProduitPortefeuilleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nom!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(BRIQUES_NOYAU_VALIDES, { each: true })
  briquesConsommees?: string[];
}

export class UpdateProduitPortefeuilleDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) nom?: string;
}

export class DeclareBriquesDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(BRIQUES_NOYAU_VALIDES, { each: true })
  briquesConsommees!: string[];
}

export class SetDeploiementStatutDto {
  @IsUUID() paysId!: string;

  @IsIn(['lance', 'en_test', 'planifie', 'non_prioritaire'])
  statut!: 'lance' | 'en_test' | 'planifie' | 'non_prioritaire';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  phase!: string;
}
