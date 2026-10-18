import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { TransactionContextService } from '../../../../common/kernel-infrastructure/persistence/transaction-context.service';
import { ReportingIdempotencyConflictError } from '../../../domain/reporting-ingest.errors';
import {
  ReportingMetricPoint,
  ReportingSource,
  ReportingAuditEvent,
} from '../../../domain/reporting-ingest.models';
import {
  ReportingIngestRepository,
  SnapshotIngestResult,
} from '../../../domain/reporting-ingest.repository';
import {
  ReportingAuditEventOrmEntity,
  ReportingMetricSnapshotOrmEntity,
} from './orm-entities';

@Injectable()
export class TypeOrmReportingIngestRepository implements ReportingIngestRepository {
  constructor(
    @InjectRepository(ReportingAuditEventOrmEntity) private readonly auditDefault: Repository<ReportingAuditEventOrmEntity>,
    @InjectRepository(ReportingMetricSnapshotOrmEntity) private readonly metricDefault: Repository<ReportingMetricSnapshotOrmEntity>,
    private readonly transactionContext: TransactionContextService,
  ) {}

  private get auditRepo(): Repository<ReportingAuditEventOrmEntity> {
    const manager = this.transactionContext.getManager();
    return manager ? manager.getRepository(ReportingAuditEventOrmEntity) : this.auditDefault;
  }

  private get metricRepo(): Repository<ReportingMetricSnapshotOrmEntity> {
    const manager = this.transactionContext.getManager();
    return manager ? manager.getRepository(ReportingMetricSnapshotOrmEntity) : this.metricDefault;
  }

  async saveAuditBatch(params: {
    batchId: string;
    schemaVersion: string;
    source: ReportingSource;
    events: Array<ReportingAuditEvent & { payloadHash: string }>;
  }): Promise<{ accepted: number; duplicates: number }> {
    const rows = params.events.map((event) => ({
      batchId: params.batchId,
      eventId: event.eventId,
      schemaVersion: params.schemaVersion,
      sourceApplicationId: params.source.applicationId,
      sourceInstanceId: params.source.instanceId,
      environment: params.source.environment,
      eventType: event.eventType,
      occurredAt: new Date(event.occurredAt),
      actorRef: event.actorRef ?? null,
      actorRoleClass: event.actorRoleClass ?? null,
      organizationRef: event.organizationRef ?? null,
      resourceType: event.resourceType ?? null,
      resourceRef: event.resourceRef ?? null,
      action: event.action,
      outcome: event.outcome,
      countryCode: event.countryCode ?? null,
      correlationId: event.correlationId ?? null,
      payloadHash: event.payloadHash,
    }));

    const insertResult = await this.auditRepo
      .createQueryBuilder()
      .insert()
      .into(ReportingAuditEventOrmEntity)
      .values(rows as never[])
      .orIgnore()
      .returning(['event_id'])
      .execute();
    const acceptedIds = new Set<string>(
      Array.isArray(insertResult.raw)
        ? insertResult.raw
            .map((row: Record<string, unknown>) => row.event_id)
            .filter((eventId: unknown): eventId is string => typeof eventId === 'string')
        : [],
    );

    const stored = await this.auditRepo.find({
      where: {
        sourceApplicationId: params.source.applicationId,
        sourceInstanceId: params.source.instanceId,
        environment: params.source.environment,
        eventId: In(params.events.map((event) => event.eventId)),
      },
    });
    const hashes = new Map(params.events.map((event) => [event.eventId, event.payloadHash]));
    for (const row of stored) {
      if (hashes.get(row.eventId) !== row.payloadHash) {
        throw new ReportingIdempotencyConflictError();
      }
    }
    if (stored.length !== params.events.length) {
      throw new Error('Une ou plusieurs lignes n’ont pas été reçues durablement.');
    }

    return {
      accepted: acceptedIds.size,
      duplicates: params.events.length - acceptedIds.size,
    };
  }

  async saveMetricSnapshot(params: {
    source: ReportingSource;
    snapshotId: string;
    schemaVersion: string;
    windowStart: Date;
    windowEnd: Date;
    payloadHash: string;
    metrics: ReportingMetricPoint[];
  }): Promise<SnapshotIngestResult> {
    const insertResult = await this.metricRepo
      .createQueryBuilder()
      .insert()
      .into(ReportingMetricSnapshotOrmEntity)
      .values({
        snapshotId: params.snapshotId,
        sourceApplicationId: params.source.applicationId,
        sourceInstanceId: params.source.instanceId,
        environment: params.source.environment,
        schemaVersion: params.schemaVersion,
        windowStart: params.windowStart,
        windowEnd: params.windowEnd,
        payloadHash: params.payloadHash,
        metrics: params.metrics as never,
      })
      .orIgnore()
      .returning(['snapshot_id'])
      .execute();
    const accepted = Array.isArray(insertResult.raw) && insertResult.raw.length > 0;

    const stored = await this.metricRepo.findOne({
      where: {
        sourceApplicationId: params.source.applicationId,
        sourceInstanceId: params.source.instanceId,
        environment: params.source.environment,
        snapshotId: params.snapshotId,
      },
    });
    if (!stored) throw new Error('L’instantané n’a pas été reçu durablement.');
    if (stored.payloadHash !== params.payloadHash) throw new ReportingIdempotencyConflictError();
    return { status: accepted ? 'accepted' : 'duplicate', accepted: accepted ? 1 : 0 };
  }

  async purgeExpired(auditBefore: Date, metricsBefore: Date): Promise<{ auditRows: number; metricRows: number }> {
    const auditResult = await this.auditRepo.delete({ receivedAt: LessThan(auditBefore) });
    const metricResult = await this.metricRepo.delete({ receivedAt: LessThan(metricsBefore) });
    return { auditRows: auditResult.affected ?? 0, metricRows: metricResult.affected ?? 0 };
  }
}
