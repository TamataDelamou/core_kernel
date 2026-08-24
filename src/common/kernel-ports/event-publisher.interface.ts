export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

/**
 * Schéma d'événement commun du noyau (KER-EVT-01) :
 * type, gsg_org_id, horodatage, charge utile, produit source.
 *
 * Ce port vit dans `common/` (et non dans un module produit) car il est transverse à
 * l'ensemble des futures briques du noyau (GSG ID, Org Registry, Referential Engine...),
 * conformément à KER-EVT-01/02 : chaque brique publie sur le même bus, avec le même
 * contrat d'événement, sans dupliquer sa propre définition.
 */
export interface KernelEvent {
  type: string;
  gsgOrgId: string | null;
  horodatage: string;
  produitSource: string;
  chargeUtile: Record<string, unknown>;
}

/**
 * Port pour la publication d'événements. GSG ID publie systématiquement les actions
 * significatives (inscription, authentification, MFA, liaison externe) pour alimenter
 * l'audit centralisé (KER-AUD-01, KER-AUD-04) sans coupler le noyau à une technologie
 * de bus spécifique (KER-EVT-01 : Redis Streams ou NATS au choix).
 */
export interface EventPublisher {
  publish(event: KernelEvent): Promise<void>;
}
