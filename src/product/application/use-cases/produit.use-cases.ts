import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Produit } from '../../domain/entities/produit.entity';
import {
  CATALOGUE_REPOSITORY,
  CatalogueRepository,
  PRODUIT_REPOSITORY,
  ProduitRepository,
} from '../../domain/repositories/product.repositories';
import {
  CatalogueNotFoundError,
  ProduitCodeAlreadyExistsError,
  ProduitNotFoundError,
} from '../../domain/exceptions/product.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { PRODUCT_EVENT_TYPES } from '../../domain/events/product-event-catalog';

export interface CreateProduitCommand {
  catalogueId: string;
  code: string;
  nom: string;
  description?: string;
}

@Injectable()
export class CreateProduitUseCase {
  constructor(
    @Inject(CATALOGUE_REPOSITORY) private readonly catalogueRepository: CatalogueRepository,
    @Inject(PRODUIT_REPOSITORY) private readonly produitRepository: ProduitRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateProduitCommand): Promise<{ id: string }> {
    const catalogue = await this.catalogueRepository.findById(command.catalogueId);
    if (!catalogue) throw new CatalogueNotFoundError();

    const codeNormalise = command.code.trim().toLowerCase();
    const existant = await this.produitRepository.findByCatalogueAndCode(
      command.catalogueId,
      codeNormalise,
    );
    if (existant) {
      throw new ProduitCodeAlreadyExistsError(codeNormalise);
    }

    const produit = Produit.create({ id: uuidv4(), ...command, code: codeNormalise });
    await this.produitRepository.save(produit);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.PRODUCT_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: produit.id, catalogueId: command.catalogueId, code: codeNormalise },
    });

    return { id: produit.id };
  }
}

@Injectable()
export class UpdateProduitUseCase {
  constructor(@Inject(PRODUIT_REPOSITORY) private readonly produitRepository: ProduitRepository) {}

  async execute(id: string, updates: Partial<{ nom: string; description: string | null }>): Promise<void> {
    const produit = await this.get(id);
    produit.updateDetails(updates);
    await this.produitRepository.save(produit);
  }

  private async get(id: string): Promise<Produit> {
    const produit = await this.produitRepository.findById(id);
    if (!produit) throw new ProduitNotFoundError();
    return produit;
  }
}

@Injectable()
export class TransitionProduitWorkflowUseCase {
  constructor(
    @Inject(PRODUIT_REPOSITORY) private readonly produitRepository: ProduitRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async validate(id: string): Promise<void> {
    const produit = await this.get(id);
    produit.validate();
    await this.produitRepository.save(produit);
  }

  async rejectToDraft(id: string): Promise<void> {
    const produit = await this.get(id);
    produit.rejectToDraft();
    await this.produitRepository.save(produit);
  }

  async publish(id: string): Promise<void> {
    const produit = await this.get(id);
    produit.publish();
    await this.produitRepository.save(produit);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.PRODUCT_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: produit.id },
    });
  }

  async archive(id: string): Promise<void> {
    const produit = await this.get(id);
    produit.archive();
    await this.produitRepository.save(produit);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.PRODUCT_ARCHIVED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: produit.id },
    });
  }

  private async get(id: string): Promise<Produit> {
    const produit = await this.produitRepository.findById(id);
    if (!produit) throw new ProduitNotFoundError();
    return produit;
  }
}

@Injectable()
export class ListProduitsByCatalogueUseCase {
  constructor(@Inject(PRODUIT_REPOSITORY) private readonly produitRepository: ProduitRepository) {}

  async execute(catalogueId: string): Promise<Produit[]> {
    return this.produitRepository.findByCatalogue(catalogueId);
  }
}
