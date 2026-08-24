export const PRODUCT_EVENT_TYPES = {
  CATALOGUE_CREATED: 'product.catalogue.created',
  CATALOGUE_PUBLISHED: 'product.catalogue.published',
  CATALOGUE_ARCHIVED: 'product.catalogue.archived',
  PRODUCT_CREATED: 'product.produit.created',
  PRODUCT_PUBLISHED: 'product.produit.published',
  PRODUCT_ARCHIVED: 'product.produit.archived',
  OFFER_CREATED: 'product.offre.created',
  OFFER_PUBLISHED: 'product.offre.published',
  OFFER_ARCHIVED: 'product.offre.archived',
  FEATURE_CREATED: 'product.feature.created',
  ENTITLEMENT_ATTACHED: 'product.entitlement.attached',
  PRICING_GRID_CREATED: 'product.grille_tarifaire.created',
  PRICING_GRID_PUBLISHED: 'product.grille_tarifaire.published',
  PRICING_GRID_ARCHIVED: 'product.grille_tarifaire.archived',
} as const;

export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[keyof typeof PRODUCT_EVENT_TYPES];
