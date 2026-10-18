import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../../../config/configuration';
import {
  IngestAuditEventsBatchDto,
  IngestMetricSnapshotBatchDto,
} from '../dto/reporting.dto';
import {
  ReportingRequest,
  ReportingWorkloadGuard,
  RequireReportingScope,
} from '../guards/reporting-workload.guard';
import {
  InvalidReportingPayloadError,
  ReportingIdempotencyConflictError,
  ReportingSourceMismatchError,
} from '../../../domain/reporting-ingest.errors';
import {
  reportingAuditEventFromDto,
  reportingMetricPointFromDto,
  reportingSourceFromDto,
} from '../../../domain/reporting-ingest.models';
import { IngestAuditEventsUseCase } from '../../../application/ingest-audit-events.use-case';
import { IngestMetricSnapshotUseCase } from '../../../application/ingest-metric-snapshot.use-case';

@Controller({ path: 'control-plane/reporting', version: '1' })
@UseGuards(ReportingWorkloadGuard)
export class ReportingIngestController {
  constructor(
    private readonly config: ConfigService<AppConfiguration>,
    private readonly ingestAuditEvents: IngestAuditEventsUseCase,
    private readonly ingestMetricSnapshot: IngestMetricSnapshotUseCase,
  ) {}

  @Post('audit-events/batch')
  @HttpCode(202)
  @RequireReportingScope('reporting.audit.write')
  async ingestAuditBatch(@Req() request: ReportingRequest, @Body() body: IngestAuditEventsBatchDto) {
    const reporting = this.config.get('reporting', { infer: true });
    if (!reporting) throw new NotFoundException('Endpoint indisponible.');
    if (body.events.length > reporting.maxAuditBatchItems) {
      throw new BadRequestException('Le lot dépasse la limite configurée.');
    }
    const principal = request.reportingPrincipal;
    if (!principal) throw new ForbiddenException('Identité de service absente.');

    try {
      const result = await this.ingestAuditEvents.execute({
        batchId: body.batchId,
        schemaVersion: body.schemaVersion,
        source: reportingSourceFromDto(body.source),
        authenticatedSource: {
          applicationId: principal.applicationId,
          instanceId: principal.instanceId,
          environment: principal.environment,
        },
        events: body.events.map(reportingAuditEventFromDto),
      });
      return { batchId: body.batchId, status: 'accepted' as const, ...result };
    } catch (error) {
      this.mapError(error);
    }
  }

  @Post('metrics/snapshots/batch')
  @HttpCode(202)
  @RequireReportingScope('reporting.metrics.write')
  async ingestMetricsBatch(@Req() request: ReportingRequest, @Body() body: IngestMetricSnapshotBatchDto) {
    const reporting = this.config.get('reporting', { infer: true });
    if (!reporting) throw new NotFoundException('Endpoint indisponible.');
    if (
      body.metrics.length > reporting.maxMetricBatchItems ||
      body.metrics.length > reporting.maxMetricsPerSnapshot
    ) {
      throw new BadRequestException('Le lot dépasse la limite configurée.');
    }
    const principal = request.reportingPrincipal;
    if (!principal) throw new ForbiddenException('Identité de service absente.');

    try {
      const result = await this.ingestMetricSnapshot.execute({
        source: reportingSourceFromDto(body.source),
        authenticatedSource: {
          applicationId: principal.applicationId,
          instanceId: principal.instanceId,
          environment: principal.environment,
        },
        snapshotId: body.snapshotId,
        schemaVersion: body.schemaVersion,
        windowStart: body.windowStart,
        windowEnd: body.windowEnd,
        metrics: body.metrics.map(reportingMetricPointFromDto),
      });
      return { snapshotId: body.snapshotId, ...result };
    } catch (error) {
      this.mapError(error);
    }
  }

  private mapError(error: unknown): never {
    if (error instanceof ReportingIdempotencyConflictError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof ReportingSourceMismatchError) {
      throw new ForbiddenException('La provenance ne correspond pas à cette identité de service.');
    }
    if (error instanceof InvalidReportingPayloadError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
