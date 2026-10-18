import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IngestAuditEventsUseCase } from '../../../src/reporting/application/ingest-audit-events.use-case';
import { IngestMetricSnapshotUseCase } from '../../../src/reporting/application/ingest-metric-snapshot.use-case';
import { ReportingIngestController } from '../../../src/reporting/interface/http/controllers/reporting-ingest.controller';
import { ReportingWorkloadGuard } from '../../../src/reporting/interface/http/guards/reporting-workload.guard';

const principal = {
  applicationId: 'tradelink',
  instanceId: 'tradelink-test-01',
  environment: 'test' as const,
  scopes: ['reporting.audit.write', 'reporting.metrics.write'],
};
const source = {
  applicationId: principal.applicationId,
  instanceId: principal.instanceId,
  environment: principal.environment,
};

describe('Reporting ingestion HTTP contract', () => {
  let app: INestApplication;
  const auditExecute = jest.fn().mockResolvedValue({ accepted: 1, duplicates: 0 });
  const metricsExecute = jest.fn().mockResolvedValue({ status: 'accepted', accepted: 1 });
  const config = {
    get: jest.fn(() => ({ maxAuditBatchItems: 2, maxMetricBatchItems: 2, maxMetricsPerSnapshot: 2 })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportingIngestController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: IngestAuditEventsUseCase, useValue: { execute: auditExecute } },
        { provide: IngestMetricSnapshotUseCase, useValue: { execute: metricsExecute } },
      ],
    })
      .overrideGuard(ReportingWorkloadGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): { reportingPrincipal?: unknown } } }) => {
          context.switchToHttp().getRequest().reportingPrincipal = principal;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => {
    auditExecute.mockClear();
    metricsExecute.mockClear();
  });

  it('reçoit un lot audit valide sur /api/v1 et retourne l’acceptation durable 202', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/control-plane/reporting/audit-events/batch')
      .send({
        schemaVersion: '1',
        batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
        source,
        events: [{
          eventId: 'f1f1f1f1-1111-4111-8111-111111111111',
          occurredAt: '2026-10-18T14:00:00.000Z',
          eventType: 'trade.catalogue.viewed',
          action: 'view',
          outcome: 'success',
        }],
      });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
      status: 'accepted',
      accepted: 1,
      duplicates: 0,
    });
    expect(auditExecute).toHaveBeenCalledTimes(1);
  });

  it('rejette un champ inconnu imbriqué et ne persiste rien', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/control-plane/reporting/audit-events/batch')
      .send({
        schemaVersion: '1',
        batchId: 'a1a1a1a1-1111-4111-8111-111111111111',
        source: { ...source, email: 'person@example.test' },
        events: [{
          eventId: 'f1f1f1f1-1111-4111-8111-111111111111',
          occurredAt: '2026-10-18T14:00:00.000Z',
          eventType: 'trade.catalogue.viewed',
          action: 'view',
          outcome: 'success',
        }],
      });
    expect(response.status).toBe(400);
    expect(auditExecute).not.toHaveBeenCalled();
  });

  it('isole le chemin métrique et utilise son endpoint distinct', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/control-plane/reporting/metrics/snapshots/batch')
      .send({
        schemaVersion: '1',
        snapshotId: 'b1b1b1b1-1111-4111-8111-111111111111',
        source,
        windowStart: '2026-10-18T14:00:00.000Z',
        windowEnd: '2026-10-18T14:05:00.000Z',
        metrics: [{
          name: 'http.server.requests',
          kind: 'counter',
          value: 10,
          unit: 'requests',
          dimensions: { routeGroup: 'trpc', statusClass: '2xx' },
        }],
      });
    expect(response.status).toBe(202);
    expect(metricsExecute).toHaveBeenCalledTimes(1);
  });
});
