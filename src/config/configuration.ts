export interface AppConfiguration {
  env: string;
  port: number;
  apiGlobalPrefix: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    accessSecret: string;
    accessTtlSeconds: number;
    refreshSecret: string;
    refreshTtlSeconds: number;
    issuer: string;
    audience: string;
  };
  mfa: {
    issuerName: string;
    totpWindow: number;
    encryptionKeyHex: string;
  };
  throttle: {
    ttlSeconds: number;
    limit: number;
  };
  eventBus: {
    streamPrefix: string;
  };
  outbox: {
    /** Intervalle entre deux cycles de relais outbox → Redis (ms). */
    pollIntervalMs: number;
    /** Nombre de lignes traitées par cycle. */
    batchSize: number;
    /** Tentatives avant bascule en échec permanent (statut "echec", visible en ops). */
    maxRetries: number;
  };
  audit: {
    /** Nom du groupe de consommateurs Redis Streams (KER-AUD, résilience de l'Event Bus). */
    consumerGroup: string;
    /** Nombre max de messages lus par appel XREADGROUP. */
    batchSize: number;
    /** Durée de blocage d'un appel XREADGROUP sans nouveau message (ms). */
    blockMs: number;
    /** Tentatives de livraison avant bascule en Dead-Letter Queue. */
    maxDeliveries: number;
    /** Durée d'inactivité (ms) au-delà de laquelle un message en attente est éligible à la réclamation (XCLAIM). */
    claimIdleMs: number;
    /** Intervalle entre deux cycles de réclamation des messages bloqués (ms). */
    claimIntervalMs: number;
  };
  referentialEngineVilles: {
    /** Nom du groupe de consommateurs Redis Streams dédié au compteur de villes rattachées (KER-ADM-04). */
    consumerGroup: string;
    batchSize: number;
    blockMs: number;
    /** Durée d'inactivité (ms) au-delà de laquelle un message en attente est réclamé (XCLAIM). */
    claimIdleMs: number;
    claimIntervalMs: number;
  };
  /**
   * KER-ID-02 : liste blanche des projets Supabase reconnus comme sources légitimes de
   * session (un par produit GSG utilisant Supabase Auth nativement — voir le modèle
   * d'authentification "Migration Firebase → Supabase"). Empêche toute attaque SSRF via
   * une URL de projet arbitraire fournie par l'appelant.
   */
  supabase: {
    allowedProjectUrls: string[];
    /**
     * Durée de vie du cache JWKS local avant rafraîchissement programmé (secondes).
     * Volontairement courte : un jeu de clés Supabase change rarement, mais un TTL long
     * retarderait la prise en compte d'une rotation de clé légitime.
     */
    jwksCacheTtlSeconds: number;
    /** Délai maximal accordé à un appel réseau vers le JWKS Supabase avant abandon (ms). */
    jwksFetchTimeoutMs: number;
    /**
     * Intervalle minimal entre deux rafraîchissements forcés (hors TTL normal), déclenchés
     * par un échec de vérification (kid inconnu ou signature invalide). Empêche un flot de
     * jetons invalides d'être utilisé comme vecteur pour marteler le JWKS Supabase.
     */
    jwksForcedRefreshCooldownSeconds: number;
  };
}

export default (): AppConfiguration => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  // 'api' seul, PAS 'api/v1' : app.enableVersioning() (main.ts) insère déjà un segment de
  // version entre le préfixe global et le contrôleur — l'ordre NestJS est toujours
  // {préfixe global}/{version}/{contrôleur}/{méthode}. Avec 'api/v1' ici ET la version '1'
  // ajoutée par enableVersioning, la route réelle devenait /api/v1/v1/... au lieu de
  // /api/v1/... — bug découvert au premier vrai passage de test:e2e (jamais visible dans les
  // tests mockés, qui n'exercent jamais le routage HTTP réel).
  apiGlobalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'gsg_id',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'gsg_id',
    ssl: process.env.DB_SSL === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessTtlSeconds: parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? '900', 10),
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshTtlSeconds: parseInt(process.env.JWT_REFRESH_TTL_SECONDS ?? '2592000', 10),
    issuer: process.env.JWT_ISSUER ?? 'https://id.gsg.africa',
    audience: process.env.JWT_AUDIENCE ?? 'gsg-platform',
  },
  mfa: {
    issuerName: process.env.MFA_ISSUER_NAME ?? 'GSG ID',
    totpWindow: parseInt(process.env.MFA_TOTP_WINDOW ?? '1', 10),
    encryptionKeyHex: process.env.MFA_ENCRYPTION_KEY_HEX as string,
  },
  throttle: {
    ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '20', 10),
  },
  eventBus: {
    // Renommé depuis "gsg.identity" (v3.x) : ce flux est désormais partagé par les 4 modules
    // du noyau (identity, referential, org, product), plus l'Outbox Relay qui y publie pour
    // le compte de tous — le nom par défaut reflète maintenant cet usage transverse.
    streamPrefix: process.env.EVENT_BUS_STREAM_PREFIX ?? 'gsg.kernel.events',
  },
  outbox: {
    pollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS ?? '1000', 10),
    batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE ?? '50', 10),
    maxRetries: parseInt(process.env.OUTBOX_MAX_RETRIES ?? '10', 10),
  },
  audit: {
    consumerGroup: process.env.AUDIT_CONSUMER_GROUP ?? 'audit-consumers',
    batchSize: parseInt(process.env.AUDIT_CONSUMER_BATCH_SIZE ?? '10', 10),
    blockMs: parseInt(process.env.AUDIT_CONSUMER_BLOCK_MS ?? '5000', 10),
    maxDeliveries: parseInt(process.env.AUDIT_CONSUMER_MAX_DELIVERIES ?? '5', 10),
    claimIdleMs: parseInt(process.env.AUDIT_CONSUMER_CLAIM_IDLE_MS ?? '30000', 10),
    claimIntervalMs: parseInt(process.env.AUDIT_CONSUMER_CLAIM_INTERVAL_MS ?? '15000', 10),
  },
  referentialEngineVilles: {
    consumerGroup: process.env.REF_ENGINE_VILLES_CONSUMER_GROUP ?? 'referential-engine-villes-consumers',
    batchSize: parseInt(process.env.REF_ENGINE_VILLES_CONSUMER_BATCH_SIZE ?? '20', 10),
    blockMs: parseInt(process.env.REF_ENGINE_VILLES_CONSUMER_BLOCK_MS ?? '5000', 10),
    claimIdleMs: parseInt(process.env.REF_ENGINE_VILLES_CONSUMER_CLAIM_IDLE_MS ?? '30000', 10),
    claimIntervalMs: parseInt(process.env.REF_ENGINE_VILLES_CONSUMER_CLAIM_INTERVAL_MS ?? '15000', 10),
  },
  supabase: {
    allowedProjectUrls: (process.env.SUPABASE_ALLOWED_PROJECT_URLS ?? '')
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
    jwksCacheTtlSeconds: parseInt(process.env.SUPABASE_JWKS_CACHE_TTL_SECONDS ?? '300', 10),
    jwksFetchTimeoutMs: parseInt(process.env.SUPABASE_JWKS_FETCH_TIMEOUT_MS ?? '4000', 10),
    jwksForcedRefreshCooldownSeconds: parseInt(
      process.env.SUPABASE_JWKS_FORCED_REFRESH_COOLDOWN_SECONDS ?? '10',
      10,
    ),
  },
});
