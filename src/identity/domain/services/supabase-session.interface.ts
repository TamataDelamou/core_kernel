export const SUPABASE_SESSION_VERIFIER = Symbol('SUPABASE_SESSION_VERIFIER');

export interface VerifiedSupabaseIdentity {
  /** `sub` du jeton Supabase — UUID de l'utilisateur dans `auth.users` du projet appelant. */
  supabaseUserId: string;
  /**
   * `email`/`phone` du jeton Supabase (chaîne vide si non renseigné, jamais `undefined` —
   * conforme au schéma officiel des claims JWT Supabase). Il n'existe PAS de claim
   * `email_verified`/`phone_verified` distincte dans un jeton Supabase : la présence d'une
   * valeur non vide sur un jeton de rôle "authenticated" reflète déjà l'identifiant confirmé
   * porté par `auth.users` — c'est le signal de confiance utilisé pour la dédup (KER-ID-01).
   */
  email: string;
  phone: string;
}

/**
 * Port de vérification d'une session Supabase (KER-ID-02). GSG ID ne génère et ne vérifie
 * JAMAIS lui-même un code OTP : chaque produit authentifie ses utilisateurs nativement via
 * Supabase Auth (signInWithOtp/verifyOtp — SMS, WhatsApp/Twilio, Magic Link ou code OTP email,
 * voir le modèle d'authentification de référence). Ce port vérifie la SIGNATURE du jeton déjà
 * émis par Supabase Auth (via le JWKS du projet concerné) afin d'établir la correspondance
 * avec un profil GSG ID — jamais un accès direct à la base `auth.users` du produit.
 */
export interface SupabaseSessionVerifier {
  /**
   * @param supabaseProjectUrl URL de base du projet Supabase (ex. https://xxxx.supabase.co),
   *   OBLIGATOIREMENT présente dans la liste blanche `SUPABASE_ALLOWED_PROJECT_URLS` —
   *   l'implémentation doit refuser toute URL hors de cette liste (anti-SSRF).
   * @param accessToken Jeton d'accès Supabase présenté par le client, tel qu'obtenu après
   *   un `signInWithOtp`/`verifyOtp` réussi côté produit.
   */
  verify(supabaseProjectUrl: string, accessToken: string): Promise<VerifiedSupabaseIdentity>;
}
