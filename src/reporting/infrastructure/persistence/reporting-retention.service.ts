import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../../config/configuration';
import { REPORTING_INGEST_REPOSITORY, ReportingIngestRepository } from '../../domain/reporting-ingest.repository';

const DAILY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReportingRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportingRetentionService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppConfiguration>,
    @Inject(REPORTING_INGEST_REPOSITORY) private readonly repository: ReportingIngestRepository,
  ) {}

  onModuleInit(): void {
    const reporting = this.config.get('reporting', { infer: true });
    if (!reporting?.ingestEnabled) return;
    this.timer = setInterval(() => void this.runOnce(), DAILY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    const reporting = this.config.get('reporting', { infer: true });
    if (!reporting) return;
    if (reporting.auditRetentionDays < 1 || reporting.metricsRetentionDays < 1) return;

    this.running = true;
    try {
      const now = Date.now();
      const result = await this.repository.purgeExpired(
        new Date(now - reporting.auditRetentionDays * DAILY_MS),
        new Date(now - reporting.metricsRetentionDays * DAILY_MS),
      );
      if (result.auditRows > 0 || result.metricRows > 0) {
        this.logger.log(`Rétention reporting appliquée : ${result.auditRows} audit(s), ${result.metricRows} snapshot(s) supprimé(s).`);
      }
    } catch {
      // Do not include database errors or payload data in application logs.
      this.logger.error('Échec du cycle de rétention reporting; une nouvelle tentative aura lieu au prochain cycle.');
    } finally {
      this.running = false;
    }
  }
}
