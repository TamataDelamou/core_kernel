import { Organisation, SelfParentingError } from '../../../../src/org/domain/entities/organisation.entity';

const REFERENTIEL_VIDE = {
  paysId: null,
  uniteAdministrativeId: null,
  villeId: null,
  deviseId: null,
  langueId: null,
  fuseauHoraire: null,
};

describe('Organisation (domaine Org Registry) — KER-ORG-01/04', () => {
  describe('création', () => {
    it('attribue le référentiel fourni et démarre active', () => {
      const org = Organisation.create({
        id: 'org-1',
        nom: 'AssoShop Guinée',
        referentiel: { ...REFERENTIEL_VIDE, paysId: 'pays-gn' },
      });

      expect(org.estActif).toBe(true);
      expect(org.referentiel.paysId).toBe('pays-gn');
      expect(org.organisationMereId).toBeNull();
    });

    it('refuse qu\'une organisation soit sa propre maison mère dès la création', () => {
      expect(() =>
        Organisation.create({
          id: 'org-1',
          nom: 'Auto-référencée',
          organisationMereId: 'org-1',
          referentiel: REFERENTIEL_VIDE,
        }),
      ).toThrow(SelfParentingError);
    });
  });

  describe('KER-ORG-04 — référentiel indépendant par filiale', () => {
    it('une mise à jour du référentiel d\'une filiale ne modifie que CETTE organisation', () => {
      const mere = Organisation.create({
        id: 'org-mere',
        nom: 'Maison mère',
        referentiel: { ...REFERENTIEL_VIDE, paysId: 'pays-sn' },
      });
      const filiale = Organisation.create({
        id: 'org-filiale',
        nom: 'Filiale Guinée',
        organisationMereId: 'org-mere',
        referentiel: { ...REFERENTIEL_VIDE, paysId: 'pays-gn' },
      });

      filiale.updateReferentiel({ villeId: 'ville-conakry' });

      // La filiale change de ville ; la maison mère reste dans son propre pays, inchangée.
      expect(filiale.referentiel.villeId).toBe('ville-conakry');
      expect(filiale.referentiel.paysId).toBe('pays-gn');
      expect(mere.referentiel.paysId).toBe('pays-sn');
    });

    it('met à jour uniquement les champs fournis, sans écraser le reste du référentiel', () => {
      const org = Organisation.create({
        id: 'org-1',
        nom: 'Test',
        referentiel: { ...REFERENTIEL_VIDE, paysId: 'pays-gn', deviseId: 'devise-gnf' },
      });

      org.updateReferentiel({ langueId: 'langue-fr' });

      expect(org.referentiel.paysId).toBe('pays-gn');
      expect(org.referentiel.deviseId).toBe('devise-gnf');
      expect(org.referentiel.langueId).toBe('langue-fr');
    });
  });

  describe('réattachement à une nouvelle maison mère', () => {
    it('refuse de se rattacher à soi-même', () => {
      const org = Organisation.create({ id: 'org-1', nom: 'Test', referentiel: REFERENTIEL_VIDE });
      expect(() => org.reattachToParent('org-1')).toThrow(SelfParentingError);
    });

    it('accepte un rattachement vers une autre organisation', () => {
      const org = Organisation.create({ id: 'org-1', nom: 'Test', referentiel: REFERENTIEL_VIDE });
      org.reattachToParent('org-2');
      expect(org.organisationMereId).toBe('org-2');
    });

    it('accepte le détachement (null) d\'une maison mère existante', () => {
      const org = Organisation.create({
        id: 'org-1',
        nom: 'Test',
        organisationMereId: 'org-2',
        referentiel: REFERENTIEL_VIDE,
      });
      org.reattachToParent(null);
      expect(org.organisationMereId).toBeNull();
    });

    // Note : la détection de CYCLE (ex. org-2 est déjà descendante d'org-1, donc rattacher
    // org-1 à org-2 créerait une boucle) n'est pas un invariant de l'entité elle-même — elle
    // nécessite de parcourir l'arbre en base (OrganisationRepository.isDescendantOf), donc
    // elle est couverte par un test d'intégration sur ReattachOrganisationUseCase, pas ici.
  });

  describe('activation', () => {
    it('désactive puis réactive sans perte du référentiel', () => {
      const org = Organisation.create({
        id: 'org-1',
        nom: 'Test',
        referentiel: { ...REFERENTIEL_VIDE, paysId: 'pays-gn' },
      });
      org.deactivate();
      expect(org.estActif).toBe(false);
      org.reactivate();
      expect(org.estActif).toBe(true);
      expect(org.referentiel.paysId).toBe('pays-gn');
    });
  });
});
