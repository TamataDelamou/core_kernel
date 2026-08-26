import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { ProcessStreamEventUseCase, StreamMessage } from '../../application/use-cases/process-stream-event.use-case';
import { MoveToDeadLetterUseCase } from '../../application/use-cases/dead-letter.use-cases';
import { shouldMoveToDeadLetter } from '../../domain/entities/evenement-en-echec.entity';
import { AppConfiguration } from '../../../config/configuration';

type RedisStreamFields = string[]; // [clé1, valeur1, clé2, valeur2, ...]
type RedisStreamEntry = [string, RedisStreamFields]; // [id, champs]

/**
 * Consommateur Redis Streams par groupe (KER-AUD, "formaliser la consommation des événements
 * déjà émis par les 4 modules"). Deux boucles indépendantes tournent en parallèle :
 *
 *  1. **Boucle de lecture** (`runReadLoop`) : XREADGROUP en mode bloquant, ne lit que des
 *     messages jamais délivrés à aucun consommateur (`>`). Chaque message réussi est acquitté
 *     (XACK) immédiatement — un message qui échoue N'EST PAS acquitté et reste "pending"
 *     jusqu'à la boucle de réclamation.
 *  2. **Boucle de réclamation** (`runClaimLoop`) : XPENDING (avec filtre IDLE) inspecte les
 *     messages restés en attente au-delà de `claimIdleMs` — soit parce qu'un consommateur a
 *     crashé en cours de traitement, soit parce que le traitement a échoué. Ceux ayant dépassé
 *     `maxDeliveries` tentatives basculent en Dead-Letter Queue et sont acquittés (retirés du
 *     flux normal, mais jamais perdus — conservés dans `evenement_en_echec`). Les autres sont
 *     réclamés (XCLAIM) par ce consommateur et retraités.
 *
 * La logique de traitement d'UN message (`handleMessage`) est extraite et testable sans Redis
 * réel — seules les boucles réseau elles-mêmes nécessitent une instance Redis pour être exercées.
 */
