import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'reporting_audit_event' })
@Unique('UQ_reporting_audit_source_event', ['sourceApplicationId', 'sourceInstanceId', 'environment', 'eventId'])
@Index('IDX_reporting_audit_source_time', ['sourceApplicationId', 'sourceInstanceId', 'environment', 'occurredAt'])
@Index('IDX_reporting_audit_retention', ['receivedAt'])
export class ReportingAuditEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId!: string;

  @Column({ name: 'schema_version', type: 'varchar', length: 8 })
  schemaVersion!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'source_application_id', type: 'varchar', length: 64 })
  sourceApplicationId!: string;

  @Column({ name: 'source_instance_id', type: 'varchar', length: 96 })
  sourceInstanceId!: string;

  @Column({ type: 'varchar', length: 16 })
  environment!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 150 })
  eventType!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'actor_ref', type: 'varchar', length: 138, nullable: true })
  actorRef!: string | null;

  @Column({ name: 'actor_role_class', type: 'varchar', length: 64, nullable: true })
  actorRoleClass!: string | null;

  @Column({ name: 'organization_ref', type: 'varchar', length: 138, nullable: true })
  organizationRef!: string | null;

  @Column({ name: 'resource_type', type: 'varchar', length: 64, nullable: true })
  resourceType!: string | null;

  @Column({ name: 'resource_ref', type: 'varchar', length: 138, nullable: true })
  resourceRef!: string | null;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ type: 'varchar', length: 16 })
  outcome!: string;

  @Column({ name: 'country_code', type: 'char', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ name: 'correlation_id', type: 'uuid', nullable: true })
  correlationId!: string | null;

  @Column({ name: 'payload_hash', type: 'char', length: 64 })
  payloadHash!: string;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date;
}

@Entity({ name: 'reporting_metric_snapshot' })
@Unique('UQ_reporting_metric_source_snapshot', ['sourceApplicationId', 'sourceInstanceId', 'environment', 'snapshotId'])
@Index('IDX_reporting_metric_source_window', ['sourceApplicationId', 'sourceInstanceId', 'environment', 'windowEnd'])
@Index('IDX_reporting_metric_retention', ['receivedAt'])
export class ReportingMetricSnapshotOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  @Column({ name: 'source_application_id', type: 'varchar', length: 64 })
  sourceApplicationId!: string;

  @Column({ name: 'source_instance_id', type: 'varchar', length: 96 })
  sourceInstanceId!: string;

  @Column({ type: 'varchar', length: 16 })
  environment!: string;

  @Column({ name: 'schema_version', type: 'varchar', length: 8 })
  schemaVersion!: string;

  @Column({ name: 'window_start', type: 'timestamptz' })
  windowStart!: Date;

  @Column({ name: 'window_end', type: 'timestamptz' })
  windowEnd!: Date;

  @Column({ name: 'payload_hash', type: 'char', length: 64 })
  payloadHash!: string;

  @Column({ name: 'metrics', type: 'jsonb' })
  metrics!: Record<string, unknown>[];

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date;
}
