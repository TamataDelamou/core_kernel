import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';
import {
  InvalidReportingPayloadError,
  ReportingSourceMismatchError,
} from '../domain/reporting-ingest.errors';
import { ReportingIngestRepository, REPORTING_INGEST_REPOSITORY } from '../domain/reporting-ingest.repository';
import { ReportingAuditEvent, ReportingSource } from '../domain/reporting-ingest.models';

export interface AuditIngestCommand {
  batchId: string;
  schemaVersion: string;
  source: ReportingSource;
  authenticatedSource: ReportingSource;
  events: ReportingAuditEvent[];
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

@Injectable()
export class IngestAuditEventsUseCase {
  constructor(
    @Inject(REPORTING_INGEST_REPOSITORY) private readonly repository: ReportingIngestRepository,
    private readonly config: ConfigService<AppConfiguration>,
  ) {}

  async execute(command: AuditIngestCommand): Promise<{ accepted: number; duplicates: number }> {
    this.assertSourceMatches(command.source, command.authenticatedSource);
    const allowedEventTypes = this.config.get('reporting.allowedAuditEventTypes', { infer: true }) ?? [];
    const now = Date.now();
    const events = command.events.map((event) => {
      if (!allowedEventTypes.includes(event.eventType)) {
        throw new InvalidReportingPayloadError('Le type d’événement audit n’est pas autorisé par la configuration.');
      }
      const occurredAt = Date.parse(event.occurredAt);
      if (!Number.isFinite(occurredAt) || occurredAt > now + 5 * 60_000) {
        throw new InvalidReportingPayloadError('L’horodatage de l’événement est invalide ou trop éloigné dans le futur.');
      }
      return {
        ...event,
        payloadHash: sha256({ schemaVersion: command.schemaVersion, source: command.source, event }),
      };
    });

    return this.repository.saveAuditBatch({
      batchId: command.batchId,
      schemaVersion: command.schemaVersion,
      source: command.source,
      events,
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