@Injectable()
export class RedisStreamsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisStreamsConsumerService.name);
  private readonly redis: Redis;
  private readonly consumerName: string;
  private stopped = false;
  private claimTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(ProcessStreamEventUseCase) private readonly processStreamEventUseCase: ProcessStreamEventUseCase,
    @Inject(MoveToDeadLetterUseCase) private readonly moveToDeadLetterUseCase: MoveToDeadLetterUseCase,
    private readonly configService: ConfigService<AppConfiguration>,
  ) {
    this.redis = new Redis({
      host: this.configService.get('redis.host', { infer: true }),
      port: this.configService.get('redis.port', { infer: true }),
      password: this.configService.get('redis.password', { infer: true }),
      maxRetriesPerRequest: null, // requis pour les commandes bloquantes (XREADGROUP ... BLOCK)
      lazyConnect: false,
    });
    this.redis.on('error', (error) => {
      this.logger.warn(`Connexion Redis (Audit Consumer) en erreur : ${error.message}`);
    });
    this.consumerName = `audit-consumer-${randomUUID()}`;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureConsumerGroupExists();
    void this.runReadLoop().catch((error) =>
      this.logger.error(`Boucle de lecture interrompue de façon inattendue : ${error instanceof Error ? error.message : String(error)}`),
    );

    const claimIntervalMs = this.configService.get('audit.claimIntervalMs', { infer: true }) as number;
    this.claimTimer = setInterval(
      () => void this.runClaimCycle().catch((error) => this.logger.error(`Cycle de réclamation inattendu : ${error instanceof Error ? error.message : String(error)}`)),
      claimIntervalMs,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.claimTimer) clearInterval(this.claimTimer);
    // disconnect() plutôt que quit() : quit() envoie la commande QUIT au serveur et ATTEND sa
    // réponse — si une commande bloquante (XREADGROUP ... BLOCK) est en vol au même instant,
    // Redis traitant les commandes séquentiellement sur une connexion, quit() doit attendre
    // la fin du blocage avant de pouvoir fermer proprement. NestJS ferme les providers de
    // façon séquentielle (pas en parallèle) à l'arrêt de l'application — l'attente cumulée de
    // plusieurs quit() bloquants peut dépasser le timeout par défaut des hooks Jest (5s),
    // provoquant un rejet Redis résiduel sans contexte de test valide pour l'absorber.
    // disconnect() ferme le socket immédiatement, sans attendre — le try/catch de
    // runReadLoop() absorbe déjà le rejet qui en résulte pour la commande interrompue.
    this.redis.disconnect();
  }

  private async ensureConsumerGroupExists(): Promise<void> {
    const streamKey = this.streamKey();
    const group = this.configService.get('audit.consumerGroup', { infer: true }) as string;

    try {
      // '$' = ne consommer que les messages publiés APRÈS la création du groupe si celui-ci
      // n'existait pas encore ; MKSTREAM crée le flux lui-même s'il n'existe pas non plus.
      await this.redis.xgroup('CREATE', streamKey, group, '$', 'MKSTREAM');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('BUSYGROUP')) {
        this.logger.error(`Impossible de créer le groupe de consommateurs Redis Streams : ${message}`);
        throw error;
      }
      // BUSYGROUP = le groupe existe déjà (redémarrage du service) — situation normale, idempotente.
    }
  }

  private async runReadLoop(): Promise<void> {
    const streamKey = this.streamKey();
    const group = this.configService.get('audit.consumerGroup', { infer: true }) as string;
    const batchSize = this.configService.get('audit.batchSize', { infer: true }) as number;
    const blockMs = this.configService.get('audit.blockMs', { infer: true }) as number;

    while (!this.stopped) {
      let resultat: [string, RedisStreamEntry[]][] | null;
      try {
        resultat = (await this.redis.xreadgroup(
          'GROUP',
          group,
          this.consumerName,
          'COUNT',
          batchSize,
          'BLOCK',
          blockMs,
          'STREAMS',
          streamKey,
          '>',
        )) as unknown as [string, RedisStreamEntry[]][] | null;
      } catch (error) {
        if (this.stopped) break;
        this.logger.warn(
          `XREADGROUP en erreur, nouvelle tentative dans 1s : ${error instanceof Error ? error.message : String(error)}`,
        );
        await this.sleep(1000);
        continue;
      }

      if (!resultat) continue; // timeout de BLOCK sans nouveau message — boucle normale

      for (const [, entries] of resultat) {
        for (const [id, fields] of entries) {
          await this.handleMessage(id, fields, 1);
        }
      }
    }
  }

  private async runClaimCycle(): Promise<void> {
    if (this.stopped) return;

    const streamKey = this.streamKey();
    const group = this.configService.get('audit.consumerGroup', { infer: true }) as string;
    const claimIdleMs = this.configService.get('audit.claimIdleMs', { infer: true }) as number;
    const maxDeliveries = this.configService.get('audit.maxDeliveries', { infer: true }) as number;
    const batchSize = this.configService.get('audit.batchSize', { infer: true }) as number;

    try {
      const entreesEnAttente = (await this.redis.xpending(
        streamKey,
        group,
        'IDLE',
        claimIdleMs,
        '-',
        '+',
        batchSize,
      )) as unknown as [string, string, number, number][];

      for (const [id, , , deliveryCount] of entreesEnAttente) {
        if (shouldMoveToDeadLetter(deliveryCount, maxDeliveries)) {
          await this.moveEntryToDeadLetter(streamKey, group, id, deliveryCount);
          continue;
        }

        const reclamees = (await this.redis.xclaim(
          streamKey,
          group,
          this.consumerName,
          claimIdleMs,
          id,
        )) as unknown as RedisStreamEntry[];

        for (const [claimedId, fields] of reclamees) {
          await this.handleMessage(claimedId, fields, deliveryCount + 1);
        }
      }
    } catch (error) {
      this.logger.error(
        `Cycle de réclamation interrompu par une erreur : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async moveEntryToDeadLetter(
    streamKey: string,
    group: string,
    id: string,
    deliveryCount: number,
  ): Promise<void> {
    try {
      const plage = await this.redis.xrange(streamKey, id, id);
      if (plage.length > 0) {
        const [, fields] = plage[0] as unknown as RedisStreamEntry;
        const message = this.parseFields(fields);
        await this.moveToDeadLetterUseCase.execute({
          message,
          tentatives: deliveryCount,
          derniereErreur: `Nombre maximal de tentatives de livraison dépassé (${deliveryCount}).`,
        });
      } else {
        this.logger.warn(
          `Message ${id} introuvable via XRANGE au moment de la bascule DLQ — probablement déjà purgé du flux.`,
        );
      }
    } finally {
      // Acquitté dans tous les cas : un message qui a dépassé le nombre maximal de tentatives
      // ne doit plus jamais réapparaître dans la liste des messages en attente, qu'il ait pu
      // être archivé en DLQ ou non (cas limite : purge concurrente du flux Redis).
      await this.redis.xack(streamKey, group, id);
    }
  }

  /** Traitement d'un message unique — logique testable indépendamment de la connexion Redis. */
  private async handleMessage(id: string, fields: RedisStreamFields, deliveryAttempt: number): Promise<void> {
    const streamKey = this.streamKey();
    const group = this.configService.get('audit.consumerGroup', { infer: true }) as string;

    try {
      const message = this.parseFields(fields);
      await this.processStreamEventUseCase.execute(message);
      await this.redis.xack(streamKey, group, id);
    } catch (error) {
      // Message NON acquitté volontairement : il reste "pending" et sera traité par la
      // boucle de réclamation (retry si sous le seuil, DLQ sinon) — jamais de retry immédiat
      // en boucle serrée ici, qui saturerait inutilement le worker sur un message problématique.
      this.logger.warn(
        `Échec de traitement du message ${id} (tentative ${deliveryAttempt}) : ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private parseFields(fields: RedisStreamFields): StreamMessage {
    const map = new Map<string, string>();
    for (let i = 0; i < fields.length; i += 2) {
      map.set(fields[i], fields[i + 1]);
    }
    return {
      outboxId: map.get('outboxId') ?? '',
      type: map.get('type') ?? '',
      gsgOrgId: map.get('gsgOrgId') || null,
      horodatage: map.get('horodatage') ?? new Date().toISOString(),
      produitSource: map.get('produitSource') ?? 'inconnu',
      chargeUtileBrute: map.get('chargeUtile') ?? '{}',
    };
  }

  private streamKey(): string {
    return this.configService.get('eventBus.streamPrefix', { infer: true }) as string;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
