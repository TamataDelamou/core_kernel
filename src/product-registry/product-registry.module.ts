import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProduitPaysDeploiementOrmEntity, ProduitPortefeuilleOrmEntity } from './infrastructure/persistence/typeorm/orm-entities';
import {
  TypeOrmProduitPaysDeploiementRepository,
  TypeOrmProduitPortefeuilleRepository,
} from './infrastructure/persistence/typeorm/orm-repositories';
import {
  PRODUIT_PAYS_DEPLOIEMENT_REPOSITORY,
  PRODUIT_PORTEFEUILLE_REPOSITORY,
} from './domain/repositories/product-registry.repositories';

import { PRODUCT_LOOKUP_PORT } from '../common/kernel-ports/product-lookup.port';
import { ProductLookupAdapter } from './infrastructure/adapters/product-lookup.adapter';

import {
  CreateProduitPortefeuilleUseCase,
  GetProduitPortefeuilleUseCase,
  ListProduitsPortefeuilleUseCase,
  SetProduitPortefeuilleActivationUseCase,
  UpdateProduitPortefeuilleUseCase,
} from './application/use-cases/produit-portefeuille.use-cases';
import {
  ListDeploiementsByProduitUseCase,
  SetDeploiementStatutUseCase,
} from './application/use-cases/deploiement.use-cases';

import { ProduitPortefeuilleController } from './interface/http/controllers/produit-portefeuille.controller';
import { DeploiementController } from './interface/http/controllers/deploiement.controller';

import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// Isolation stricte, même discipline que les modules précédents : ProductRegistryModule
// n'importe AUCUN module métier. C'est `product` et `org` qui importeront CE module pour
// consommer PRODUCT_LOOKUP_PORT — dépendance à sens unique, jamais l'inverse.
@Module({
  imports: [TypeOrmModule.forFeature([ProduitPortefeuilleOrmEntity, ProduitPaysDeploiementOrmEntity])],
  controllers: [ProduitPortefeuilleController, DeploiementController],
  providers: [
    { provide: PRODUIT_PORTEFEUILLE_REPOSITORY, useClass: TypeOrmProduitPortefeuilleRepository },
    { provide: PRODUIT_PAYS_DEPLOIEMENT_REPOSITORY, useClass: TypeOrmProduitPaysDeploiementRepository },

    { provide: PRODUCT_LOOKUP_PORT, useClass: ProductLookupAdapter },

    CreateProduitPortefeuilleUseCase,
    UpdateProduitPortefeuilleUseCase,
    SetProduitPortefeuilleActivationUseCase,
    GetProduitPortefeuilleUseCase,
    ListProduitsPortefeuilleUseCase,

    SetDeploiementStatutUseCase,
    ListDeploiementsByProduitUseCase,

    AuditInterceptor,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [PRODUCT_LOOKUP_PORT],
})
export class ProductRegistryModule {}
