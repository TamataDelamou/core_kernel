import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Offre, PeriodeFacturation, TypeOffre } from '../../domain/entities/offre.entity';
import {
  OFFRE_REPOSITORY,
  OffreRepository,
  PRODUIT_REPOSITORY,
  ProduitRepository,
} from '../../domain/repositories/product.repositories';
import {
  OffreCodeAlreadyExistsError,
  OffreNotFoundError,
  ProduitNotFoundError,
} from '../../domain/exceptions/product.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { PRODUCT_EVENT_TYPES } from '../../domain/events/product-event-catalog';

export interface CreateOffreCommand {
  produitId: string;
  code: string;
  nom: string;
  type: TypeOffre;
  periodeFacturation: PeriodeFacturation;
}

@Injectable()
export class CreateOffreUseCase {
  constructor(
    @Inject(PRODUIT_REPOSITORY) private readonly produitRepository: ProduitRepository,
    @Inject(OFFRE_REPOSITORY) private readonly offreRepository: OffreRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateOffreCommand): Promise<{ id: string }> {
    const produit = await this.produitRepository.findById(command.produitId);
    if (!produit) throw new ProduitNotFoundError();

    const codeNormalise = command.code.trim().toLowerCase();
    const existante = await this.offreRepository.findByProduitAndCode(command.produitId, codeNormalise);
    if (existante) {
      throw new OffreCodeAlreadyExistsError(codeNormalise);
    }

    // Offre.create lève IncompatibleBillingPeriodError si type/périodeFacturation sont
    // incompatibles (ex. "ponctuel" + "mensuelle") — invariant vérifié dans le domaine.
    const offre = Offre.create({ id: uuidv4(), ...command, code: codeNormalise });
    await this.offreRepository.save(offre);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.OFFER_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: offre.id, produitId: command.produitId, type: command.type },
    });

    return { id: offre.id };
  }
}

@Injectable()
export class UpdateOffreUseCase {
  constructor(@Inject(OFFRE_REPOSITORY) private readonly offreRepository: OffreRepository) {}

  async execute(id: string, updates: Partial<{ nom: string }>): Promise<void> {
    const offre = await this.get(id);
    offre.updateDetails(updates);
    await this.offreRepository.save(offre);
  }

  private async get(id: string): Promise<Offre> {
    const offre = await this.offreRepository.findById(id);
    if (!offre) throw new OffreNotFoundError();
    return offre;
  }
}

@Injectable()
export class TransitionOffreWorkflowUseCase {
  constructor(
    @Inject(OFFRE_REPOSITORY) private readonly offreRepository: OffreRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async validate(id: string): Promise<void> {
    const offre = await this.get(id);
    offre.validate();
    await this.offreRepository.save(offre);
  }

  async rejectToDraft(id: string): Promise<void> {
    const offre = await this.get(id);
    offre.rejectToDraft();
    await this.offreRepository.save(offre);
  }

  async publish(id: string): Promise<void> {
    const offre = await this.get(id);
    offre.publish();
    await this.offreRepository.save(offre);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.OFFER_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: offre.id },
    });
  }

  async archive(id: string): Promise<void> {
    const offre = await this.get(id);
    offre.archive();
    await this.offreRepository.save(offre);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.OFFER_ARCHIVED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: offre.id },
    });
  }

  private async get(id: string): Promise<Offre> {
    const offre = await this.offreRepository.findById(id);
    if (!offre) throw new OffreNotFoundError();
    return offre;
  }
}

@Injectable()
export class ListOffresByProduitUseCase {
  constructor(@Inject(OFFRE_REPOSITORY) private readonly offreRepository: OffreRepository) {}

  async execute(produitId: string): Promise<Offre[]> {
    return this.offreRepository.findByProduit(produitId);
  }
}
