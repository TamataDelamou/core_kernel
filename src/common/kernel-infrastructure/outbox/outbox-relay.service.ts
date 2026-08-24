import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { OUTBOX_EVENT_REPOSITORY, OutboxEventRecord, OutboxEventRepository } from './outbox-event.repository';
import { AppConfiguration } from '../../../config/configuration';

/**
 * Relais Transactional Outbox → Redis Streams. Boucle de fond démarrée au chargement du
 * module (OnModuleInit) et arrêtée proprement à l'arrêt de l'application (OnModuleDestroy).
 *
 * Politique de retry : chaque échec de publication incrémente `tentatives` sur la ligne
 * concernée ; au-delà de `outbox.maxRetries`, un balayage périodique (`sweepPermanentFailures`)
 * bascule la ligne en statut `echec` terminal — visible pour investigation ops, mais qui ne
 * bloque jamais indéfiniment le traitement des lignes suivantes (contrairement à une file qui
 * réessaierait indéfiniment la même ligne en tête).
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly redis: Redis;
  private pollTimer: NodeJS.Timeout | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private cycleEnCours = false;

  constructor(
    @Inject(OUTBOX_EVENT_REPOSITORY) private readonly outboxEventRepository: OutboxEventRepository,
    private readonly configService: ConfigService<AppConfiguration>,
  ) {
    this.redis = new Redis({
      host: this.configService.get('redis.host', { infer: true }),
      port: this.configService.get('redis.port', { infer: true }),
      password: this.configService.get('redis.password', { infer: true }),
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.redis.on('error', (error) => {
      this.logger.warn(`Connexion Redis (Outbox Relay) en erreur : ${error.message}`);
    });
  }

  onModuleInit(): void {
    const pollIntervalMs = this.configService.get('outbox.pollIntervalMs', { infer: true }) as number;
    const sweepIntervalMs = pollIntervalMs * 20; // balayage des échecs permanents moins fréquent

    this.pollTimer = setInterval(() => void this.runCycle(), pollIntervalMs);
    this.sweepTimer = setInterval(() => void this.sweepPermanentFailures(), sweepIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    await this.redis.quit();
  }

  /** Traite un lot de lignes en attente. Ré-entrance protégée (un cycle à la fois). */
  private async runCycle(): Promise<void> {
    if (this.stopped || this.cycleEnCours) return;
    this.cycleEnCours = true;

    try {
      const batchSize = this.configService.get('outbox.batchSize', { infer: true }) as number;
      const lot = await this.outboxEventRepository.findPendingBatch(batchSize);

      for (const ligne of lot) {
        if (this.stopped) break;
        await this.relayOne(ligne);
      }
    } catch (error) {
      this.logger.error(
        `Cycle de relais outbox interrompu par une erreur inattendue : ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.cycleEnCours = false;
    }
  }

  private async relayOne(ligne: OutboxEventRecord): Promise<void> {
    const streamKey = this.configService.get('eventBus.streamPrefix', { infer: true }) as string;

    try {
      await this.redis.xadd(
        streamKey,
        '*',
        'outboxId',
        ligne.id,
        'type',
        ligne.type,
        'gsgOrgId',
        ligne.gsgOrgId ?? '',
        'horodatage',
        ligne.horodatage.toISOString(),
        'produitSource',
        ligne.produitSource,
        'chargeUtile',
        JSON.stringify(ligne.chargeUtile),
      );
      await this.outboxEventRepository.markPublished(ligne.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Échec de relais outbox → Redis pour l'événement "${ligne.type}" (${ligne.id}) : ${message}`);
      await this.outboxEventRepository.markFailedAttempt(ligne.id, message);
    }
  }

  private async sweepPermanentFailures(): Promise<void> {
    if (this.stopped) return;
    try {
      const maxRetries = this.configService.get('outbox.maxRetries', { infer: true }) as number;
      const nombreBascule = await this.outboxEventRepository.markPermanentlyFailed(maxRetries);
      if (nombreBascule > 0) {
        this.logger.error(
          `${nombreBascule} événement(s) de l'outbox basculé(s) en échec permanent après ` +
            `${maxRetries} tentatives — investigation ops requise (voir table evenement_outbox, statut = 'echec').`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Balayage des échecs permanents de l'outbox interrompu : ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
