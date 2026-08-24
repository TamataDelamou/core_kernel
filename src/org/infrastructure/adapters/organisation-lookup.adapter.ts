import { Inject, Injectable } from '@nestjs/common';
import { OrganisationLookupPort } from '../../../common/kernel-ports/organisation-lookup.port';
import {
  ABONNEMENT_PRODUIT_REPOSITORY,
  AbonnementProduitRepository,
  ORGANISATION_REPOSITORY,
  OrganisationRepository,
} from '../../domain/repositories/org.repositories';

/**
 * Implémentation concrète du port `OrganisationLookupPort` (common/kernel-ports), consommée
 * par GSG ID (AssignRoleUseCase) pour fermer le contrôle de portée des rôles organisationnels
 * (KER-ORG-03) : un rôle scopé à un gsg_org_id inexistant ou désactivé ne peut plus être
 * attribué silencieusement. L'appel reste en-process (même service applicatif regroupant les
 * briques du noyau) mais transite exclusivement par ce contrat, jamais par un accès direct
 * au schéma `organisation` depuis le module identity (KER-VIS-03).
 */
@Injectable()
export class OrganisationLookupAdapter implements OrganisationLookupPort {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
    @Inject(ABONNEMENT_PRODUIT_REPOSITORY)
    private readonly abonnementProduitRepository: AbonnementProduitRepository,
  ) {}

  async existsAndActive(gsgOrgId: string): Promise<boolean> {
    const organisation = await this.organisationRepository.findById(gsgOrgId);
    return organisation !== null && organisation.estActif;
  }

  async isSubscribedToProduit(gsgOrgId: string, produitId: string): Promise<boolean> {
    const abonnement = await this.abonnementProduitRepository.findByOrganisationAndProduit(
      gsgOrgId,
      produitId,
    );
    return abonnement !== null && abonnement.isActive();
  }

  async isDescendantOrSelf(organisationId: string, ancestorOrganisationId: string): Promise<boolean> {
    if (organisationId === ancestorOrganisationId) return true;
    return this.organisationRepository.isDescendantOf(ancestorOrganisationId, organisationId);
  }
}
