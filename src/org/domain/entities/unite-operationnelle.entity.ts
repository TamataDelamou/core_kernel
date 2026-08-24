import { ReferentielOrganisation } from './organisation.entity';

/**
 * Une UniteOperationnelle (agence, antenne, point de vente) est un rattachement interne
 * à UNE organisation — contrairement à une filiale (modélisée par Organisation.
 * organisationMereId), elle n'a pas de gsg_org_id propre et n'est jamais elle-même
 * abonnée à des produits (KER-ORG-03 s'applique à l'organisation, pas à ses unités).
 * Elle porte néanmoins son propre référentiel (KER-ORG-04) : c'est le mécanisme concret
 * qui permet "une organisation peut ainsi ouvrir une agence dans un autre pays sans
 * qu'aucune ligne de code applicatif ne soit modifiée dans les produits qui la servent".
 */
export interface UniteOperationnelleProps {
  id: string;
  organisationId: string;
  nom: string;
  referentiel: ReferentielOrganisation;
  estActif: boolean;
  creeLe: Date;
  modifieLe: Date;
}

export class UniteOperationnelle {
  private constructor(private props: UniteOperationnelleProps) {}

  static create(params: {
    id: string;
    organisationId: string;
    nom: string;
    referentiel: ReferentielOrganisation;
  }): UniteOperationnelle {
    const now = new Date();
    return new UniteOperationnelle({
      id: params.id,
      organisationId: params.organisationId,
      nom: params.nom.trim(),
      referentiel: params.referentiel,
      estActif: true,
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: UniteOperationnelleProps): UniteOperationnelle {
    return new UniteOperationnelle(props);
  }

  get id(): string {
    return this.props.id;
  }

  get organisationId(): string {
    return this.props.organisationId;
  }

  updateDetails(params: Partial<Pick<UniteOperationnelleProps, 'nom'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  updateReferentiel(referentiel: Partial<ReferentielOrganisation>): void {
    this.props.referentiel = { ...this.props.referentiel, ...referentiel };
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

  toSnapshot(): Readonly<UniteOperationnelleProps> {
    return { ...this.props };
  }
}
