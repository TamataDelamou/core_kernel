import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ProduitPaysDeploiement, StatutDeploiement } from '../../domain/entities/produit-pays-deploiement.entity';
import {
  PRODUIT_PAYS_DEPLOIEMENT_REPOSITORY,
  PRODUIT_PORTEFEUILLE_REPOSITORY,
  ProduitPaysDeploiementRepository,
  ProduitPortefeuilleRepository,
} from '../../domain/repositories/product-registry.repositories';
import { ProduitPortefeuilleNotFoundError } from '../../domain/exceptions/product-registry.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { PRODUCT_REGISTRY_EVENT_TYPES } from '../../domain/events/product-registry-event-catalog';

export interface SetDeploiementStatutCommand {
  produitId: string;
  paysId: string;
  statut: StatutDeploiement;
  phase: string;
}

/**
 * KER-PROD-02 : une seule ligne par (produitId, paysId) — un changement de statut MET À JOUR
 * la ligne existante plutôt que d'en créer une nouvelle (contrairement à KER-REF-03/04 où
 * l'historisation datée est explicitement demandée).
 */
@Injectable()
export class SetDeploiementStatutUseCase {
  constructor(
    @Inject(PRODUIT_PORTEFEUILLE_REPOSITORY)
    private readonly produitPortefeuilleRepository: ProduitPortefeuilleRepository,
    @Inject(PRODUIT_PAYS_DEPLOIEMENT_REPOSITORY)
    private readonly deploiementRepository: ProduitPaysDeploiementRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: SetDeploiementStatutCommand): Promise<{ id: string }> {
    const produit = await this.produitPortefeuilleRepository.findById(command.produitId);
    if (!produit) throw new ProduitPortefeuilleNotFoundError();

    const existant = await this.deploiementRepository.findByProduitAndPays(
      command.produitId,
      command.paysId,
    );

    let deploiement: ProduitPaysDeploiement;
    if (existant) {
      existant.changerStatut(command.statut, command.phase);
      deploiement = existant;
    } else {
      deploiement = ProduitPaysDeploiement.create({ id: uuidv4(), ...command });
    }

    await this.deploiementRepository.save(deploiement);

    await this.eventPublisher.publish({
      type: PRODUCT_REGISTRY_EVENT_TYPES.PRODUIT_PAYS_DEPLOIEMENT_CHANGED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-registry',
      chargeUtile: { produitId: command.produitId, paysId: command.paysId, statut: command.statut },
    });

    return { id: deploiement.id };
  }
}

@Injectable()
export class ListDeploiementsByProduitUseCase {
  constructor(
    @Inject(PRODUIT_PAYS_DEPLOIEMENT_REPOSITORY)
    private readonly deploiementRepository: ProduitPaysDeploiementRepository,
  ) {}

  async execute(produitId: string): Promise<ProduitPaysDeploiement[]> {
    return this.deploiementRepository.findByProduit(produitId);
  }
}
