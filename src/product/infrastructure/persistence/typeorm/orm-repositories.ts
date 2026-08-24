import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionalRepository } from '../../../../common/kernel-infrastructure/persistence/transactional-repository.base';
import { TransactionContextService } from '../../../../common/kernel-infrastructure/persistence/transaction-context.service';
import { Catalogue, CatalogueScope, TypeScopeCatalogue } from '../../../domain/entities/catalogue.entity';
import { Produit } from '../../../domain/entities/produit.entity';
import { Offre, PeriodeFacturation, TypeOffre } from '../../../domain/entities/offre.entity';
import { Feature, OffreEntitlement } from '../../../domain/entities/feature.entity';
import { GrilleTarifaire } from '../../../domain/entities/grille-tarifaire.entity';
import { StatutCatalogWorkflow } from '../../../domain/entities/catalog-workflow';
import {
  CatalogueRepository,
  FeatureRepository,
  GrilleTarifaireRepository,
  OffreEntitlementRepository,
  OffreRepository,
  ProduitRepository,
} from '../../../domain/repositories/product.repositories';
import {
  CatalogueOrmEntity,
  FeatureOrmEntity,
  GrilleTarifaireOrmEntity,
  OffreEntitlementOrmEntity,
  OffreOrmEntity,
  ProduitOrmEntity,
} from './orm-entities';

