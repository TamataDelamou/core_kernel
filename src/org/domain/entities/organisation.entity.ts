export class SelfParentingError extends Error {
  constructor() {
    super('Une organisation ne peut pas être sa propre organisation mère.');
    this.name = 'SelfParentingError';
  }
}

/**
 * Références vers le GSG Referential (section 6-7 du Kernel), portées indépendamment par
 * chaque organisation — KER-ORG-04 : une organisation peut ouvrir une agence/filiale dans
 * un autre pays sans qu'aucune ligne de code applicatif ne soit modifiée dans les produits
 * qui la servent. Champs nommés en français (KER-NOM-01, alignés sur GSG Referential).
 */
export interface ReferentielOrganisation {
  paysId: string | null;
  uniteAdministrativeId: string | null;
  villeId: string | null;
  deviseId: string | null;
  langueId: string | null;
  fuseauHoraire: string | null;
}

export interface OrganisationProps {
  id: string; // gsg_org_id (KER-ORG-01)
  nom: string;
  /**
   * KER-ORG-04 : une filiale porte SES PROPRES références référentiel, indépendantes de
   * celles de sa maison mère éventuelle — organisationMereId ne fait qu'établir la
   * hiérarchie de rattachement commercial/juridique, jamais une hiérarchie d'héritage
   * automatique de pays/devise/langue (celle-ci reste portée par KER-INH-01 au niveau
   * utilisateur, pas au niveau organisation).
   */
  organisationMereId: string | null;
  referentiel: ReferentielOrganisation;
  estActif: boolean;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * Entité de domaine Organisation. KER-ORG-02 : l'intégration d'un produit existant
 * consiste uniquement, côté produit, à ajouter un champ gsg_org_id à sa table déjà en
 * place — Org Registry ne modélise aucune table de correspondance supplémentaire pour
 * cela (contrairement à GSG ID/KER-ID-02, où l'identité produit préexistait).
 */
export class Organisation {
  private constructor(private props: OrganisationProps) {}

  static create(params: {
    id: string;
    nom: string;
    organisationMereId?: string | null;
    referentiel: ReferentielOrganisation;
  }): Organisation {
    if (params.organisationMereId && params.organisationMereId === params.id) {
      throw new SelfParentingError();
    }

    const now = new Date();
    return new Organisation({
      id: params.id,
      nom: params.nom.trim(),
      organisationMereId: params.organisationMereId ?? null,
      referentiel: params.referentiel,
      estActif: true,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: OrganisationProps): Organisation {
    return new Organisation(props);
  }

  get id(): string {
    return this.props.id;
  }

  get organisationMereId(): string | null {
    return this.props.organisationMereId;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  get referentiel(): ReferentielOrganisation {
    return this.props.referentiel;
  }

  updateDetails(params: Partial<Pick<OrganisationProps, 'nom'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  /**
   * KER-ORG-04 : met à jour le référentiel propre à CETTE organisation, sans jamais
   * toucher au référentiel de sa maison mère ni de ses filiales.
   */
  updateReferentiel(referentiel: Partial<ReferentielOrganisation>): void {
    this.props.referentiel = { ...this.props.referentiel, ...referentiel };
    this.props.modifieLe = new Date();
  }

  reattachToParent(organisationMereId: string | null): void {
    if (organisationMereId === this.props.id) {
      throw new SelfParentingError();
    }
    this.props.organisationMereId = organisationMereId;
    this.props.modifieLe = new Date();
  }

  deactivate(): void {
    this.props.estActif = false;
    this.props.modifieLe = new Date();
  }

  reactivate(): void {
    this.props.estActif = true;
    this.props.modifieLe = new Date();
  }

  toSnapshot(): Readonly<OrganisationProps> {
    return { ...this.props };
  }
}
