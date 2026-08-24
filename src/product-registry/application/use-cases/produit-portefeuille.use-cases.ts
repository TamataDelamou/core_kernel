import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { BriqueNoyau, ProduitPortefeuille } from '../../domain/entities/produit-portefeuille.entity';
import {
  PRODUIT_PORTEFEUILLE_REPOSITORY,
  ProduitPortefeuilleRepository,
} from '../../domain/repositories/product-registry.repositories';
import {
  ProduitPortefeuilleCodeAlreadyExistsError,
  ProduitPortefeuilleNotFoundError,
} from '../../domain/exceptions/product-registry.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { PRODUCT_REGISTRY_EVENT_TYPES } from '../../domain/events/product-registry-event-catalog';

export interface CreateProduitPortefeuilleCommand {
  code: string;
  nom: string;
  briquesConsommees?: BriqueNoyau[];
}

@Injectable()
export class CreateProduitPortefeuilleUseCase {
  constructor(
    @Inject(PRODUIT_PORTEFEUILLE_REPOSITORY)
    private readonly produitPortefeuilleRepository: ProduitPortefeuilleRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  /** KER-PROD-03 : ajouter un produit au portefeuille est un simple ajout de ligne, jamais une modification de schéma. */
  async execute(command: CreateProduitPortefeuilleCommand): Promise<{ id: string }> {
    const codeNormalise = command.code.trim().toLowerCase();
    const dejaExistant = await this.produitPortefeuilleRepository.existsByCode(codeNormalise);
    if (dejaExistant) {
      throw new ProduitPortefeuilleCodeAlreadyExistsError(codeNormalise);
    }

    const produit = ProduitPortefeuille.create({ id: uuidv4(), ...command, code: codeNormalise });
    await this.produitPortefeuilleRepository.save(produit);

    await this.eventPublisher.publish({
      type: PRODUCT_REGISTRY_EVENT_TYPES.PRODUIT_PORTEFEUILLE_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-registry',
      chargeUtile: { id: produit.id, code: codeNormalise },
    });

    return { id: produit.id };
  }
}

@Injectable()
export class UpdateProduitPortefeuilleUseCase {
  constructor(
    @Inject(PRODUIT_PORTEFEUILLE_REPOSITORY)
    private readonly produitPortefeuilleRepository: ProduitPortefeuilleRepository,
  ) {}

  async updateDetails(id: string, updates: Partial<{ nom: string }>): Promise<void> {
    const produit = await this.get(id);
    produit.updateDetails(updates);
    await this.produitPortefeuilleRepository.save(produit);
  }

  /** KER-PROD-04. */
  async declareBriquesConsommees(id: string, briques: BriqueNoyau[]): Promise<void> {
    const produit = await this.get(id);
    produit.declareBriquesConsommees(briques);
    await this.produitPortefeuilleRepository.save(produit);
  }

  private async get(id: string): Promise<ProduitPortefeuille> {
    const produit = await this.produitPortefeuilleRepository.findById(id);
    if (!produit) throw new ProduitPortefeuilleNotFoundError();
    return produit;
  }
}

@Injectable()
export class SetProduitPortefeuilleActivationUseCase {
  constructor(
    @Inject(PRODUIT_PORTEFEUILLE_REPOSITORY)
    private readonly produitPortefeuilleRepository: ProduitPortefeuilleRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async deactivate(id: string): Promise<void> {
    const produit = await this.get(id);
    produit.deactivate();
    await this.produitPortefeuilleRepository.save(produit);

    await this.eventPublisher.publish({
      type: PRODUCT_REGISTRY_EVENT_TYPES.PRODUIT_PORTEFEUILLE_DEACTIVATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-registry',
      chargeUtile: { id: produit.id },
    });
  }

  async reactivate(id: string): Promise<void> {
    const produit = await this.get(id);
    produit.reactivate();
    await this.produitPortefeuilleRepository.save(produit);
  }

  private async get(id: string): Promise<ProduitPortefeuille> {
    const produit = await this.produitPortefeuilleRepository.findById(id);
    if (!produit) throw new ProduitPortefeuilleNotFoundError();
    return produit;
  }
}

@Injectable()
export class ListProduitsPortefeuilleUseCase {
  constructor(
    @Inject(PRODUIT_PORTEFEUILLE_REPOSITORY)
    private readonly produitPortefeuilleRepository: ProduitPortefeuilleRepository,
  ) {}

  async execute(params: { includeInactifs: boolean }): Promise<ProduitPortefeuille[]> {
    return this.produitPortefeuilleRepository.list({ activesUniquement: !params.includeInactifs });
  }
}

@Injectable()
export class GetProduitPortefeuilleUseCase {
  constructor(
    @Inject(PRODUIT_PORTEFEUILLE_REPOSITORY)
    private readonly produitPortefeuilleRepository: ProduitPortefeuilleRepository,
  ) {}

  async execute(id: string): Promise<ProduitPortefeuille> {
    const produit = await this.produitPortefeuilleRepository.findById(id);
    if (!produit) throw new ProduitPortefeuilleNotFoundError();
    return produit;
  }
}
