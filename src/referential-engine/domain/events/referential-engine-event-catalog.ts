/**
 * Noms d'événements alignés sur la directive d'implémentation ("Catalogue d'Événements").
 * Alimentent directement Redis Streams et, via le module Audit déjà bâti, le journal
 * d'audit centralisé — sans câblage supplémentaire nécessaire (ProcessStreamEventUseCase
 * consomme déjà tout le flux partagé, quel que soit le module producteur).
 */
export const REFERENTIAL_ENGINE_EVENT_TYPES = {
  NIVEAU_ADMINISTRATIF_CREATED: 'referential_engine.niveau_administratif.created',
  ADMINISTRATIVE_HIERARCHY_NODE_CREATED: 'referential_engine.AdministrativeHierarchyNodeCreated',
  ADMINISTRATIVE_NODE_PUBLISHED: 'referential_engine.AdministrativeNodePublished',
  ADMINISTRATIVE_NODE_DEACTIVATED: 'referential_engine.administrative_node.deactivated',
  BRANCH_REATTACHED: 'referential_engine.BranchReattached',
  REFERENTIEL_REGLE_CREATED: 'referential_engine.referentiel_regle.created',
  REFERENTIEL_REGLE_PUBLISHED: 'referential_engine.referentiel_regle.published',
  CORPUS_VERSIONNE_CREATED: 'referential_engine.corpus_versionne.created',
  CORPUS_VERSIONNE_PUBLISHED: 'referential_engine.corpus_versionne.published',
  CORPUS_VERSIONNE_ARCHIVED: 'referential_engine.corpus_versionne.archived',
  CORPUS_ELEMENT_CREATED: 'referential_engine.corpus_element.created',
} as const;

export type ReferentialEngineEventType =
  (typeof REFERENTIAL_ENGINE_EVENT_TYPES)[keyof typeof REFERENTIAL_ENGINE_EVENT_TYPES];
