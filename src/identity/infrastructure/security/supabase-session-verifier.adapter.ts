import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeProtectedHeader, importJWK, jwtVerify, JWK, JWTPayload, KeyLike } from 'jose';
import {
  SupabaseSessionVerifier,
  VerifiedSupabaseIdentity,
} from '../../domain/services/supabase-session.interface';
import {
  InvalidSupabaseSessionError,
  UntrustedSupabaseProjectError,
} from '../../domain/exceptions/identity.exceptions';
import { AppConfiguration } from '../../../config/configuration';

interface SupabaseJwtPayload extends JWTPayload {
  role?: string;
  email?: string;
  phone?: string;
}

interface CachedJwks {
  keys: JWK[];
  fetchedAtMs: number;
}

/**
 * Implémentation concrète de SupabaseSessionVerifier, avec un cache JWKS local explicite
 * (jamais le cache opaque interne de `jose` seul) pour garantir trois propriétés de
 * résilience critiques :
 *
 *  1. **TTL court + single-flight** : le jeu de clés est réutilisé pendant
 *     `jwksCacheTtlSeconds`, et un seul appel réseau est déclenché même si plusieurs
 *     vérifications concurrentes expirent le cache au même instant (déduplication via
 *     `inFlight`) — sans quoi un pic de trafic après expiration du TTL déclencherait autant
 *     d'appels sortants vers Supabase que de requêtes entrantes simultanées.
 *  2. **Repli sur clés périmées** : si le rafraîchissement échoue (timeout, panne réseau,
 *     ralentissement du point de terminaison JWKS Supabase), le dernier jeu de clés connu
 *     est réutilisé plutôt que de faire échouer l'authentification — un ralentissement de
 *     Supabase ne doit jamais se traduire par une panne immédiate de toute la plateforme
 *     GSG ID. Seul le tout premier appel pour un projet, s'il échoue avant qu'aucun jeu de
 *     clés n'ait jamais été mis en cache, ne peut bénéficier de ce repli.
 *  3. **Rafraîchissement forcé, rate-limité, sur échec de vérification** : un `kid` inconnu
 *     ou une signature invalide déclenche UN rafraîchissement immédiat hors TTL (rotation de
 *     clé légitime côté Supabase), mais jamais plus d'une fois par
 *     `jwksForcedRefreshCooldownSeconds` — sans ce plafond, un flot de jetons forgés
 *     deviendrait un vecteur pour marteler le JWKS Supabase à chaque tentative.
 *
 * Deux garde-fous stricts avant tout appel réseau, inchangés :
 *   - `supabaseProjectUrl` doit figurer dans SUPABASE_ALLOWED_PROJECT_URLS (anti-SSRF).
 *   - Le jeton vérifié doit porter `role: "authenticated"`.
 */
@Injectable()
export class JoseSupabaseSessionVerifier implements SupabaseSessionVerifier {
  private readonly logger = new Logger(JoseSupabaseSessionVerifier.name);

  /** Cache local des jeux de clés JWKS, un par projet Supabase autorisé. */
  private readonly cache = new Map<string, CachedJwks>();
  /** Déduplication des rafraîchissements concurrents (single-flight), par projet. */
  private readonly inFlight = new Map<string, Promise<CachedJwks>>();
  /** Horodatage du dernier rafraîchissement FORCÉ (hors TTL) par projet — anti-martèlement. */
  private readonly lastForcedRefreshAtMs = new Map<string, number>();

  constructor(private readonly configService: ConfigService<AppConfiguration>) {}

  async verify(supabaseProjectUrl: string, accessToken: string): Promise<VerifiedSupabaseIdentity> {
    const urlNormalisee = this.normalizeUrl(supabaseProjectUrl);
    this.assertProjectIsAllowed(urlNormalisee);

    let payload: SupabaseJwtPayload | null;
    try {
      payload = await this.verifyAgainstCacheWithForcedRefresh(urlNormalisee, accessToken);
    } catch (error) {
      if (error instanceof UntrustedSupabaseProjectError) throw error;
      // OWASP : jamais de détail exposé à l'appelant (timeout réseau, JSON malformé, jeton
      // structurellement invalide...) — message générique unique, la cause précise reste
      // dans les logs serveur (voir getKeys/doFetch pour les warnings de dégradation).
      throw new InvalidSupabaseSessionError();
    }

    if (!payload || payload.role !== 'authenticated' || typeof payload.sub !== 'string') {
      throw new InvalidSupabaseSessionError();
    }

    return {
      supabaseUserId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
      phone: typeof payload.phone === 'string' ? payload.phone : '',
    };
  }

  private async verifyAgainstCacheWithForcedRefresh(
    urlNormalisee: string,
    accessToken: string,
  ): Promise<SupabaseJwtPayload | null> {
    let header: { kid?: string; alg: string };
    try {
      header = decodeProtectedHeader(accessToken) as { kid?: string; alg: string };
    } catch {
      return null; // jeton structurellement invalide — inutile d'aller consulter le JWKS
    }

    const cached = await this.getKeys(urlNormalisee);
    const premierEssai = await this.tryVerifyWithKeys(accessToken, cached.keys, header, urlNormalisee);
    if (premierEssai) return premierEssai;

    // Kid inconnu ou signature invalide avec le jeu de clés en cache : tente un
    // rafraîchissement forcé (rate-limité) pour couvrir une rotation de clé légitime côté
    // Supabase, puis un seul nouvel essai — jamais de boucle.
    const refreshed = await this.forceRefreshIfAllowed(urlNormalisee);
    if (!refreshed) return null;

    return this.tryVerifyWithKeys(accessToken, refreshed.keys, header, urlNormalisee);
  }

