/**
 * Catalogue exhaustif des types d'événements publiés par GSG ID sur le bus inter-produits.
 * Chaque produit consommateur (KER-EVT-02) peut s'abonner librement à un sous-ensemble.
 * Le format de charge utile est stabilisé par ce fichier — toute évolution incompatible
 * nécessite une nouvelle version d'événement, jamais une modification silencieuse (KER-ARC-02).
 */
export const IDENTITY_EVENT_TYPES = {
  USER_REGISTERED: 'identity.user.registered',
  USER_AUTHENTICATED: 'identity.user.authenticated',
  USER_AUTHENTICATION_FAILED: 'identity.user.authentication_failed',
  USER_LOCKED: 'identity.user.locked',
  USER_SUSPENDED: 'identity.user.suspended',
  USER_REACTIVATED: 'identity.user.reactivated',
  MFA_ENABLED: 'identity.mfa.enabled',
  MFA_DISABLED: 'identity.mfa.disabled',
  EXTERNAL_IDENTITY_LINKED: 'identity.external_identity.linked',
  ROLE_ASSIGNED: 'identity.role.assigned',
  ROLE_REVOKED: 'identity.role.revoked',
  REFERENTIEL_UPDATED: 'identity.referentiel.updated',
  SUPABASE_SESSION_EXCHANGED: 'identity.supabase_session.exchanged',
} as const;

export type IdentityEventType = (typeof IDENTITY_EVENT_TYPES)[keyof typeof IDENTITY_EVENT_TYPES];
