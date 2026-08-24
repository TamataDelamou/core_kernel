import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AbonnementProduit } from '../../domain/entities/abonnement-produit.entity';
import {
  ABONNEMENT_PRODUIT_REPOSITORY,
  AbonnementProduitRepository,
  ORGANISATION_REPOSITORY,
  OrganisationRepository,
} from '../../domain/repositories/org.repositories';
import {
  AbonnementAlreadyExistsError,
  AbonnementNotFoundError,
  OrganisationNotFoundError,
  UnregisteredProductError,
} from '../../domain/exceptions/org.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { PRODUCT_LOOKUP_PORT, ProductLookupPort } from '../../../common/kernel-ports/product-lookup.port';
import { ORG_EVENT_TYPES } from '../../domain/events/org-event-catalog';

@Injectable()
export class SubscribeToProduitUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
    @Inject(ABONNEMENT_PRODUIT_REPOSITORY)
    private readonly abonnementProduitRepository: AbonnementProduitRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    @Inject(PRODUCT_LOOKUP_PORT) private readonly productLookupPort: ProductLookupPort,
  ) {}

  /**
   * KER-ORG-03 : chaque abonnement est indépendant — souscrire à un produit n'implique
   * jamais d'abonnement implicite à un autre produit du portefeuille. KER-PROD-01 : le
   * produit souscrit doit exister et être actif dans le Registre Central des Produits —
   * jamais un UUID libre.
   */
  async execute(params: { organisationId: string; produitId: string; dateDebut: Date }): Promise<{ id: string }> {
    const organisation = await this.organisationRepository.findById(params.organisationId);
    if (!organisation) throw new OrganisationNotFoundError();

    const produitValide = await this.productLookupPort.existsAndActive(params.produitId);
    if (!produitValide) {
      throw new UnregisteredProductError(params.produitId);
    }

    const existant = await this.abonnementProduitRepository.findByOrganisationAndProduit(
      params.organisationId,
      params.produitId,
    );
    if (existant && existant.statut !== 'resilie') {
      throw new AbonnementAlreadyExistsError();
    }

    const abonnement = AbonnementProduit.create({ id: uuidv4(), ...params });
    await this.abonnementProduitRepository.save(abonnement);

    await this.eventPublisher.publish({
      type: ORG_EVENT_TYPES.ABONNEMENT_CREATED,
      gsgOrgId: params.organisationId,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-org-registry',
      chargeUtile: { id: abonnement.id, organisationId: params.organisationId, produitId: params.produitId },
    });

    return { id: abonnement.id };
  }
}

@Injectable()
export class TransitionAbonnementUseCase {
  constructor(
    @Inject(ABONNEMENT_PRODUIT_REPOSITORY)
    private readonly abonnementProduitRepository: AbonnementProduitRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async suspend(id: string): Promise<void> {
    const abonnement = await this.get(id);
    abonnement.suspend();
    await this.abonnementProduitRepository.save(abonnement);

    await this.eventPublisher.publish({
      type: ORG_EVENT_TYPES.ABONNEMENT_SUSPENDED,
      gsgOrgId: abonnement.toSnapshot().organisationId,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-org-registry',
      chargeUtile: { id },
    });
  }

  async reactivate(id: string): Promise<void> {
    const abonnement = await this.get(id);
    abonnement.reactivate();
    await this.abonnementProduitRepository.save(abonnement);

    await this.eventPublisher.publish({
      type: ORG_EVENT_TYPES.ABONNEMENT_REACTIVATED,
      gsgOrgId: abonnement.toSnapshot().organisationId,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-org-registry',
      chargeUtile: { id },
    });
  }

  async resiliate(id: string, dateFin: Date): Promise<void> {
    const abonnement = await this.get(id);
    abonnement.resiliate(dateFin);
    await this.abonnementProduitRepository.save(abonnement);

    await this.eventPublisher.publish({
      type: ORG_EVENT_TYPES.ABONNEMENT_RESILIATED,
      gsgOrgId: abonnement.toSnapshot().organisationId,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-org-registry',
      chargeUtile: { id, dateFin: dateFin.toISOString() },
    });
  }

  private async get(id: string): Promise<AbonnementProduit> {
    const abonnement = await this.abonnementProduitRepository.findById(id);
    if (!abonnement) throw new AbonnementNotFoundError();
    return abonnement;
  }
}

@Injectable()
export class ListAbonnementsByOrganisationUseCase {
  constructor(
    @Inject(ABONNEMENT_PRODUIT_REPOSITORY)
    private readonly abonnementProduitRepository: AbonnementProduitRepository,
  ) {}

  async execute(organisationId: string): Promise<AbonnementProduit[]> {
    return this.abonnementProduitRepository.findByOrganisation(organisationId);
  }
}
