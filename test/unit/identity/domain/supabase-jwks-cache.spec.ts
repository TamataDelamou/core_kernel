import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { JoseSupabaseSessionVerifier } from '../../../../src/identity/infrastructure/security/supabase-session-verifier.adapter';

const PROJECT_URL = 'https://autorise.supabase.co';

/** Config minimale mais complète — évite les faux positifs "NaN de multiplication silencieuse". */
function buildConfigServiceMock(overrides: Partial<Record<string, unknown>> = {}) {
  const values: Record<string, unknown> = {
    'supabase.allowedProjectUrls': [PROJECT_URL],
    'supabase.jwksCacheTtlSeconds': 300,
    'supabase.jwksFetchTimeoutMs': 4000,
    'supabase.jwksForcedRefreshCooldownSeconds': 10,
    ...overrides,
  };
  return { get: jest.fn((key: string) => values[key]) };
}

async function buildVerifier(configOverrides: Partial<Record<string, unknown>> = {}) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      JoseSupabaseSessionVerifier,
      { provide: ConfigService, useValue: buildConfigServiceMock(configOverrides) },
    ],
  }).compile();
  return moduleRef.get(JoseSupabaseSessionVerifier);
}

/** Génère une paire de clés + un jeton signé + le JWKS correspondant, pour simuler Supabase. */
async function buildSignedFixture(kid: string, overridePayload: Record<string, unknown> = {}) {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = kid;
  publicJwk.alg = 'ES256';
  publicJwk.use = 'sig';

  const token = await new SignJWT({ role: 'authenticated', email: 'user@example.com', ...overridePayload })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setIssuer(`${PROJECT_URL}/auth/v1`)
    .setSubject('11111111-1111-1111-1111-111111111111')
    .setExpirationTime('1h')
    .sign(privateKey);

  return { token, jwks: { keys: [publicJwk] } };
}

/** Configure global.fetch pour répondre avec ce corps JWKS à CHAQUE appel tant qu'actif. */
function mockFetchWith(jwksBody: unknown, ok = true, status = 200): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => jwksBody,
  });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('JoseSupabaseSessionVerifier — cache JWKS local (TTL court, single-flight, repli)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('vérifie un jeton valide et n\'appelle le réseau qu\'une seule fois', async () => {
    const { token, jwks } = await buildSignedFixture('kid-1');
    const fetchMock = mockFetchWith(jwks);
    const verifier = await buildVerifier();

    const identity = await verifier.verify(PROJECT_URL, token);

    expect(identity.supabaseUserId).toBe('11111111-1111-1111-1111-111111111111');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('réutilise le cache pour les appels suivants tant que le TTL n\'est pas expiré (pas de second appel réseau)', async () => {
    const { token, jwks } = await buildSignedFixture('kid-1');
    const fetchMock = mockFetchWith(jwks);
    const verifier = await buildVerifier({ 'supabase.jwksCacheTtlSeconds': 300 });

    await verifier.verify(PROJECT_URL, token);
    await verifier.verify(PROJECT_URL, token);
    await verifier.verify(PROJECT_URL, token);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('single-flight : plusieurs vérifications concurrentes sur cache froid ne déclenchent qu\'un seul appel réseau', async () => {
    const { token, jwks } = await buildSignedFixture('kid-1');
    const fetchMock = mockFetchWith(jwks);
    const verifier = await buildVerifier();

    await Promise.all([
      verifier.verify(PROJECT_URL, token),
      verifier.verify(PROJECT_URL, token),
      verifier.verify(PROJECT_URL, token),
      verifier.verify(PROJECT_URL, token),
      verifier.verify(PROJECT_URL, token),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retombe sur le jeu de clés périmé si le rafraîchissement échoue (ne bloque jamais l\'authentification)', async () => {
    const { token, jwks } = await buildSignedFixture('kid-1');
    const verifier = await buildVerifier({ 'supabase.jwksCacheTtlSeconds': 0 }); // TTL nul = toujours expiré

    // Premier appel : réseau disponible, le cache se peuple.
    mockFetchWith(jwks);
    await verifier.verify(PROJECT_URL, token);

    // Deuxième appel : le réseau tombe en panne — doit retomber sur le cache existant plutôt
    // que d'échouer, malgré un TTL nul (donc "périmé" dès l'instant où il a été posé).
    (global as unknown as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const identity = await verifier.verify(PROJECT_URL, token);
    expect(identity.supabaseUserId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('rafraîchit à la volée si le kid du jeton ne correspond à aucune clé en cache (rotation légitime)', async () => {
    const ancien = await buildSignedFixture('kid-ancien');
    const nouveau = await buildSignedFixture('kid-nouveau');

    const verifier = await buildVerifier();

    // Cache initial peuplé avec l'ANCIEN jeu de clés uniquement.
    mockFetchWith(ancien.jwks);
    await verifier.verify(PROJECT_URL, ancien.token);

    // Supabase a fait tourner sa clé : le jeton présenté porte maintenant "kid-nouveau",
    // absent du cache local. Le prochain fetch (rafraîchissement forcé) doit renvoyer le
    // NOUVEAU jeu de clés pour que la vérification aboutisse malgré le cache périmé.
    const fetchMock = mockFetchWith(nouveau.jwks);

    const identity = await verifier.verify(PROJECT_URL, nouveau.token);
    expect(identity.supabaseUserId).toBe('11111111-1111-1111-1111-111111111111');
    expect(fetchMock).toHaveBeenCalledTimes(1); // un seul rafraîchissement forcé, pas de boucle
  });

  it('ne force PAS de second rafraîchissement avant le cooldown, même sur échec répété', async () => {
    const { jwks } = await buildSignedFixture('kid-connu');
    const jetonInconnu = await buildSignedFixture('kid-jamais-vu-1');
    const autreJetonInconnu = await buildSignedFixture('kid-jamais-vu-2');

    const verifier = await buildVerifier({ 'supabase.jwksForcedRefreshCooldownSeconds': 9999 });

    const fetchMock = mockFetchWith(jwks);
    // Premier jeton invalide : déclenche le premier (et unique, vu le cooldown) rafraîchissement forcé.
    await expect(verifier.verify(PROJECT_URL, jetonInconnu.token)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 fetch initial (TTL) + 1 forcé (kid inconnu)

    // Deuxième jeton invalide, immédiatement après : le cooldown doit empêcher un 3e appel réseau.
    await expect(verifier.verify(PROJECT_URL, autreJetonInconnu.token)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
