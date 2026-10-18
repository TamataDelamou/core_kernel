import { ReportingAuditEvent, ReportingMetricPoint, ReportingSource } from './reporting-ingest.models';

export const REPORTING_INGEST_REPOSITORY = Symbol('REPORTING_INGEST_REPOSITORY');

export type SnapshotIngestResult = { status: 'accepted' | 'duplicate'; accepted: number };

export interface ReportingIngestRepository {
  saveAuditBatch(params: {
    batchId: string;
    schemaVersion: string;
    source: ReportingSource;
    events: Array<ReportingAuditEvent & { payloadHash: string }>;
  }): Promise<{ accepted: number; duplicates: number }>;
  saveMetricSnapshot(params: {
    source: ReportingSource;
    snapshotId: string;
    schemaVersion: string;
    windowStart: Date;
    windowEnd: Date;
    payloadHash: string;
    metrics: ReportingMetricPoint[];
  }): Promise<SnapshotIngestResult>;
  purgeExpired(auditBefore: Date, metricsBefore: Date): Promise<{ auditRows: number; metricRows: number }>;
}
