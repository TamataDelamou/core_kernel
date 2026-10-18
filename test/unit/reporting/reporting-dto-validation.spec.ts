import { ValidationPipe } from '@nestjs/common';
import { IngestAuditEventsBatchDto, IngestMetricSnapshotBatchDto } from '../../../src/reporting/interface/http/dto/reporting.dto';

const source = { applicationId: 'tradelink', instanceId: 'tradelink-test-01', environment: 'test' };
const event = {
  eventId: 'f1f1f1f1-1111-4111-8111-111111111111',
  occurredAt: '2026-10-18T14:00:00.000Z',
  eventType: 'trade.catalogue.viewed',
  action: 'view',
  outcome: 'success',
};

const pipe = () => new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

describe('Reporting DTO strict validation', () => {
  it('accepte un batch d’audit minimal et versionné', async () => {
    const dto = await pipe().transform(
      { schemaVersion: '1', batchId: 'a1a1a1a1-1111-4111-8111-111111111111', source, events: [event] },
      { type: 'body', metatype: IngestAuditEventsBatchDto },
    );
    expect(dto).toBeInstanceOf(IngestAuditEventsBatchDto);
  });

  it('rejette les champs libres sensibles au niveau événement et source', async () => {
    await expect(
      pipe().transform(
        {
          schemaVersion: '1',
          batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
          source: { ...source, customerEmail: 'person@example.test' },
          events: [{ ...event, email: 'person@example.test' }],
        },
        { type: 'body', metatype: IngestAuditEventsBatchDto },
      ),
    ).rejects.toThrow();
  });

  it('rejette les références personnelles non pseudonymisées et les IDs répétés', async () => {
    const base = { schemaVersion: '1', batchId: 'a1a1a1a1-1111-4111-8111-111111111111', source };
    await expect(
      pipe().transform(
        { ...base, events: [{ ...event, actorRef: 'person@example.test' }] },
        { type: 'body', metatype: IngestAuditEventsBatchDto },
      ),
    ).rejects.toThrow();
    await expect(
      pipe().transform(
        { ...base, events: [event, event] },
        { type: 'body', metatype: IngestAuditEventsBatchDto },
      ),
    ).rejects.toThrow();
  });

  it('rejette métriques libres, valeurs négatives et dimensions inconnues', async () => {
    const body = {
      schemaVersion: '1',
      snapshotId: 'b1b1b1b1-1111-4111-8111-111111111111',
      source,
      windowStart: '2026-10-18T14:00:00.000Z',
      windowEnd: '2026-10-18T14:05:00.000Z',
      metrics: [
        {
          name: 'arbitrary.customer.metric',
          kind: 'gauge',
          value: -1,
          unit: 'requests',
          dimensions: { routeGroup: 'trpc', statusClass: '2xx', email: 'person@example.test' },
        },
      ],
    };
    await expect(
      pipe().transform(body, { type: 'body', metatype: IngestMetricSnapshotBatchDto }),
    ).rejects.toThrow();
  });
});
