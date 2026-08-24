export const PRODUCT_LOOKUP_PORT = Symbol('PRODUCT_LOOKUP_PORT');

/**
 * Port transverse consommé par toute brique référençant un `produitId` du portefeuille GSG
 * (KER-PROD-01 : "toute mention du portefeuille... s'y réfère plutôt que de répéter une liste
 * en texte libre"). Ferme l'intégrité référentielle inter-modules : `Catalogue` (Product
 * Catalog) et `AbonnementProduit` (Org Registry) vérifient tous deux qu'un `produitId` fourni
 * référence réellement une ligne active du registre central — jamais un UUID libre non vérifié
 * — sans dépendre du schéma de persistance du registre (KER-VIS-03).
 */
export interface ProductLookupPort {
  existsAndActive(produitId: string): Promise<boolean>;
}
