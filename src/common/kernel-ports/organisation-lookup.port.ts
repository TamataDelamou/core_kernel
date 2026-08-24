export const ORGANISATION_LOOKUP_PORT = Symbol('ORGANISATION_LOOKUP_PORT');

/**
 * Port transverse permettant à toute brique du noyau de vérifier l'existence et l'état
 * d'une organisation sans dépendre directement du schéma de persistance d'Org Registry
 * (KER-VIS-03 : accès inter-services exclusivement par API/contrat, jamais par base
 * partagée). GSG ID l'utilise pour fermer le contrôle de portée (scope) des rôles
 * organisationnels introduits par KER-ORG-03 : un rôle scopé à un `gsg_org_id` qui
 * n'existe pas, ou qui correspond à une organisation désactivée, ne doit jamais être
 * attribuable silencieusement.
 */
export interface OrganisationLookupPort {
  existsAndActive(gsgOrgId: string): Promise<boolean>;
  isSubscribedToProduit(gsgOrgId: string, produitId: string): Promise<boolean>;
  /**
   * Vrai si `organisationId` est l'organisation `ancestorOrganisationId` elle-même, OU
   * une filiale (directe ou indirecte) de celle-ci. GSG Product Catalog l'utilise pour
   * fermer le contrôle de portée des catalogues scopés à une organisation (KER-PRD) : un
   * catalogue défini au niveau d'une maison mère doit rester accessible à ses filiales,
   * jamais l'inverse.
   */
  isDescendantOrSelf(organisationId: string, ancestorOrganisationId: string): Promise<boolean>;
}
