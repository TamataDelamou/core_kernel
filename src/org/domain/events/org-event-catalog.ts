export const ORG_EVENT_TYPES = {
  ORGANISATION_CREATED: 'org.organisation.created',
  ORGANISATION_DEACTIVATED: 'org.organisation.deactivated',
  ORGANISATION_REATTACHED: 'org.organisation.reattached',
  ORGANISATION_REFERENTIEL_UPDATED: 'org.organisation.referentiel_updated',
  UNITE_OPERATIONNELLE_CREATED: 'org.unite_operationnelle.created',
  ABONNEMENT_CREATED: 'org.abonnement.created',
  ABONNEMENT_SUSPENDED: 'org.abonnement.suspended',
  ABONNEMENT_REACTIVATED: 'org.abonnement.reactivated',
  ABONNEMENT_RESILIATED: 'org.abonnement.resiliated',
} as const;

export type OrgEventType = (typeof ORG_EVENT_TYPES)[keyof typeof ORG_EVENT_TYPES];
