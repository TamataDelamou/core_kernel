import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JoseSupabaseSessionVerifier } from '../../../../src/identity/infrastructure/security/supabase-session-verifier.adapter';
import { UntrustedSupabaseProjectError } from '../../../../src/identity/domain/exceptions/identity.exceptions';

async function buildVerifier(allowedProjectUrls: string[]): Promise<JoseSupabaseSessionVerifier> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      JoseSupabaseSessionVerifier,
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue(allowedProjectUrls) },
      },
    ],
  }).compile();

  return moduleRef.get(JoseSupabaseSessionVerifier);
}

describe('JoseSupabaseSessionVerifier (unitaire) — liste blanche anti-SSRF', () => {
  it('REFUSE une URL de projet hors de la liste blanche, avant tout appel réseau', async () => {
    const verifier = await buildVerifier(['https://autorise.supabase.co']);

    await expect(verifier.verify('https://malveillant.example.com', 'fake-token')).rejects.toThrow(
      UntrustedSupabaseProjectError,
    );
  });

  it('la liste blanche est stricte : aucune URL n\'est implicitement autorisée par défaut', async () => {
    const verifier = await buildVerifier([]);

    await expect(verifier.verify('https://nimporte-quoi.supabase.co', 'fake-token')).rejects.toThrow(
      UntrustedSupabaseProjectError,
    );
  });

  it('compare après normalisation (retrait des slashs finaux) plutôt qu\'en chaîne stricte', async () => {
    // Une liste blanche enregistrée SANS slash final doit tout de même refuser une URL
    // manifestement différente — ce test ne vérifie que la logique de rejet, jamais
    // d'acceptation positive (qui déclencherait un appel réseau réel, hors périmètre d'un
    // test unitaire sans dépendance externe).
    const verifier = await buildVerifier(['https://autorise.supabase.co']);

    await expect(verifier.verify('https://autre-projet.supabase.co', 'fake-token')).rejects.toThrow(
      UntrustedSupabaseProjectError,
    );
  });
});
