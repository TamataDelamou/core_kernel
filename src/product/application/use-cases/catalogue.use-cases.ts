import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Catalogue, CatalogueScope } from '../../domain/entities/catalogue.entity';
import { CATALOGUE_REPOSITORY, CatalogueRepository } from '../../domain/repositories/product.repositories';
import {
  CatalogueAccessDeniedError,
  CatalogueNotFoundError,
  OrganisationScopeNotFoundError,
  UnregisteredProductError,
} from '../../domain/exceptions/product.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import {
  ORGANISATION_LOOKUP_PORT,
  OrganisationLookupPort,
} from '../../../common/kernel-ports/organisation-lookup.port';
import { PRODUCT_LOOKUP_PORT, ProductLookupPort } from '../../../common/kernel-ports/product-lookup.port';
import { PRODUCT_EVENT_TYPES } from '../../domain/events/product-event-catalog';

export interface CreateCatalogueCommand {
  produitId: string;
  nom: string;
  scopeType: 'portefeuille_global' | 'organisation' | 'zone_geographique';
  scopeCibleId?: string;
}

@Injectable()
export class CreateCatalogueUseCase {
  constructor(
    @Inject(CATALOGUE_REPOSITORY) private readonly catalogueRepository: CatalogueRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    @Inject(ORGANISATION_LOOKUP_PORT) private readonly organisationLookupPort: OrganisationLookupPort,
    @Inject(PRODUCT_LOOKUP_PORT) private readonly productLookupPort: ProductLookupPort,
  ) {}

  async execute(command: CreateCatalogueCommand): Promise<{ id: string }> {
    // KER-PROD-01 : ferme le dernier orphelin du modèle de domaine — un catalogue ne peut
    // plus référencer un produitId arbitraire, il doit exister et être actif dans le
    // Registre Central des Produits. Vérifié AVANT le scope, pour échouer au plus tôt.
    const produitValide = await this.productLookupPort.existsAndActive(command.produitId);
    if (!produitValide) {
      throw new UnregisteredProductError(command.produitId);
    }

    const scope = await this.buildAndValidateScope(command);

    const catalogue = Catalogue.create({
      id: uuidv4(),
      produitId: command.produitId,
      nom: command.nom,
      scope,
    });
    await this.catalogueRepository.save(catalogue);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.CATALOGUE_CREATED,
      gsgOrgId: scope.getType() === 'organisation' ? scope.getCibleId() : null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: {
        id: catalogue.id,
        produitId: command.produitId,
        scopeType: scope.getType(),
        scopeCibleId: scope.getCibleId(),
      },
    });

    return { id: catalogue.id };
  }

  /**
   * KER-PRD : un scope de type "organisation" n'est accepté que si l'organisation référencée
   * existe réellement et est active dans Org Registry — fermeture du contrôle de portée au
   * moment même de la création, jamais un simple UUID non vérifié.
   */
  private async buildAndValidateScope(command: CreateCatalogueCommand): Promise<CatalogueScope> {
    switch (command.scopeType) {
      case 'portefeuille_global':
        return CatalogueScope.portefeuilleGlobal();

      case 'organisation': {
        const organisationId = command.scopeCibleId as string;
        const existeEtActive = await this.organisationLookupPort.existsAndActive(organisationId);
        if (!existeEtActive) {
          throw new OrganisationScopeNotFoundError(organisationId);
        }
        return CatalogueScope.organisation(organisationId);
      }

      case 'zone_geographique':
        return CatalogueScope.zoneGeographique(command.scopeCibleId as string);
    }
  }
}

@Injectable()
export class UpdateCatalogueUseCase {
  constructor(@Inject(CATALOGUE_REPOSITORY) private readonly catalogueRepository: CatalogueRepository) {}

  async execute(id: string, updates: Partial<{ nom: string }>): Promise<void> {
    const catalogue = await this.get(id);
    catalogue.updateDetails(updates);
    await this.catalogueRepository.save(catalogue);
  }

  private async get(id: string): Promise<Catalogue> {
    const catalogue = await this.catalogueRepository.findById(id);
    if (!catalogue) throw new CatalogueNotFoundError();
    return catalogue;
  }
}

