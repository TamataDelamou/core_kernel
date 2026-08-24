import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EventPublisher, KernelEvent } from '../../kernel-ports/event-publisher.interface';
import { OUTBOX_EVENT_REPOSITORY, OutboxEventRepository } from '../outbox/outbox-event.repository';

/**
 * Implémentation du port EVENT_PUBLISHER fondée sur le pattern Transactional Outbox. Aucun
 * appel réseau vers Redis n'a lieu de façon synchrone dans le chemin d'exécution d'un
 * use-case : l'événement est inséré dans la table `evenement_outbox` (même base Postgres
 * que l'entité métier qui vient d'être sauvegardée), et c'est OutboxRelayService, en tâche
 * de fond, qui relaie ensuite vers Redis Streams avec retry/backoff.
 *
 * Conséquence directe pour la résilience de la plateforme (demande explicite "Résilience de
 * l'Event Bus") : un ralentissement ou une panne complète de Redis n'entraîne plus JAMAIS
 * l'échec d'un use-case métier — au pire, les événements s'accumulent dans l'outbox jusqu'à
 * ce que Redis redevienne disponible, sans qu'aucune donnée métier ni aucun événement ne
 * soit perdu. C'est un changement direct par rapport à l'ancien RedisEventPublisherService
 * (XADD synchrone, dégradation "best effort" par simple log en cas d'échec réseau — un
 * événement pouvait alors être silencieusement perdu).
 *
 * Aucun use-case existant n'a besoin d'être modifié pour bénéficier de ce changement : ils
 * dépendent tous exclusivement du port EVENT_PUBLISHER (common/kernel-ports), jamais de cette
 * classe directement — c'est précisément le bénéfice du pattern ports-adaptateurs.
 */
@Injectable()
export class OutboxEventPublisherService implements EventPublisher {
  private readonly logger = new Logger(OutboxEventPublisherService.name);

  constructor(
    @Inject(OUTBOX_EVENT_REPOSITORY) private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  async publish(event: KernelEvent): Promise<void> {
    try {
      await this.outboxEventRepository.insert({
        id: uuidv4(),
        type: event.type,
        gsgOrgId: event.gsgOrgId,
        horodatage: new Date(event.horodatage),
        produitSource: event.produitSource,
        chargeUtile: event.chargeUtile,
        creeLe: new Date(),
      });
    } catch (error) {
      // Une panne Postgres au moment précis de l'insertion outbox reste possible (rare, la
      // même base venant de servir à sauvegarder l'entité métier). Ce cas ne doit pas non
      // plus faire échouer le use-case appelant (KER-VIS-04 : le noyau ne bloque jamais un
      // produit) — il est journalisé pour investigation, au prix d'un événement potentiellement
      // perdu dans ce cas limite. Une atomicité complète (même transaction que l'entité
      // métier) éliminerait entièrement ce résidu — voir TransactionManager dans le README.
      this.logger.error(
        `Échec d'insertion dans l'outbox pour l'événement "${event.type}" : ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
