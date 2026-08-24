import { ProduitPortefeuille } from '../entities/produit-portefeuille.entity';
import { ProduitPaysDeploiement } from '../entities/produit-pays-deploiement.entity';

export const PRODUIT_PORTEFEUILLE_REPOSITORY = Symbol('PRODUIT_PORTEFEUILLE_REPOSITORY');

export interface ProduitPortefeuilleRepository {
  findById(id: string): Promise<ProduitPortefeuille | null>;
  findByCode(code: string): Promise<ProduitPortefeuille | null>;
  existsByCode(code: string): Promise<boolean>;
  list(params: { activesUniquement: boolean }): Promise<ProduitPortefeuille[]>;
  save(produit: ProduitPortefeuille): Promise<void>;
}

export const PRODUIT_PAYS_DEPLOIEMENT_REPOSITORY = Symbol('PRODUIT_PAYS_DEPLOIEMENT_REPOSITORY');

export interface ProduitPaysDeploiementRepository {
  findByProduitAndPays(produitId: string, paysId: string): Promise<ProduitPaysDeploiement | null>;
  findByProduit(produitId: string): Promise<ProduitPaysDeploiement[]>;
  save(deploiement: ProduitPaysDeploiement): Promise<void>;
}
