/**
 * Catalogue des événements publiés par GSG Referential. Toute modification du référentiel
 * structurel partagé étant soumise au workflow de publication (KER-AUD-04), les produits
 * consommateurs peuvent s'abonner à `*.publie` pour invalider leurs caches locaux d'AppConfig
 * dès qu'une donnée référentielle devient effectivement consommable.
 */
export const REFERENTIAL_EVENT_TYPES = {
  PAYS_CREATED: 'referential.pays.created',
  PAYS_PUBLISHED: 'referential.pays.published',
  PAYS_DEACTIVATED: 'referential.pays.deactivated',
  DEVISE_CREATED: 'referential.devise.created',
  DEVISE_PUBLISHED: 'referential.devise.published',
  LANGUE_CREATED: 'referential.langue.created',
  LANGUE_PUBLISHED: 'referential.langue.published',
  BLOC_REGIONAL_CREATED: 'referential.bloc_regional.created',
  BLOC_REGIONAL_PUBLISHED: 'referential.bloc_regional.published',
  PAYS_BLOC_REGIONAL_ADHESION: 'referential.pays_bloc_regional.adhesion',
  PAYS_BLOC_REGIONAL_RETRAIT: 'referential.pays_bloc_regional.retrait',
  TAUX_CHANGE_SET: 'referential.taux_change.set',
  VILLE_CREATED: 'referential.ville.created',
  VILLE_MOVED: 'referential.ville.moved',
  LOCALE_CREATED: 'referential.locale.created',
  LOCALE_PAR_DEFAUT_CHANGED: 'referential.locale.par_defaut_changed',
  TRADUCTION_CREATED: 'referential.traduction.created',
} as const;

export type ReferentialEventType =
  (typeof REFERENTIAL_EVENT_TYPES)[keyof typeof REFERENTIAL_EVENT_TYPES];
