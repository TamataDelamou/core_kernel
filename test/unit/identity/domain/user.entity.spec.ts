import { User, UserAccountLockedError, UserAccountInactiveError } from '../../../../src/identity/domain/entities/user.entity';
import { Email } from '../../../../src/common/value-objects/email.vo';

function buildUser(): User {
  return User.register({
    gsgId: 'user-1',
    email: Email.create('test@example.com'),
    phone: null,
    passwordHash: 'argon2-hash-placeholder',
    nomAffichage: 'Test User',
    referentiel: {
      paysId: null,
      uniteAdministrativeId: null,
      villeId: null,
      langueId: null,
      deviseId: null,
      fuseauHoraire: null,
    },
  });
}

describe('User (domaine GSG ID)', () => {
  describe('registration', () => {
    it('initialise un compte actif, sans MFA, sans échec préalable', () => {
      const user = buildUser();
      const snapshot = user.toSnapshot();

      expect(snapshot.statut).toBe('actif');
      expect(snapshot.mfaActive).toBe(false);
      expect(snapshot.tentativesEchoueesConsecutives).toBe(0);
      expect(snapshot.verrouilleJusqua).toBeNull();
    });
  });

  describe('verrouillage anti-brute-force (OWASP ASVS 2.2.1)', () => {
    it('ne verrouille pas le compte avant le 5e échec', () => {
      const user = buildUser();
      for (let i = 0; i < 4; i++) {
        user.registerFailedAuthentication();
      }
      expect(user.verrouilleJusqua).toBeNull();
      expect(() => user.assertCanAuthenticate()).not.toThrow();
    });

    it('verrouille le compte exactement au 5e échec consécutif', () => {
      const user = buildUser();
      for (let i = 0; i < 5; i++) {
        user.registerFailedAuthentication();
      }
      expect(user.verrouilleJusqua).not.toBeNull();
      expect(() => user.assertCanAuthenticate()).toThrow(UserAccountLockedError);
    });

    it('refuse toute authentification pendant la fenêtre de verrouillage', () => {
      const user = buildUser();
      for (let i = 0; i < 5; i++) user.registerFailedAuthentication();

      const pendantVerrouillage = new Date(user.verrouilleJusqua!.getTime() - 1000);
      expect(() => user.assertCanAuthenticate(pendantVerrouillage)).toThrow(UserAccountLockedError);
    });

    it('autorise à nouveau une fois la fenêtre de verrouillage expirée', () => {
      const user = buildUser();
      for (let i = 0; i < 5; i++) user.registerFailedAuthentication();

      const apresVerrouillage = new Date(user.verrouilleJusqua!.getTime() + 1000);
      expect(() => user.assertCanAuthenticate(apresVerrouillage)).not.toThrow();
    });

    it('réinitialise le compteur d\'échecs après une authentification réussie', () => {
      const user = buildUser();
      user.registerFailedAuthentication();
      user.registerFailedAuthentication();
      user.registerSuccessfulAuthentication();

      expect(user.tentativesEchoueesConsecutives).toBe(0);
      expect(user.verrouilleJusqua).toBeNull();
    });

    it('ne cumule jamais les échecs au-delà du seuil après un nouveau verrouillage', () => {
      const user = buildUser();
      for (let i = 0; i < 5; i++) user.registerFailedAuthentication();
      const premierVerrouillage = user.verrouilleJusqua!;

      // Un nouvel échec pendant la fenêtre de verrouillage doit repousser le verrouillage,
      // jamais lever d'exception au niveau de l'entité elle-même (c'est assertCanAuthenticate
      // qui porte le refus, pas registerFailedAuthentication).
      user.registerFailedAuthentication();
      expect(user.verrouilleJusqua!.getTime()).toBeGreaterThanOrEqual(premierVerrouillage.getTime());
    });
  });

  describe('statuts de compte', () => {
    it('refuse l\'authentification sur un compte suspendu', () => {
      const user = buildUser();
      user.suspend();
      expect(() => user.assertCanAuthenticate()).toThrow(UserAccountInactiveError);
    });

    it('refuse l\'authentification sur un compte désactivé', () => {
      const user = buildUser();
      user.deactivate();
      expect(() => user.assertCanAuthenticate()).toThrow(UserAccountInactiveError);
    });

    it('autorise à nouveau après réactivation', () => {
      const user = buildUser();
      user.suspend();
      user.reactivate();
      expect(() => user.assertCanAuthenticate()).not.toThrow();
    });
  });

  describe('KER-ID-05 — référentiel utilisateur', () => {
    it('met à jour uniquement les champs fournis, sans écraser les autres', () => {
      const user = buildUser();
      user.updateReferentiel({ paysId: 'pays-gn' });
      user.updateReferentiel({ langueId: 'langue-fr' });

      const referentiel = user.referentiel;
      expect(referentiel.paysId).toBe('pays-gn');
      expect(referentiel.langueId).toBe('langue-fr');
    });
  });

  describe('MFA', () => {
    it('active puis désactive le MFA de façon idempotente sur le statut', () => {
      const user = buildUser();
      expect(user.mfaActive).toBe(false);
      user.enableMfa();
      expect(user.mfaActive).toBe(true);
      user.disableMfa();
      expect(user.mfaActive).toBe(false);
    });
  });
});
