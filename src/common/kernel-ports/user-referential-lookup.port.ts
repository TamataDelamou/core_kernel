export const USER_REFERENTIAL_LOOKUP_PORT = Symbol('USER_REFERENTIAL_LOOKUP_PORT');

export interface ReferentielNiveau {
  paysId: string | null;
  deviseId: string | null;
  langueId: string | null;
  fuseauHoraire: string | null;
}

/**
 * Port transverse consommé par app-config pour le niveau "Utilisateur" de la chaîne
 * d'héritage (KER-INH-01). Implémenté par GSG ID, jamais consommé directement — même
 * discipline que les autres ports du noyau (KER-VIS-03).
 */
export interface UserReferentialLookupPort {
  getReferentiel(gsgId: string): Promise<ReferentielNiveau | null>;
}
