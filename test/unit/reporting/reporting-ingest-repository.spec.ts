import { In, LessThan } from 'typeorm';
import { TransactionContextService } from '../../../src/common/kernel-infrastructure/persistence/transaction-context.service';
import { ReportingIdempotencyConflictError } from '../../../src/reporting/domain/reporting-ingest.errors';
import { TypeOrmReportingIngestRepository } from '../../../src/reporting/infrastructure/persistence/typeorm/reporting-ingest.repository';

const eventId = 'f1f1f1f1-1111-4111-8111-111111111111';
const hash = 'a'.repeat(64);
const source = { applicationId: 'tradelink', instanceId: 'tradelink-test-01', environment: 'test' } as const;

function queryBuilder(raw: unknown[]) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['insert', 'into', 'values', 'orIgnore', 'returning']) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.execute = jest.fn().mockResolvedValue({ raw });
  return builder;
}

function buildRepository(options: { auditRaw?: unknown[]; auditRows?: unknown[]; metricRaw?: unknown[]; metricRow?: unknown } = {}) {
  const auditBuilder = queryBuilder(options.auditRaw ?? []);
  const metricBuilder = queryBuilder(options.metricRaw ?? []);
  const audit = {
    createQueryBuilder: jest.fn(() => auditBuilder),
    find: jest.fn().mockResolvedValue(options.auditRows ?? []),
    delete: jest.fn().mockResolvedValue({ affected: 2 }),
  };
  const metric = {
    createQueryBuilder: jest.fn(() => metricBuilder),
    findOne: jest.fn().mockResolvedValue(options.metricRow ?? null),
    delete: jest.fn().mockResolvedValue({ affected: 3 }),
  };
  const context = { getManager: jest.fn(() => null) } as unknown as TransactionContextService;
  const repository = new TypeOrmReportingIngestRepository(audit as never, metric as never, context);
  return { repository, audit, metric, auditBuilder, metricBuilder };
}

describe('TypeOrmReportingIngestRepository', () => {
  it('retourne acceptés/doublons à partir du résultat RETURNING et des lignes persistées', async () => {
    const { repository } = buildRepository({
      auditRaw: [{ event_id: eventId }],
      auditRows: [{ eventId, payloadHash: hash }],
    });
    await expect(
      repository.saveAuditBatch({
        batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
        schemaVersion: '1',
        source,
        events: [
          {
            eventId,
            occurredAt: '2026-10-18T14:00:00.000Z',
            eventType: 'trade.catalogue.viewed',
            action: 'view',
            outcome: 'success',
            payloadHash: hash,
          },
        ],
      }),
    ).resolves.toEqual({ accepted: 1, duplicates: 0 });
  });

  it('accepte un rejeu uniquement si le hash exact correspond', async () => {
    const { repository } = buildRepository({ auditRaw: [], auditRows: [{ eventId, payloadHash: hash }] });
    await expect(
      repository.saveAuditBatch({
        batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
        schemaVersion: '1',
        source,
        events: [{ eventId, occurredAt: '2026-10-18T14:00:00.000Z', eventType: 'trade.catalogue.viewed', action: 'view', outcome: 'success', payloadHash: hash }],
      }),
    ).resolves.toEqual({ accepted: 0, duplicates: 1 });
  });

  it('rejette le rejeu d’un ID avec payload différent', async () => {
    const { repository } = buildRepository({ auditRaw: [], auditRows: [{ eventId, payloadHash: 'b'.repeat(64) }] });
    await expect(
      repository.saveAuditBatch({
        batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
        schemaVersion: '1',
        source,
        events: [{ eventId, occurredAt: '2026-10-18T14:00:00.000Z', eventType: 'trade.catalogue.viewed', action: 'view', outcome: 'success', payloadHash: hash }],
      }),
    ).rejects.toBeInstanceOf(ReportingIdempotencyConflictError);
  });

  it('purge uniquement avant les seuils déterminés par la politique', async () => {
    const { repository, audit, metric } = buildRepository();
    const auditBefore = new Date('2026-01-01T00:00:00.000Z');
    const metricsBefore = new Date('2026-02-01T00:00:00.000Z');
    await expect(repository.purgeExpired(auditBefore, metricsBefore)).resolves.toEqual({ auditRows: 2, metricRows: 3 });
    expect(audit.delete).toHaveBeenCalledWith({ receivedAt: LessThan(auditBefore) });
    expect(metric.delete).toHaveBeenCalledWith({ receivedAt: LessThan(metricsBefore) });
    expect(In).toBeDefined();
  });
});
