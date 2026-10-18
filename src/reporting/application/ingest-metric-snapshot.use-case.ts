import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InvalidReportingPayloadError, ReportingSourceMismatchError } from '../domain/reporting-ingest.errors';
import { ReportingIngestRepository, REPORTING_INGEST_REPOSITORY } from '../domain/reporting-ingest.repository';
import { ReportingMetricPoint, ReportingSource } from '../domain/reporting-ingest.models';

export interface MetricSnapshotCommand {
  source: ReportingSource;
  authenticatedSource: ReportingSource;
  snapshotId: string;
  schemaVersion: string;
  windowStart: string;
  windowEnd: string;
  metrics: ReportingMetricPoint[];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function validateMetric(metric: ReportingMetricPoint): void {
  const counter = ['http.server.requests', 'http.server.errors', 'reporting.export.failures'];
  const gauge = ['reporting.outbox.pending', 'reporting.outbox.oldest_age'];

  if (counter.includes(metric.name)) {
    const expectedUnit = metric.name === 'reporting.export.failures' ? 'attempts' : 'requests';
    if (metric.kind !== 'counter' || metric.unit !== expectedUnit) {
      throw new InvalidReportingPayloadError('Type ou unité incompatible avec le compteur déclaré.');
    }
  } else if (gauge.includes(metric.name)) {
    const expectedUnit = metric.name.endsWith('oldest_age') ? 'seconds' : 'events';
    if (metric.kind !== 'gauge' || metric.unit !== expectedUnit) {
      throw new InvalidReportingPayloadError('Type ou unité incompatible avec la jauge déclarée.');
    }
  } else if (
    metric.name === 'http.server.request.duration' &&
    metric.kind === 'histogram_summary' &&
    ['ms_p50', 'ms_p95', 'ms_p99'].includes(metric.unit)
  ) {
    // Approved duration quantiles; route dimensions remain bounded by the DTO.
  } else {
    throw new InvalidReportingPayloadError('Combinaison métrique/type/unité non autorisée.');
  }

  if (
    ['http.server.requests', 'http.server.errors'].includes(metric.name) &&
    (!metric.dimensions.routeGroup || !metric.dimensions.statusClass)
  ) {
    throw new InvalidReportingPayloadError('Les dimensions de route et de statut sont obligatoires pour les compteurs HTTP.');
  }
  if (metric.name === 'http.server.request.duration' && !metric.dimensions.routeGroup) {
    throw new InvalidReportingPayloadError('La dimension de groupe de route est obligatoire pour les latences HTTP.');
  }
  if (metric.name.startsWith('reporting.outbox.') && metric.dimensions.component !== 'outbox') {
    throw new InvalidReportingPayloadError('La dimension component=outbox est obligatoire pour les métriques outbox.');
  }
  if (metric.name === 'reporting.export.failures' && metric.dimensions.component !== 'exporter') {
    throw new InvalidReportingPayloadError('La dimension component=exporter est obligatoire pour les métriques d’export.');
  }
}

@Injectable()
export class IngestMetricSnapshotUseCase {
  constructor(
    @Inject(REPORTING_INGEST_REPOSITORY) private readonly repository: ReportingIngestRepository,
  ) {}

  async execute(command: MetricSnapshotCommand) {
    this.assertSourceMatches(command.source, command.authenticatedSource);
    const start = Date.parse(command.windowStart);
    const end = Date.parse(command.windowEnd);
    const now = Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 24 * 60 * 60_000) {
      throw new InvalidReportingPayloadError('La fenêtre métrique doit être positive et ne pas dépasser 24 heures.');
    }
    if (end > now + 60_000) throw new InvalidReportingPayloadError('La fenêtre métrique est trop éloignée dans le futur.');
    command.metrics.forEach(validateMetric);

    const payloadHash = sha256({
      source: command.source,
      snapshotId: command.snapshotId,
      schemaVersion: command.schemaVersion,
      windowStart: new Date(start).toISOString(),
      windowEnd: new Date(end).toISOString(),
      metrics: command.metrics,
    });

    return this.repository.saveMetricSnapshot({
      source: command.source,
      snapshotId: command.snapshotId,
      schemaVersion: command.schemaVersion,
      windowStart: new Date(start),
      windowEnd: new Date(end),
      payloadHash,
      metrics: command.metrics,
    });
  }

  private assertSourceMatches(source: ReportingSource, principal: ReportingSource): void {
    if (
      source.applicationId !== principal.applicationId ||
      source.instanceId !== principal.instanceId ||
      source.environment !== principal.environment
    ) {
      throw new ReportingSourceMismatchError();
    }
  }
}
