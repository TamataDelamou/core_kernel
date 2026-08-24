export const CURRENCY_VALIDATION_PORT = Symbol('CURRENCY_VALIDATION_PORT');

/**
 * Port transverse permettant à toute brique du noyau de vérifier qu'une devise est
 * "certifiée" — c'est-à-dire publiée (workflow KER-AUD-04 au statut `publie`) et active
 * dans GSG Referential — sans dépendre de son schéma de persistance (KER-VIS-03).
 *
 * GSG Product Catalog l'utilise pour interdire, de façon absolue, l'application d'un prix
 * dans une devise non certifiée (KER-PRD) : une grille tarifaire ne peut jamais référencer
 * un `devise_id` qui n'a pas encore franchi le workflow de publication du référentiel.
 */
export interface CurrencyValidationPort {
  isCertified(deviseId: string): Promise<boolean>;
}