  private async tryVerifyWithKeys(
    accessToken: string,
    keys: JWK[],
    header: { kid?: string; alg: string },
    urlNormalisee: string,
  ): Promise<SupabaseJwtPayload | null> {
    const candidats = header.kid ? keys.filter((k) => k.kid === header.kid) : keys;

    for (const jwk of candidats) {
      const alg = jwk.alg ?? header.alg;
      try {
        const keyLike = (await importJWK(jwk, alg)) as KeyLike;
        const { payload } = await jwtVerify(accessToken, keyLike, {
          issuer: `${urlNormalisee}/auth/v1`,
          algorithms: [alg],
        });
        return payload as SupabaseJwtPayload;
      } catch {
        continue; // cette clé ne convient pas — on tente la suivante avant d'abandonner
      }
    }
    return null;
  }

  /**
   * Renvoie le jeu de clés en cache s'il est encore valide (TTL non expiré). Sinon,
   * déclenche un rafraîchissement (dédupliqué en single-flight) et retombe sur le jeu de
   * clés PÉRIMÉ en cas d'échec — voir la docstring de la classe, point 2.
   */
  private async getKeys(urlNormalisee: string): Promise<CachedJwks> {
    const ttlMs = (this.configService.get('supabase.jwksCacheTtlSeconds', { infer: true }) as number) * 1000;
    const existant = this.cache.get(urlNormalisee);

    if (existant && Date.now() - existant.fetchedAtMs < ttlMs) {
      return existant;
    }

    try {
      return await this.fetchAndCache(urlNormalisee);
    } catch (error) {
      if (existant) {
        this.logger.warn(
          `Rafraîchissement JWKS échoué pour ${urlNormalisee} — utilisation du jeu de clés en ` +
            `cache, périmé depuis ${Math.round((Date.now() - existant.fetchedAtMs) / 1000)}s. ` +
            `Cause : ${error instanceof Error ? error.message : String(error)}`,
        );
        return existant;
      }
      throw error; // premier appel jamais réussi pour ce projet : aucun repli possible
    }
  }

  /** Rafraîchissement forcé (ignore le TTL), rate-limité par jwksForcedRefreshCooldownSeconds. */
  private async forceRefreshIfAllowed(urlNormalisee: string): Promise<CachedJwks | null> {
    const cooldownMs =
      (this.configService.get('supabase.jwksForcedRefreshCooldownSeconds', {
        infer: true,
      }) as number) * 1000;
    const dernierForcage = this.lastForcedRefreshAtMs.get(urlNormalisee) ?? 0;

    if (Date.now() - dernierForcage < cooldownMs) {
      // Rafraîchissement forcé trop récent : très probablement un jeton réellement invalide,
      // pas une rotation de clé qui viendrait juste de se produire une seconde fois.
      return null;
    }

    this.lastForcedRefreshAtMs.set(urlNormalisee, Date.now());
    try {
      return await this.fetchAndCache(urlNormalisee);
    } catch (error) {
      this.logger.warn(
        `Rafraîchissement JWKS forcé échoué pour ${urlNormalisee} : ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Appel réseau effectif (avec timeout), dédupliqué entre appels concurrents (single-flight). */
  private fetchAndCache(urlNormalisee: string): Promise<CachedJwks> {
    const enCours = this.inFlight.get(urlNormalisee);
    if (enCours) return enCours;

    const promesse = this.doFetch(urlNormalisee)
      .then((keys) => {
        const entry: CachedJwks = { keys, fetchedAtMs: Date.now() };
        this.cache.set(urlNormalisee, entry);
        return entry;
      })
      .finally(() => {
        this.inFlight.delete(urlNormalisee);
      });

    this.inFlight.set(urlNormalisee, promesse);
    return promesse;
  }

  private async doFetch(urlNormalisee: string): Promise<JWK[]> {
    const timeoutMs = this.configService.get('supabase.jwksFetchTimeoutMs', { infer: true }) as number;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${urlNormalisee}/auth/v1/jwks`, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`JWKS Supabase a répondu ${response.status} pour ${urlNormalisee}.`);
      }
      const body = (await response.json()) as { keys?: JWK[] };
      if (!Array.isArray(body.keys)) {
        throw new Error(`Réponse JWKS Supabase inattendue pour ${urlNormalisee} (champ "keys" absent).`);
      }
      return body.keys;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
  }

  private assertProjectIsAllowed(urlNormalisee: string): void {
    const listeBlanche = (
      this.configService.get('supabase.allowedProjectUrls', { infer: true }) as string[]
    ).map((u) => this.normalizeUrl(u));

    if (!listeBlanche.includes(urlNormalisee)) {
      throw new UntrustedSupabaseProjectError(urlNormalisee);
    }
  }
}
