export const REFERENTIAL_ENGINE_LOOKUP_PORT = Symbol('REFERENTIAL_ENGINE_LOOKUP_PORT');

/**
 * Port transverse consommé par GSG Referential pour valider qu'un `referentiel_hierarchique_id`
 * fourni sur une `Ville` (KER-ADM-03) référence réellement un nœud existant et publié du
 * Referential Engine — sans jamais dépendre de son schéma de persistance (KER-VIS-03 : accès
 * inter-services exclusivement par API/contrat, jamais par base partagée ni clé étrangère
 * physique). Implémenté par `referential-engine`, consommé par `referential`.
 */
export interface ReferentialEngineLookupPort {
  existsAndPublished(noeudId: string): Promise<boolean>;
}
