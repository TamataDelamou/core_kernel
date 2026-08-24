import {
  MissingIdentifierError,
  User,
} from '../../../../src/identity/domain/entities/user.entity';
import { Email } from '../../../../src/common/value-objects/email.vo';
import { PhoneE164 } from '../../../../src/common/value-objects/phone-e164.vo';

const REFERENTIEL_VIDE = {
  paysId: null,
  uniteAdministrativeId: null,
  villeId: null,
  langueId: null,
  deviseId: null,
  fuseauHoraire: null,
};

describe('User.registerViaVerifiedExternalIdentity (pont KER-ID-02 — modèle Supabase natif)', () => {
  it('refuse la création sans email NI téléphone', () => {
    expect(() =>
      User.registerViaVerifiedExternalIdentity({
        gsgId: 'user-1',
        email: null,
        phone: null,
        nomAffichage: 'Test',
        referentiel: REFERENTIEL_VIDE,
      }),
    ).toThrow(MissingIdentifierError);
  });

  it('accepte un profil identifié uniquement par téléphone (cas WhatsApp-only)', () => {
    const user = User.registerViaVerifiedExternalIdentity({
      gsgId: 'user-1',
      email: null,
      phone: PhoneE164.create('+224620000000'),
      nomAffichage: 'Utilisateur WhatsApp',
      referentiel: REFERENTIEL_VIDE,
    });

    expect(user.email).toBeNull();
    expect(user.phone?.toString()).toBe('+224620000000');
    expect(user.passwordHash).toBeNull();
  });

  it('accepte un profil identifié uniquement par email', () => {
    const user = User.registerViaVerifiedExternalIdentity({
      gsgId: 'user-1',
      email: Email.create('user@example.com'),
      phone: null,
      nomAffichage: 'Utilisateur Email',
      referentiel: REFERENTIEL_VIDE,
    });

    expect(user.phone).toBeNull();
    expect(user.email?.toString()).toBe('user@example.com');
  });

  it('marque l\'identifiant fourni comme vérifié dès la création (confiance transférée depuis Supabase)', () => {
    const user = User.registerViaVerifiedExternalIdentity({
      gsgId: 'user-1',
      email: Email.create('user@example.com'),
      phone: PhoneE164.create('+224620000000'),
      nomAffichage: 'Test',
      referentiel: REFERENTIEL_VIDE,
    });

    expect(user.emailVerifie).toBe(true);
    expect(user.phoneVerifie).toBe(true);
  });

  it('un compte provisionné ainsi ne peut jamais s\'authentifier par mot de passe (passwordHash null)', () => {
    const user = User.registerViaVerifiedExternalIdentity({
      gsgId: 'user-1',
      email: Email.create('user@example.com'),
      phone: null,
      nomAffichage: 'Test',
      referentiel: REFERENTIEL_VIDE,
    });

    expect(user.passwordHash).toBeNull();
  });
});

describe('User — rattachement d\'un identifiant vérifié à un compte existant', () => {
  it('attachVerifiedEmail ajoute un email à un compte qui n\'en avait pas', () => {
    const user = User.registerViaVerifiedExternalIdentity({
      gsgId: 'user-1',
      email: null,
      phone: PhoneE164.create('+224620000000'),
      nomAffichage: 'Test',
      referentiel: REFERENTIEL_VIDE,
    });

    user.attachVerifiedEmail(Email.create('nouveau@example.com'));

    expect(user.email?.toString()).toBe('nouveau@example.com');
    expect(user.emailVerifie).toBe(true);
  });

  it('attachVerifiedEmail ne remplace jamais un email déjà présent', () => {
    const user = User.registerViaVerifiedExternalIdentity({
      gsgId: 'user-1',
      email: Email.create('original@example.com'),
      phone: null,
      nomAffichage: 'Test',
      referentiel: REFERENTIEL_VIDE,
    });

    user.attachVerifiedEmail(Email.create('autre@example.com'));

    expect(user.email?.toString()).toBe('original@example.com');
  });
});
