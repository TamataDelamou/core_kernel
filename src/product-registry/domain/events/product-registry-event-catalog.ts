export const PRODUCT_REGISTRY_EVENT_TYPES = {
  PRODUIT_PORTEFEUILLE_CREATED: 'product_registry.produit.created',
  PRODUIT_PORTEFEUILLE_DEACTIVATED: 'product_registry.produit.deactivated',
  PRODUIT_PAYS_DEPLOIEMENT_CHANGED: 'product_registry.produit_pays_deploiement.changed',
} as const;

export type ProductRegistryEventType =
  (typeof PRODUCT_REGISTRY_EVENT_TYPES)[keyof typeof PRODUCT_REGISTRY_EVENT_TYPES];
