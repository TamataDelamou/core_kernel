import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestAuditEventsUseCase } from './application/ingest-audit-events.use-case';
import { IngestMetricSnapshotUseCase } from './application/ingest-metric-snapshot.use-case';
import { REPORTING_INGEST_REPOSITORY } from './domain/reporting-ingest.repository';
import { ReportingIngestController } from './interface/http/controllers/reporting-ingest.controller';
import { ReportingWorkloadGuard } from './interface/http/guards/reporting-workload.guard';
import { ConfiguredReportingJwtVerifier, REPORTING_JWT_VERIFIER } from './infrastructure/security/reporting-jwt-verifier';
import { ReportingRetentionService } from './infrastructure/persistence/reporting-retention.service';
import { TypeOrmReportingIngestRepository } from './infrastructure/persistence/typeorm/reporting-ingest.repository';
import {
  ReportingAuditEventOrmEntity,
  ReportingMetricSnapshotOrmEntity,
} from './infrastructure/persistence/typeorm/orm-entities';

@Module({
  imports: [TypeOrmModule.forFeature([ReportingAuditEventOrmEntity, ReportingMetricSnapshotOrmEntity])],
  controllers: [ReportingIngestController],
  providers: [
    IngestAuditEventsUseCase,
    IngestMetricSnapshotUseCase,
    ReportingWorkloadGuard,
    ConfiguredReportingJwtVerifier,
    { provide: REPORTING_JWT_VERIFIER, useFactory: (verifier: ConfiguredReportingJwtVerifier) => verifier.verify, inject: [ConfiguredReportingJwtVerifier] },
    TypeOrmReportingIngestRepository,
    { provide: REPORTING_INGEST_REPOSITORY, useExisting: TypeOrmReportingIngestRepository },
    ReportingRetentionService,
  ],
})
export class ReportingModule {}
