import { ConfigService } from '@nestjs/config';
import { IngestAuditEventsUseCase } from '../../../src/reporting/application/ingest-audit-events.use-case';
import { IngestMetricSnapshotUseCase } from '../../../src/reporting/application/ingest-metric-snapshot.use-case';
import { AppConfiguration } from '../../../src/config/configuration';
import {
  InvalidReportingPayloadError,
  ReportingSourceMismatchError,
} from '../../../src/reporting/domain/reporting-ingest.errors';
import { ReportingIngestRepository } from '../../../src/reporting/domain/reporting-ingest.repository';
import { ReportingSource } from '../../../src/reporting/domain/reporting-ingest.models';

const source: ReportingSource = {
  applicationId: 'tradelink',
  instanceId: 'tradelink-test-01',
  environment: 'test',
};
const event = {
  eventId: 'f1f1f1f1-1111-4111-8111-111111111111',
  occurredAt: '2026-10-18T14:00:00.000Z',
  eventType: 'trade.catalogue.viewed',
  action: 'view',
  outcome: 'success' as const,
};

function repositoryMock(): jest.Mocked<ReportingIngestRepository> {
  return {
    saveAuditBatch: jest.fn().mockResolvedValue({ accepted: 1, duplicates: 0 }),
    saveMetricSnapshot: jest.fn().mockResolvedValue({ status: 'accepted', accepted: 1 }),
    purgeExpired: jest.fn().mockResolvedValue({ auditRows: 0, metricRows: 0 }),
  };
}

function reportingConfig(allowedAuditEventTypes = ['trade.catalogue.viewed']) {
  return {
    get: jest.fn(() => allowedAuditEventTypes),
  } as unknown as ConfigService<AppConfiguration>;
}

describe('Reporting ingest use cases', () => {
  it('refuse un événement dont la provenance ne correspond pas au token workload', async () => {
    const repository = repositoryMock();
    const useCase = new IngestAuditEventsUseCase(repository, reportingConfig());
    await expect(
      useCase.execute({
        batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
        schemaVersion: '1',
        source: { ...source, instanceId: 'other-instance' },
        authenticatedSource: source,
        events: [event],
      }),
    ).rejects.toBeInstanceOf(ReportingSourceMismatchError);
    expect(repository.saveAuditBatch).not.toHaveBeenCalled();
  });

  it('refuse tout type d’événement absent de l’allowlist configurée', async () => {
    const repository = repositoryMock();
    const useCase = new IngestAuditEventsUseCase(repository, reportingConfig([]));
    await expect(
      useCase.execute({
        batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
        schemaVersion: '1',
        source,
        authenticatedSource: source,
        events: [event],
      }),
    ).rejects.toBeInstanceOf(InvalidReportingPayloadError);
    expect(repository.saveAuditBatch).not.toHaveBeenCalled();
  });

  it('refuse une date audit trop future avant toute écriture', async () => {
    const repository = repositoryMock();
    const useCase = new IngestAuditEventsUseCase(repository, reportingConfig());
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    await expect(
      useCase.execute({
        batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
        schemaVersion: '1',
        source,
        authenticatedSource: source,
        events: [{ ...event, occurredAt: future }],
      }),
    ).rejects.toBeInstanceOf(InvalidReportingPayloadError);
    expect(repository.saveAuditBatch).not.toHaveBeenCalled();
  });

  it('envoie un hash déterministe calculé uniquement sur les champs allowlistés', async () => {
    const repository = repositoryMock();
    const useCase = new IngestAuditEventsUseCase(repository, reportingConfig());
    const command = {
      batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
      schemaVersion: '1',
      source,
      authenticatedSource: source,
      events: [event],
    };
    await useCase.execute(command);
    const first = repository.saveAuditBatch.mock.calls[0][0].events[0].payloadHash;
    await useCase.execute({
      ...command,
      batchId: 'b2b2b2b2-1111-4111-8111-111111111111',
      events: [{ outcome: 'success', action: 'view', eventType: 'trade.catalogue.viewed', occurredAt: event.occurredAt, eventId: event.eventId }],
    });
    const second = repository.saveAuditBatch.mock.calls[1][0].events[0].payloadHash;
    expect(first).toHaveLength(64);
    expect(first).toBe(second);
  });

  it('accepte uniquement les combinaisons métrique/type/unité/dimensions approuvées', async () => {
    const repository = repositoryMock();
    const useCase = new IngestMetricSnapshotUseCase(repository);
    const valid = {
      name: 'http.server.requests',
      kind: 'counter' as const,
      value: 15,
      unit: 'requests',
      dimensions: { routeGroup: 'trpc', statusClass: '2xx' },
    };
    const command = {
      source,
      authenticatedSource: source,
      snapshotId: 'b1b1b1b1-1111-4111-8111-111111111111',
      schemaVersion: '1',
      windowStart: new Date(Date.now() - 5 * 60_000).toISOString(),
      windowEnd: new Date().toISOString(),
      metrics: [valid],
    };
    await useCase.execute(command);
    expect(repository.saveMetricSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ source, snapshotId: command.snapshotId, metrics: [valid] }),
    );

    await expect(
      useCase.execute({ ...command, metrics: [{ ...valid, unit: 'attempts' }] }),
    ).rejects.toBeInstanceOf(InvalidReportingPayloadError);
    expect(repository.saveMetricSnapshot).toHaveBeenCalledTimes(1);
  });

  it('rejette une fenêtre supérieure à 24 heures', async () => {
    const repository = repositoryMock();
    const useCase = new IngestMetricSnapshotUseCase(repository);
    await expect(
      useCase.execute({
        source,
        authenticatedSource: source,
        snapshotId: 'b1b1b1b1-1111-4111-8111-111111111111',
        schemaVersion: '1',
        windowStart: '2026-10-17T00:00:00.000Z',
        windowEnd: '2026-10-18T14:00:00.000Z',
        metrics: [],
      }),
    ).rejects.toBeInstanceOf(InvalidReportingPayloadError);
  });
});
