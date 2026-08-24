import { ReferentielNiveau } from './user-referential-lookup.port';

export const ORGANISATION_REFERENTIAL_LOOKUP_PORT = Symbol('ORGANISATION_REFERENTIAL_LOOKUP_PORT');

/**
 * Port transverse consommé par app-config pour les niveaux "Organisation" et "Agence/Unité"
 * de la chaîne d'héritage (KER-INH-01, KER-ORG-04). Implémenté par Org Registry.
 */
export interface OrganisationReferentialLookupPort {
  getOrganisationReferentiel(gsgOrgId: string): Promise<ReferentielNiveau | null>;
  /**
   * Renvoie `null` si l'unité n'existe pas OU n'appartient pas à `gsgOrgId` — l'appelant ne
   * doit jamais pouvoir résoudre une configuration à partir d'une agence d'une autre
   * organisation via un identifiant deviné.
   */
  getUniteOperationnelleReferentiel(
    uniteOperationnelleId: string,
    gsgOrgId: string,
  ): Promise<ReferentielNiveau | null>;
}
