export const REFERENTIAL_DEFAULTS_LOOKUP_PORT = Symbol('REFERENTIAL_DEFAULTS_LOOKUP_PORT');

export interface PaysDefaults {
  codeIso: string;
  /** Devise principale du pays (pays_devise.devise_principale = true) — KER-REF-03. */
  deviseIdPrincipale: string | null;
  /** Langue la mieux classée pour ce pays (statut officielle en priorité, puis ordre) — KER-REF-06. */
  langueIdPrincipale: string | null;
  fuseauHoraire: string | null;
  adresseGabarit: string | null;
}

export interface CodesEnrichis {
  paysCode: string | null;
  deviseCode: string | null;
  langueCode: string | null;
}

/**
 * Port transverse consommé par app-config pour le niveau "Pays" de la chaîne d'héritage
 * (KER-INH-01) et pour transformer les identifiants résolus en codes lisibles (ISO 3166-1,
 * ISO 4217, ISO 639) dans la réponse AppConfig finale. Implémenté par GSG Referential.
 */
export interface ReferentialDefaultsLookupPort {
  getPaysDefaults(paysId: string): Promise<PaysDefaults | null>;
  enrichCodes(params: {
    paysId: string | null;
    deviseId: string | null;
    langueId: string | null;
  }): Promise<CodesEnrichis>;
  /**
   * KER-NOM-04 : résout une locale CERTIFIÉE (table `locale`, jamais une dérivation à la
   * volée) — d'abord la combinaison exacte langue+pays, puis la langue seule, puis la
   * locale par défaut du noyau. `null` uniquement si aucune locale n'a jamais été
   * configurée nulle part (cas du tout premier démarrage, avant toute action d'un admin).
   */
  resolveLocale(langueCode: string | null, paysCode: string | null): Promise<string | null>;
}
