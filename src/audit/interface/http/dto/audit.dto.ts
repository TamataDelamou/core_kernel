import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditTrailDto {
  @IsOptional() @IsUUID() gsgOrgId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsDateString() depuis?: string;
  @IsOptional() @IsDateString() jusqua?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tailleParPage?: number;
}

export class ListDeadLetterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tailleParPage?: number;
}
