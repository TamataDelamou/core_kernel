import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import {
  COMPTEUR_VILLES_RATTACHEES_REPOSITORY,
  CompteurVillesRattacheesRepository,
} from '../../domain/repositories/referential-engine.repositories';
import { AppConfiguration } from '../../../config/configuration';

type RedisStreamFields = string[];
type RedisStreamEntry = [string, RedisStreamFields];

const TYPE_VILLE_CREATED = 'referential.ville.created';
const TYPE_VILLE_MOVED = 'referential.ville.moved';

/**
 * KER-ADM-04, volet "villes rattachées" : consomme le MÊME flux Redis Streams partagé que
 * RedisStreamsConsumerService (module Audit), mais avec son PROPRE groupe de consommateurs —
 * chaque groupe est un lecteur indépendant du flux entier (KER-EVT-01). Filtre par `type` et
 * acquitte immédiatement tout message qui n'est ni `referential.ville.created` ni
 * `referential.ville.moved` — la grande majorité du trafic du flux partagé ne concerne pas
 * ce consommateur, mais Redis Streams ne permet pas de filtrer côté serveur par groupe.
 *
 * Volontairement plus simple que celui d'Audit : aucune Dead-Letter Queue. Cette table n'est
 * qu'un cache local eventually-consistent (KER-VIS-03 — jamais une source de vérité, celle-ci
 * reste dans `referential`) ; en cas d'échec répété, la réclamation (XCLAIM) retente
 * indéfiniment plutôt que d'abandonner dans une DLQ qui n'aurait pas de sens ici — si un
 * message échoue vraiment en boucle, c'est un bug à corriger, pas un cas à archiver.
 */
@Injectable()
export class VilleRattacheeConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VilleRattacheeConsumerService.name);
  private readonly redis: Redis;
  private readonly consumerName: string;
  private stopped = false;
  private claimTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(COMPTEUR_VILLES_RATTACHEES_REPOSITORY)
    private readonly compteurRepository: CompteurVillesRattacheesRepository,
    private readonly configService: ConfigService<AppConfiguration>,
  ) {
    this.redis = new Redis({
      host: this.configService.get('redis.host', { infer: true }),
      port: this.configService.get('redis.port', { infer: true }),
      password: this.configService.get('redis.password', { infer: true }),
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    this.redis.on('error', (error) => {
      this.logger.warn(`Connexion Redis (Compteur Villes Rattachées) en erreur : ${error.message}`);
    });
    this.consumerName = `ref-engine-villes-consumer-${randomUUID()}`;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureConsumerGroupExists();
    void this.runReadLoop();

    const claimIntervalMs = this.configService.get('referentialEngineVilles.claimIntervalMs', {
      infer: true,
    }) as number;
    this.claimTimer = setInterval(() => void this.runClaimCycle(), claimIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.claimTimer) clearInterval(this.claimTimer);
    // Voir le commentaire détaillé dans audit/redis-streams-consumer.service.ts (même
    // raisonnement, même correctif) : disconnect() immédiat plutôt que quit() qui attend un
    // blocage en vol.
    this.redis.disconnect();
  }

  private async ensureConsumerGroupExists(): Promise<void> {
    const streamKey = this.streamKey();
    const group = this.configService.get('referentialEngineVilles.consumerGroup', { infer: true }) as string;

    try {
      await this.redis.xgroup('CREATE', streamKey, group, '$', 'MKSTREAM');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('BUSYGROUP')) {
        this.logger.error(`Impossible de créer le groupe de consommateurs (compteur villes) : ${message}`);
        throw error;
      }
    }
  }

  private async runReadLoop(): Promise<void> {
    const streamKey = this.streamKey();
    const group = this.configService.get('referentialEngineVilles.consumerGroup', { infer: true }) as string;
    const batchSize = this.configService.get('referentialEngineVilles.batchSize', { infer: true }) as number;
    const blockMs = this.configService.get('referentialEngineVilles.blockMs', { infer: true }) as number;

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
          `XREADGROUP (compteur villes) en erreur, nouvelle tentative dans 1s : ${error instanceof Error ? error.message : String(error)}`,
        );
        await this.sleep(1000);
        continue;
      }

      if (!resultat) continue;

      for (const [, entries] of resultat) {
        for (const [id, fields] of entries) {
          await this.handleMessage(id, fields);
        }
      }
    }
  }

  private async runClaimCycle(): Promise<void> {
    if (this.stopped) return;

    const streamKey = this.streamKey();
    const group = this.configService.get('referentialEngineVilles.consumerGroup', { infer: true }) as string;
    const claimIdleMs = this.configService.get('referentialEngineVilles.claimIdleMs', { infer: true }) as number;
    const batchSize = this.configService.get('referentialEngineVilles.batchSize', { infer: true }) as number;

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

      for (const [id] of entreesEnAttente) {
        const reclamees = (await this.redis.xclaim(
          streamKey,
          group,
          this.consumerName,
          claimIdleMs,
          id,
        )) as unknown as RedisStreamEntry[];

        for (const [claimedId, fields] of reclamees) {
          await this.handleMessage(claimedId, fields);
        }
      }
    } catch (error) {
      this.logger.error(
        `Cycle de réclamation (compteur villes) interrompu : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async handleMessage(id: string, fields: RedisStreamFields): Promise<void> {
    const streamKey = this.streamKey();
    const group = this.configService.get('referentialEngineVilles.consumerGroup', { infer: true }) as string;
    const map = this.parseFields(fields);
    const type = map.get('type');

    if (type !== TYPE_VILLE_CREATED && type !== TYPE_VILLE_MOVED) {
      await this.redis.xack(streamKey, group, id);
      return;
    }

    try {
      const chargeUtile = JSON.parse(map.get('chargeUtile') ?? '{}') as Record<string, unknown>;

      if (type === TYPE_VILLE_CREATED) {
        const noeudId = chargeUtile.referentielHierarchiqueId as string | null;
        if (noeudId) await this.compteurRepository.incrementer(noeudId);
      } else {
        const ancien = chargeUtile.ancienReferentielHierarchiqueId as string | null;
        const nouveau = chargeUtile.nouveauReferentielHierarchiqueId as string | null;
        if (ancien) await this.compteurRepository.decrementer(ancien);
        if (nouveau) await this.compteurRepository.incrementer(nouveau);
      }

      await this.redis.xack(streamKey, group, id);
    } catch (error) {
      this.logger.warn(
        `Échec de traitement du message ${id} (compteur villes) : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private parseFields(fields: RedisStreamFields): Map<string, string> {
    const map = new Map<string, string>();
    for (let i = 0; i < fields.length; i += 2) {
      map.set(fields[i], fields[i + 1]);
    }
    return map;
  }

  private streamKey(): string {
    return this.configService.get('eventBus.streamPrefix', { infer: true }) as string;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
