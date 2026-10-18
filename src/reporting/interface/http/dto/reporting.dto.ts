import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const REF_PATTERN = /^hmac:v[1-9][0-9]*:[A-Za-z0-9_-]{16,128}$/;

export class ReportingSourceDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,63}$/)
  applicationId!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,95}$/)
  instanceId!: string;

  @IsIn(['development', 'test', 'staging', 'production'])
  environment!: string;
}

export class ReportingAuditEventDto {
  @IsUUID()
  eventId!: string;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,5}$/)
  eventType!: string;

  @IsOptional()
  @IsString()
  @Matches(REF_PATTERN)
  actorRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/)
  actorRoleClass?: string;

  @IsOptional()
  @IsString()
  @Matches(REF_PATTERN)
  organizationRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/)
  resourceType?: string;

  @IsOptional()
  @IsString()
  @Matches(REF_PATTERN)
  resourceRef?: string;

  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/)
  action!: string;

  @IsIn(['success', 'failure', 'rejected'])
  outcome!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @IsOptional()
  @IsUUID()
  correlationId?: string;
}

export class IngestAuditEventsBatchDto {
  @IsIn(['1'])
  schemaVersion!: string;

  @IsUUID()
  batchId!: string;

  @ValidateNested()
  @Type(() => ReportingSourceDto)
  source!: ReportingSourceDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReportingAuditEventDto)
  @ArrayUnique((event: ReportingAuditEventDto) => event.eventId)
  events!: ReportingAuditEventDto[];
}

export class ReportingMetricDimensionsDto {
  @IsOptional()
  @IsIn(['trpc', 'oauth_callback', 'kyc_upload', 'kyc_worker', 'other'])
  routeGroup?: string;

  @IsOptional()
  @IsIn(['2xx', '3xx', '4xx', '5xx'])
  statusClass?: string;

  @IsOptional()
  @IsIn(['api', 'database', 'redis', 'outbox', 'exporter'])
  component?: string;
}

export class ReportingMetricPointDto {
  @IsString()
  @IsIn([
    'http.server.requests',
    'http.server.errors',
    'http.server.request.duration',
    'reporting.outbox.pending',
    'reporting.outbox.oldest_age',
    'reporting.export.failures',
  ])
  name!: string;

  @IsIn(['counter', 'gauge', 'histogram_summary'])
  kind!: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(1_000_000_000_000)
  value!: number;

  @IsIn(['requests', 'ms_p50', 'ms_p95', 'ms_p99', 'events', 'seconds', 'attempts'])
  unit!: string;

  @ValidateNested()
  @Type(() => ReportingMetricDimensionsDto)
  dimensions!: ReportingMetricDimensionsDto;
}

export class IngestMetricSnapshotBatchDto {
  @IsIn(['1'])
  schemaVersion!: string;

  @IsUUID()
  snapshotId!: string;

  @ValidateNested()
  @Type(() => ReportingSourceDto)
  source!: ReportingSourceDto;

  @IsDateString()
  windowStart!: string;

  @IsDateString()
  windowEnd!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReportingMetricPointDto)
  metrics!: ReportingMetricPointDto[];
}
