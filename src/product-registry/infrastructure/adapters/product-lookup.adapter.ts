import { Inject, Injectable } from '@nestjs/common';
import { ProductLookupPort } from '../../../common/kernel-ports/product-lookup.port';
import {
  PRODUIT_PORTEFEUILLE_REPOSITORY,
  ProduitPortefeuilleRepository,
} from '../../domain/repositories/product-registry.repositories';

@Injectable()
export class ProductLookupAdapter implements ProductLookupPort {
  constructor(
    @Inject(PRODUIT_PORTEFEUILLE_REPOSITORY)
    private readonly produitPortefeuilleRepository: ProduitPortefeuilleRepository,
  ) {}

  async existsAndActive(produitId: string): Promise<boolean> {
    const produit = await this.produitPortefeuilleRepository.findById(produitId);
    return produit !== null && produit.estActif;
  }
}
