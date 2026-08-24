import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BriqueNoyau, ProduitPortefeuille } from '../../../domain/entities/produit-portefeuille.entity';
import { ProduitPaysDeploiement, StatutDeploiement } from '../../../domain/entities/produit-pays-deploiement.entity';
import {
  ProduitPaysDeploiementRepository,
  ProduitPortefeuilleRepository,
} from '../../../domain/repositories/product-registry.repositories';
import { ProduitPaysDeploiementOrmEntity, ProduitPortefeuilleOrmEntity } from './orm-entities';
import { TransactionalRepository } from '../../../../common/kernel-infrastructure/persistence/transactional-repository.base';
import { TransactionContextService } from '../../../../common/kernel-infrastructure/persistence/transaction-context.service';

@Injectable()
export class TypeOrmProduitPortefeuilleRepository
  extends TransactionalRepository<ProduitPortefeuilleOrmEntity>
  implements ProduitPortefeuilleRepository
{
  constructor(
    @InjectRepository(ProduitPortefeuilleOrmEntity) repo: Repository<ProduitPortefeuilleOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<ProduitPortefeuille | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<ProduitPortefeuille | null> {
    const row = await this.repo.findOne({ where: { code } });
    return row ? this.toDomain(row) : null;
  }

  async existsByCode(code: string): Promise<boolean> {
    const count = await this.repo.count({ where: { code } });
    return count > 0;
  }

  async list(params: { activesUniquement: boolean }): Promise<ProduitPortefeuille[]> {
    const rows = await this.repo.find({
      where: params.activesUniquement ? { estActif: true } : {},
      order: { nom: 'ASC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(produit: ProduitPortefeuille): Promise<void> {
    await this.repo.save(produit.toSnapshot());
  }

  private toDomain(row: ProduitPortefeuilleOrmEntity): ProduitPortefeuille {
    return ProduitPortefeuille.reconstitute({
      ...row,
      briquesConsommees: row.briquesConsommees as BriqueNoyau[],
    });
  }
}

@Injectable()
export class TypeOrmProduitPaysDeploiementRepository
  extends TransactionalRepository<ProduitPaysDeploiementOrmEntity>
  implements ProduitPaysDeploiementRepository
{
  constructor(
    @InjectRepository(ProduitPaysDeploiementOrmEntity) repo: Repository<ProduitPaysDeploiementOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findByProduitAndPays(produitId: string, paysId: string): Promise<ProduitPaysDeploiement | null> {
    const row = await this.repo.findOne({ where: { produitId, paysId } });
    return row ? this.toDomain(row) : null;
  }

  async findByProduit(produitId: string): Promise<ProduitPaysDeploiement[]> {
    const rows = await this.repo.find({ where: { produitId } });
    return rows.map((row) => this.toDomain(row));
  }

  async save(deploiement: ProduitPaysDeploiement): Promise<void> {
    await this.repo.save(deploiement.toSnapshot());
  }

  private toDomain(row: ProduitPaysDeploiementOrmEntity): ProduitPaysDeploiement {
    return ProduitPaysDeploiement.reconstitute({
      ...row,
      statut: row.statut as StatutDeploiement,
    });
  }
}