@Injectable()
export class TransitionCatalogueWorkflowUseCase {
  constructor(
    @Inject(CATALOGUE_REPOSITORY) private readonly catalogueRepository: CatalogueRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async validate(id: string): Promise<void> {
    const catalogue = await this.get(id);
    catalogue.validate();
    await this.catalogueRepository.save(catalogue);
  }

  async rejectToDraft(id: string): Promise<void> {
    const catalogue = await this.get(id);
    catalogue.rejectToDraft();
    await this.catalogueRepository.save(catalogue);
  }

  async publish(id: string): Promise<void> {
    const catalogue = await this.get(id);
    catalogue.publish();
    await this.catalogueRepository.save(catalogue);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.CATALOGUE_PUBLISHED,
      gsgOrgId: catalogue.scope.getType() === 'organisation' ? catalogue.scope.getCibleId() : null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: catalogue.id },
    });
  }

  async archive(id: string): Promise<void> {
    const catalogue = await this.get(id);
    catalogue.archive();
    await this.catalogueRepository.save(catalogue);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.CATALOGUE_ARCHIVED,
      gsgOrgId: catalogue.scope.getType() === 'organisation' ? catalogue.scope.getCibleId() : null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: catalogue.id },
    });
  }

  private async get(id: string): Promise<Catalogue> {
    const catalogue = await this.catalogueRepository.findById(id);
    if (!catalogue) throw new CatalogueNotFoundError();
    return catalogue;
  }
}

@Injectable()
export class GetCatalogueUseCase {
  constructor(@Inject(CATALOGUE_REPOSITORY) private readonly catalogueRepository: CatalogueRepository) {}

  async execute(id: string): Promise<Catalogue> {
    const catalogue = await this.catalogueRepository.findById(id);
    if (!catalogue) throw new CatalogueNotFoundError();
    return catalogue;
  }
}

@Injectable()
export class ListCataloguesUseCase {
  constructor(@Inject(CATALOGUE_REPOSITORY) private readonly catalogueRepository: CatalogueRepository) {}

  async execute(params: { includeNonPublies: boolean }): Promise<Catalogue[]> {
    return this.catalogueRepository.list({ publiesUniquement: !params.includeNonPublies });
  }
}

/**
 * KER-PRD — fermeture effective du contrôle de portée à la CONSULTATION : une organisation
 * ne peut accéder qu'aux catalogues qui lui sont explicitement scopés, à ceux scopés à l'une
 * de ses maisons mères (héritage descendant la hiérarchie — une filiale hérite du catalogue
 * de son groupe), ou au catalogue "portefeuille_global" (toujours accessible par défaut).
 */
@Injectable()
export class AssertOrganisationCanAccessCatalogueUseCase {
  constructor(
    @Inject(CATALOGUE_REPOSITORY) private readonly catalogueRepository: CatalogueRepository,
    @Inject(ORGANISATION_LOOKUP_PORT) private readonly organisationLookupPort: OrganisationLookupPort,
  ) {}

  async execute(catalogueId: string, requestingOrganisationId: string): Promise<Catalogue> {
    const catalogue = await this.catalogueRepository.findById(catalogueId);
    if (!catalogue) throw new CatalogueNotFoundError();

    if (catalogue.scope.getType() === 'portefeuille_global') {
      return catalogue;
    }

    if (catalogue.scope.getType() === 'zone_geographique') {
      // Le scope géographique n'est pas soumis à la hiérarchie organisationnelle : tout
      // appelant authentifié peut consulter un catalogue régional. Le contrôle d'accès fin
      // (ex. "l'organisation opère-t-elle dans ce pays ?") reste hors périmètre de ce use-case.
      return catalogue;
    }

    // scope.getType() === 'organisation'
    const catalogueOrganisationId = catalogue.scope.getCibleId() as string;
    const accesAutorise = await this.organisationLookupPort.isDescendantOrSelf(
      requestingOrganisationId,
      catalogueOrganisationId,
    );
    if (!accesAutorise) {
      throw new CatalogueAccessDeniedError(requestingOrganisationId, catalogueId);
    }

    return catalogue;
  }
}