@Injectable()
export class TypeOrmCatalogueRepository
  extends TransactionalRepository<CatalogueOrmEntity>
  implements CatalogueRepository
{
  constructor(
    @InjectRepository(CatalogueOrmEntity) repo: Repository<CatalogueOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Catalogue | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByOrganisationScope(organisationId: string): Promise<Catalogue | null> {
    const row = await this.repo.findOne({
      where: { scopeType: 'organisation', scopeCibleId: organisationId },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(params: { publiesUniquement: boolean }): Promise<Catalogue[]> {
    const rows = await this.repo.find({
      where: params.publiesUniquement ? { statutWorkflow: 'publie', estActif: true } : {},
      order: { nom: 'ASC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(catalogue: Catalogue): Promise<void> {
    const snapshot = catalogue.toSnapshot();
    const row = new CatalogueOrmEntity();
    row.id = snapshot.id;
    row.produitId = snapshot.produitId;
    row.nom = snapshot.nom;
    row.scopeType = snapshot.scope.getType();
    row.scopeCibleId = snapshot.scope.getCibleId();
    row.estActif = snapshot.estActif;
    row.statutWorkflow = snapshot.statutWorkflow;
    row.creeLe = snapshot.creeLe;
    row.modifieLe = snapshot.modifieLe;
    await this.repo.save(row);
  }

  private toDomain(row: CatalogueOrmEntity): Catalogue {
    return Catalogue.reconstitute({
      id: row.id,
      produitId: row.produitId,
      nom: row.nom,
      scope: CatalogueScope.reconstitute(row.scopeType as TypeScopeCatalogue, row.scopeCibleId),
      estActif: row.estActif,
      statutWorkflow: row.statutWorkflow as StatutCatalogWorkflow,
      creeLe: row.creeLe,
      modifieLe: row.modifieLe,
    });
  }
}

@Injectable()
export class TypeOrmProduitRepository extends TransactionalRepository<ProduitOrmEntity> implements ProduitRepository {
  constructor(
    @InjectRepository(ProduitOrmEntity) repo: Repository<ProduitOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Produit | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByCatalogueAndCode(catalogueId: string, code: string): Promise<Produit | null> {
    const row = await this.repo.findOne({ where: { catalogueId, code } });
    return row ? this.toDomain(row) : null;
  }

  async findByCatalogue(catalogueId: string): Promise<Produit[]> {
    const rows = await this.repo.find({ where: { catalogueId }, order: { nom: 'ASC' } });
    return rows.map((row) => this.toDomain(row));
  }

  async save(produit: Produit): Promise<void> {
    await this.repo.save(produit.toSnapshot());
  }

  private toDomain(row: ProduitOrmEntity): Produit {
    return Produit.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutCatalogWorkflow });
  }
}

@Injectable()
export class TypeOrmOffreRepository extends TransactionalRepository<OffreOrmEntity> implements OffreRepository {
  constructor(
    @InjectRepository(OffreOrmEntity) repo: Repository<OffreOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Offre | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByProduitAndCode(produitId: string, code: string): Promise<Offre | null> {
    const row = await this.repo.findOne({ where: { produitId, code } });
    return row ? this.toDomain(row) : null;
  }

  async findByProduit(produitId: string): Promise<Offre[]> {
    const rows = await this.repo.find({ where: { produitId }, order: { nom: 'ASC' } });
    return rows.map((row) => this.toDomain(row));
  }

  async save(offre: Offre): Promise<void> {
    await this.repo.save(offre.toSnapshot());
  }

  private toDomain(row: OffreOrmEntity): Offre {
    return Offre.reconstitute({
      ...row,
      type: row.type as TypeOffre,
      periodeFacturation: row.periodeFacturation as PeriodeFacturation,
      statutWorkflow: row.statutWorkflow as StatutCatalogWorkflow,
    });
  }
}

@Injectable()
export class TypeOrmFeatureRepository extends TransactionalRepository<FeatureOrmEntity> implements FeatureRepository {
  constructor(
    @InjectRepository(FeatureOrmEntity) repo: Repository<FeatureOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Feature | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? Feature.reconstitute(row) : null;
  }

  async findByCode(code: string): Promise<Feature | null> {
    const row = await this.repo.findOne({ where: { code } });
    return row ? Feature.reconstitute(row) : null;
  }

  async list(params: { activesUniquement: boolean }): Promise<Feature[]> {
    const rows = await this.repo.find({
      where: params.activesUniquement ? { estActif: true } : {},
      order: { nom: 'ASC' },
    });
    return rows.map((row) => Feature.reconstitute(row));
  }

  async save(feature: Feature): Promise<void> {
    await this.repo.save(feature.toSnapshot());
  }
}

@Injectable()
export class TypeOrmOffreEntitlementRepository
  extends TransactionalRepository<OffreEntitlementOrmEntity>
  implements OffreEntitlementRepository
{
  constructor(
    @InjectRepository(OffreEntitlementOrmEntity) repo: Repository<OffreEntitlementOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findByOffre(offreId: string): Promise<OffreEntitlement[]> {
    const rows = await this.repo.find({ where: { offreId } });
    return rows.map((row) => OffreEntitlement.reconstitute(row));
  }

  async findByOffreAndFeature(offreId: string, featureId: string): Promise<OffreEntitlement | null> {
    const row = await this.repo.findOne({ where: { offreId, featureId } });
    return row ? OffreEntitlement.reconstitute(row) : null;
  }

  async save(entitlement: OffreEntitlement): Promise<void> {
    await this.repo.save(entitlement.toSnapshot());
  }
}

@Injectable()
export class TypeOrmGrilleTarifaireRepository
  extends TransactionalRepository<GrilleTarifaireOrmEntity>
  implements GrilleTarifaireRepository
{
  constructor(
    @InjectRepository(GrilleTarifaireOrmEntity) repo: Repository<GrilleTarifaireOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<GrilleTarifaire | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByOffre(offreId: string): Promise<GrilleTarifaire[]> {
    const rows = await this.repo.find({ where: { offreId }, order: { version: 'DESC' } });
    return rows.map((row) => this.toDomain(row));
  }

  async findPublieesByOffreEtDevise(offreId: string, deviseId: string): Promise<GrilleTarifaire[]> {
    const rows = await this.repo.find({
      where: { offreId, deviseId, statutWorkflow: 'publie' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findLatestVersion(offreId: string): Promise<GrilleTarifaire | null> {
    const row = await this.repo.findOne({ where: { offreId }, order: { version: 'DESC' } });
    return row ? this.toDomain(row) : null;
  }

  async save(grilleTarifaire: GrilleTarifaire): Promise<void> {
    await this.repo.save(grilleTarifaire.toSnapshot());
  }

  private toDomain(row: GrilleTarifaireOrmEntity): GrilleTarifaire {
    return GrilleTarifaire.reconstitute({
      ...row,
      statutWorkflow: row.statutWorkflow as StatutCatalogWorkflow,
    });
  }
}
